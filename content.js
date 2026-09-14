/**
 * VladeMD-View - content script.
 *
 * Chrome entrega .md como texto cru dentro de um <pre>. Pegamos esse texto,
 * renderizamos com markdown-it + os plugins de dialeto, sanitizamos e
 * substituimos o corpo da pagina pela leitura formatada.
 */
(function () {
  'use strict';

  if (document.documentElement.hasAttribute('data-vmd')) return; // ja renderizado
  if (!/\.(md|markdown|mdown|mkd|mkdn|mdwn)$/i.test(location.pathname)) return;

  var DEFAULTS = {
    theme: 'system', // system | light | dark
    toc: true,
    width: 768,
    tags: true,
    wikilinks: true,
    math: true,
    mermaid: true,
    emoji: true,
  };

  var UI = {
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>',
    auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" stroke="none"/>',
    settings:
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  };

  function icon(path, cls) {
    return (
      '<svg class="' +
      (cls || 'ui-icon') +
      '" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      path +
      '</svg>'
    );
  }

  // ------------------------------------------------------------------ fonte
  // So assumimos a pagina quando ela e' de fato texto cru; um .md servido como
  // HTML (ex.: a propria UI do GitHub) nao deve ser tocado.
  function readSource() {
    var pre = document.body && document.body.querySelector('pre');
    if (pre && document.body.children.length === 1) return pre.textContent;
    if (document.contentType && /^text\/(plain|markdown|x-markdown)$/.test(document.contentType)) {
      return document.body.textContent;
    }
    return null;
  }

  function getSettings() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.sync.get(DEFAULTS, function (v) {
          resolve(chrome.runtime.lastError ? DEFAULTS : Object.assign({}, DEFAULTS, v));
        });
      } catch (e) {
        resolve(DEFAULTS);
      }
    });
  }

  function injectVendor(files) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage({ type: 'vmd-inject', files: files }, function (res) {
          resolve(!chrome.runtime.lastError && res && res.ok);
        });
      } catch (e) {
        resolve(false);
      }
    });
  }

  function renderFrontmatter(yaml) {
    var rows = window.VladeMD.parseFrontmatter(yaml);
    if (!rows.length) return null;
    var box = document.createElement('details');
    box.className = 'frontmatter';
    var sum = document.createElement('summary');
    sum.textContent = 'Frontmatter (' + rows.length + ')';
    box.appendChild(sum);

    var dl = document.createElement('dl');
    rows.forEach(function (r) {
      var dt = document.createElement('dt');
      dt.textContent = r.key;
      var dd = document.createElement('dd');
      if (r.list.length) {
        r.list.forEach(function (v) {
          var chip = document.createElement('span');
          chip.className = 'chip';
          chip.textContent = v;
          dd.appendChild(chip);
        });
      } else {
        dd.textContent = r.value;
      }
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    box.appendChild(dl);
    return box;
  }

  // -------------------------------------------------------------- esqueleto
  function buildShell(settings, fileName) {
    var app = document.createElement('div');
    app.id = 'vmd-app';
    app.innerHTML = [
      '<div id="vmd-progress"></div>',
      '<aside id="vmd-toc" aria-label="Sumario">',
      '  <div class="toc-head">Sumario</div>',
      '  <nav class="toc-nav"></nav>',
      '</aside>',
      '<div id="vmd-main">',
      '  <header id="vmd-bar">',
      '    <button id="vmd-toc-btn" class="icon-btn" title="Sumario" aria-label="Sumario">' +
        icon(UI.menu) +
        '</button>',
      '    <span id="vmd-file"></span>',
      '    <span class="grow"></span>',
      '    <button id="vmd-theme-btn" class="icon-btn" title="Tema" aria-label="Tema"></button>',
      '    <button id="vmd-opt-btn" class="icon-btn" title="Opcoes" aria-label="Opcoes">' +
        icon(UI.settings) +
        '</button>',
      '  </header>',
      '  <article id="vmd-content"></article>',
      '  <footer id="vmd-foot">VladeMD-View</footer>',
      '</div>',
    ].join('\n');

    document.body.innerHTML = '';
    document.body.appendChild(app);
    app.querySelector('#vmd-file').textContent = fileName;
    document.documentElement.style.setProperty('--content-width', settings.width + 'px');
    return app;
  }

  // ------------------------------------------------------------------ tema
  function applyTheme(mode) {
    var dark =
      mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme-mode', mode);
    var btn = document.getElementById('vmd-theme-btn');
    if (btn) btn.innerHTML = icon(mode === 'system' ? UI.auto : dark ? UI.moon : UI.sun);
    return dark;
  }

  // ------------------------------------------------------- ancoras e sumario
  function buildToc(content, nav) {
    var heads = content.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (!heads.length) return [];

    var used = Object.create(null);
    var items = [];
    var min = 6;
    Array.prototype.forEach.call(heads, function (h) {
      min = Math.min(min, +h.tagName[1]);
    });

    Array.prototype.forEach.call(heads, function (h) {
      var base = window.VladeMD.slugify(h.textContent) || 'secao';
      var id = base;
      var n = 1;
      while (used[id]) id = base + '-' + ++n; // ancoras duplicadas quebram o ToC
      used[id] = true;
      h.id = id;

      var a = document.createElement('a');
      a.className = 'head-anchor';
      a.href = '#' + id;
      a.setAttribute('aria-label', 'Link para esta secao');
      a.innerHTML = icon(UI.link, 'anchor-icon');
      h.appendChild(a);

      var link = document.createElement('a');
      link.href = '#' + id;
      link.className = 'toc-link lvl-' + (+h.tagName[1] - min);
      link.textContent = h.textContent.trim();
      nav.appendChild(link);
      items.push({ head: h, link: link });
    });
    return items;
  }

  function scrollSpy(items) {
    if (!items.length) return;
    var ticking = false;
    var active = null;

    function update() {
      ticking = false;
      var current = items[0];
      for (var i = 0; i < items.length; i++) {
        if (items[i].head.getBoundingClientRect().top > 120) break;
        current = items[i];
      }
      if (current === active) return;
      if (active) active.link.classList.remove('active');
      current.link.classList.add('active');
      active = current;

      var nav = current.link.parentNode;
      var top = current.link.offsetTop - nav.clientHeight / 2;
      if (nav.scrollHeight > nav.clientHeight) nav.scrollTop = Math.max(0, top);
    }

    addEventListener(
      'scroll',
      function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    update();
  }

  function progressBar() {
    var bar = document.getElementById('vmd-progress');
    addEventListener(
      'scroll',
      function () {
        var max = document.documentElement.scrollHeight - innerHeight;
        bar.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + '%';
      },
      { passive: true }
    );
  }

  // ------------------------------------------------------- blocos de codigo
  function decorateCode(content) {
    content.querySelectorAll('pre > code').forEach(function (code) {
      var pre = code.parentNode;
      var wrap = document.createElement('div');
      wrap.className = 'code-block';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      var lang = (code.className.match(/language-([\w+#-]+)/) || [])[1];
      if (lang) {
        var tag = document.createElement('span');
        tag.className = 'code-lang';
        tag.textContent = lang;
        wrap.appendChild(tag);
      }

      var btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = 'copiar';
      btn.addEventListener('click', function () {
        navigator.clipboard.writeText(code.textContent).then(
          function () {
            btn.textContent = 'copiado';
            setTimeout(function () {
              btn.textContent = 'copiar';
            }, 1400);
          },
          function () {
            btn.textContent = 'falhou';
          }
        );
      });
      wrap.appendChild(btn);
    });
  }

  function wrapTables(content) {
    content.querySelectorAll('table').forEach(function (t) {
      var wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      t.parentNode.insertBefore(wrap, t);
      wrap.appendChild(t);
    });
  }

  // --------------------------------------------------------------- mermaid
  var mermaidReady = false;

  function mermaidTheme(dark) {
    return {
      startOnLoad: false,
      securityLevel: 'strict',
      theme: dark ? 'dark' : 'default',
      fontFamily: 'inherit',
      themeVariables: { background: dark ? '#060606' : '#ffffff' },
    };
  }

  async function renderMermaid(content, dark) {
    var blocks = content.querySelectorAll('.mermaid-block');
    if (!blocks.length) return;

    if (!mermaidReady) {
      var ok = await injectVendor(['vendor/mermaid.min.js']);
      if (!ok || !window.mermaid) {
        blocks.forEach(function (b) {
          b.className = 'render-error';
          b.textContent = 'Mermaid nao pode ser carregado.';
        });
        return;
      }
      mermaidReady = true;
    }

    window.mermaid.initialize(mermaidTheme(dark));
    var nodes = [];
    blocks.forEach(function (b) {
      // O mermaid troca o innerHTML pelo SVG, entao a fonte fica guardada no
      // proprio elemento para permitir redesenhar ao trocar de tema.
      if (b.vmdSrc === undefined) b.vmdSrc = b.textContent;
      b.removeAttribute('data-processed');
      b.classList.add('mermaid');
      b.textContent = b.vmdSrc;
      nodes.push(b);
    });

    try {
      await window.mermaid.run({ nodes: nodes, suppressErrors: true });
    } catch (e) {
      /* suppressErrors ja marca o bloco com falha no proprio SVG */
    }
  }

  // --------------------------------------------------------------- mathjax
  async function renderMath(content) {
    if (!/\\\(|\\\[/.test(content.innerHTML)) return;

    if (!window.MathJax) {
      window.MathJax = {
        tex: {
          inlineMath: [['\\(', '\\)']],
          displayMath: [['\\[', '\\]']],
          processEscapes: false,
          processEnvironments: true,
        },
        svg: { fontCache: 'global' },
        options: {
          enableMenu: false,
          skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
        },
        startup: { typeset: false },
      };
      var ok = await injectVendor(['vendor/mathjax-tex-svg.js']);
      if (!ok || !window.MathJax || !window.MathJax.startup) return;
    }

    try {
      await window.MathJax.startup.promise;
      await window.MathJax.typesetPromise([content]);
    } catch (e) {
      /* formula invalida vira caixa vermelha do proprio MathJax */
    }
  }

  // ------------------------------------------------------------------ main
  async function main() {
    var source = readSource();
    if (source === null || !source.trim()) return;

    document.documentElement.setAttribute('data-vmd', '1');
    var fallback = document.body.innerHTML;

    try {
      var settings = await getSettings();
      var fileName = decodeURIComponent(location.pathname.split('/').pop() || 'documento.md');

      var split = window.VladeMD.splitFrontmatter(source);
      var md = window.VladeMD.createParser(settings);
      var dirty = md.render(split.body);
      var clean = window.DOMPurify.sanitize(dirty, {
        ADD_ATTR: ['target', 'open'],
        ADD_TAGS: ['details', 'summary'],
      });

      var app = buildShell(settings, fileName);
      var content = app.querySelector('#vmd-content');
      content.innerHTML = clean;

      if (split.yaml) {
        var fm = renderFrontmatter(split.yaml);
        if (fm) content.insertBefore(fm, content.firstChild);
      }

      var h1 = content.querySelector('h1');
      var docHeading = h1 ? h1.textContent.trim() : fileName;
      if (/^VladeMD-View\s*[-—–]\s*/i.test(docHeading)) {
        docHeading = docHeading.replace(/^VladeMD-View\s*[-—–]\s*/i, '');
      } else if (docHeading === 'VladeMD-View') {
        docHeading = fileName;
      }
      document.title = docHeading ? (docHeading + ' — VladeMD-View') : 'VladeMD-View';

      try {
        var iconUrl = chrome.runtime.getURL('icons/32.png'); // Test with 32x32 if 16x16 fails, or 16x16.
        document.querySelectorAll("link[rel*='icon']").forEach(e => e.remove());
        var favLink = document.createElement('link');
        favLink.rel = 'shortcut icon';
        favLink.type = 'image/png';
        favLink.href = chrome.runtime.getURL('icons/16.png');
        document.head.appendChild(favLink);
      } catch (e) {}

      var dark = applyTheme(settings.theme);
      wrapTables(content);
      decorateCode(content);
      progressBar();

      var nav = app.querySelector('.toc-nav');
      var items = buildToc(content, nav);
      if (!settings.toc || items.length < 2) app.classList.add('no-toc');
      scrollSpy(items);

      // ---- interacoes da barra
      document.getElementById('vmd-toc-btn').addEventListener('click', function () {
        app.classList.toggle('toc-open');
      });
      document.getElementById('vmd-opt-btn').addEventListener('click', function () {
        // openOptionsPage nao existe em content script: quem abre e o background.
        chrome.runtime.sendMessage({ type: 'vmd-options' }, function () {
          void chrome.runtime.lastError;
        });
      });

      var modes = ['system', 'light', 'dark'];
      document.getElementById('vmd-theme-btn').addEventListener('click', function () {
        var next = modes[(modes.indexOf(settings.theme) + 1) % modes.length];
        settings.theme = next;
        var isDark = applyTheme(next);
        try {
          chrome.storage.sync.set({ theme: next });
        } catch (e) {
          /* sem storage: tema vale so nesta aba */
        }
        renderMermaid(content, isDark);
      });

      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        if (settings.theme === 'system') renderMermaid(content, applyTheme('system'));
      });

      // ---- conteudo pesado, sob demanda
      if (settings.mermaid) await renderMermaid(content, dark);
      if (settings.math) await renderMath(content);

      // O navegador ja tinha tentado rolar ate a ancora antes de existirmos.
      if (location.hash) {
        var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (target) target.scrollIntoView();
      }
    } catch (err) {
      // Nunca deixar o usuario com uma pagina em branco.
      document.documentElement.removeAttribute('data-vmd');
      document.body.innerHTML = fallback;
      console.error('[VladeMD-View] falha ao renderizar:', err);
    }
  }

  main();
})();

/**
 * Plugins de dialeto para o markdown-it: o que o Obsidian e o Claude Code
 * escrevem e o GFM puro nao entende.
 *
 * Exposto como globalThis.VladeMD para o content.js consumir.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- icones
  // Feather-style, 16px, stroke. Inline porque callout sem icone nao e' callout.
  var ICONS = {
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    flame:
      '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/>',
    check:
      '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    alert:
      '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    x: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    clipboard:
      '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    quote:
      '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.76-2-2-2H4c-1.25 0-2 .75-2 2v4c0 1.25.75 2 2 2h1"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.76-2-2-2h-4c-1.25 0-2 .75-2 2v4c0 1.25.75 2 2 2h1"/>',
  };

  function svg(name) {
    return (
      '<svg class="callout-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' +
      (ICONS[name] || ICONS.info) +
      '</svg>'
    );
  }

  // Aliases do Obsidian -> (cor, icone, titulo padrao)
  var CALLOUTS = {};
  function def(kind, icon, label, aliases) {
    aliases.forEach(function (a) {
      CALLOUTS[a] = { kind: kind, icon: icon, label: label };
    });
  }
  def('note', 'pencil', 'Note', ['note']);
  def('abstract', 'clipboard', 'Abstract', ['abstract', 'summary', 'tldr']);
  def('info', 'info', 'Info', ['info']);
  def('todo', 'check', 'Todo', ['todo']);
  def('tip', 'flame', 'Tip', ['tip', 'hint', 'important']);
  def('success', 'check', 'Success', ['success', 'check', 'done']);
  def('question', 'help', 'Question', ['question', 'help', 'faq']);
  def('warning', 'alert', 'Warning', ['warning', 'caution', 'attention']);
  def('failure', 'x', 'Failure', ['failure', 'fail', 'missing']);
  def('danger', 'zap', 'Danger', ['danger', 'error']);
  def('bug', 'zap', 'Bug', ['bug']);
  def('example', 'list', 'Example', ['example']);
  def('quote', 'quote', 'Quote', ['quote', 'cite']);

  // ----------------------------------------------------------- frontmatter
  // markdown-it leria `---` como <hr> e o YAML como paragrafo. Separamos antes.
  function splitFrontmatter(src) {
    var m = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(src);
    if (!m) return { yaml: null, body: src };
    return { yaml: m[1], body: src.slice(m[0].length) };
  }

  // Parser YAML deliberadamente raso: chave/valor e listas de 1 nivel.
  // ponytail: sem lib de YAML; frontmatter aqui e' metadado exibido, nao executado.
  function parseFrontmatter(yaml) {
    var out = [];
    var current = null;
    yaml.split(/\r?\n/).forEach(function (line) {
      if (!line.trim() || /^\s*#/.test(line)) return;
      var item = /^\s*-\s+(.*)$/.exec(line);
      if (item && current) {
        current.list.push(unquote(item[1]));
        return;
      }
      var kv = /^([A-Za-z0-9_.$-]+)\s*:\s*(.*)$/.exec(line);
      if (!kv) return;
      current = { key: kv[1], value: unquote(kv[2]), list: [] };
      out.push(current);
    });
    return out;
  }

  function unquote(v) {
    v = String(v == null ? '' : v).trim();
    if (/^".*"$/.test(v) || /^'.*'$/.test(v)) return v.slice(1, -1);
    if (/^\[.*\]$/.test(v)) return v.slice(1, -1); // lista inline: [a, b]
    return v;
  }

  // ------------------------------------------------------------------ math
  // Emite delimitadores \( \) e \[ \] para o MathJax varrer depois.
  // Registrado ANTES de sub/sup: senao `$x^2$` vira sobrescrito e a formula quebra.
  function escapeTex(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function mathInline(state, silent) {
    var src = state.src;
    var start = state.pos;
    if (src.charCodeAt(start) !== 0x24 /* $ */) return false;
    if (start > 0 && src.charCodeAt(start - 1) === 0x5c /* \ */) return false;

    var dollars = src.charCodeAt(start + 1) === 0x24 ? 2 : 1;
    var pos = start + dollars;
    if (dollars === 1) {
      var c = src.charCodeAt(pos);
      // `$ x$` e `$` solto nao sao formula
      if (isNaN(c) || c === 0x20 || c === 0x09 || c === 0x0a) return false;
    }

    var end = -1;
    while (pos < src.length) {
      var ch = src.charCodeAt(pos);
      if (ch === 0x5c) {
        pos += 2;
        continue;
      }
      if (ch === 0x24) {
        if (dollars === 2) {
          if (src.charCodeAt(pos + 1) === 0x24) {
            end = pos;
            break;
          }
          pos++;
          continue;
        }
        var prev = src.charCodeAt(pos - 1);
        var next = src.charCodeAt(pos + 1);
        // "custa $5" / "de $10 a $20": nao e' matematica
        if (prev === 0x20 || prev === 0x09 || (next >= 0x30 && next <= 0x39)) {
          pos++;
          continue;
        }
        end = pos;
        break;
      }
      if (ch === 0x0a && dollars === 1) return false; // inline nao cruza linha
      pos++;
    }
    if (end < 0) return false;

    var content = src.slice(start + dollars, end);
    if (!content.trim()) return false;

    if (!silent) {
      var token = state.push(dollars === 2 ? 'math_inline_display' : 'math_inline', 'math', 0);
      token.content = content;
    }
    state.pos = end + dollars;
    return true;
  }

  function mathBlock(state, startLine, endLine, silent) {
    var pos = state.bMarks[startLine] + state.tShift[startLine];
    var max = state.eMarks[startLine];
    if (state.src.slice(pos, pos + 2) !== '$$') return false;

    var lines = [];
    var line = startLine;
    var closed = false;
    var rest = state.src.slice(pos + 2, max);
    var idx = rest.indexOf('$$');

    if (idx >= 0) {
      lines.push(rest.slice(0, idx)); // $$ x $$ numa linha so
      closed = true;
    } else {
      if (rest.trim()) lines.push(rest);
      while (++line < endLine) {
        var s = state.bMarks[line] + state.tShift[line];
        var e = state.eMarks[line];
        var text = state.src.slice(s, e);
        var j = text.indexOf('$$');
        if (j >= 0) {
          if (text.slice(0, j).trim()) lines.push(text.slice(0, j));
          closed = true;
          break;
        }
        lines.push(state.src.slice(state.bMarks[line], e));
      }
    }
    if (!closed) return false;
    if (silent) return true;

    var token = state.push('math_block', 'math', 0);
    token.content = lines.join('\n');
    token.map = [startLine, line + 1];
    token.block = true;
    state.line = line + 1;
    return true;
  }

  function math(md) {
    md.inline.ruler.before('escape', 'math_inline', mathInline);
    md.block.ruler.before('fence', 'math_block', mathBlock, {
      alt: ['paragraph', 'reference', 'blockquote', 'list'],
    });
    md.renderer.rules.math_inline = function (t, i) {
      return '\\(' + escapeTex(t[i].content) + '\\)';
    };
    md.renderer.rules.math_inline_display = function (t, i) {
      return '<span class="math-display">\\[' + escapeTex(t[i].content) + '\\]</span>';
    };
    md.renderer.rules.math_block = function (t, i) {
      return '<div class="math-display">\\[' + escapeTex(t[i].content) + '\\]</div>\n';
    };
  }

  // -------------------------------------------------------------- callouts
  // > [!WARNING]- Titulo
  // > corpo
  function findBlockquoteClose(tokens, openIdx) {
    var depth = 0;
    for (var j = openIdx; j < tokens.length; j++) {
      if (tokens[j].type === 'blockquote_open') depth++;
      else if (tokens[j].type === 'blockquote_close' && --depth === 0) return j;
    }
    return -1;
  }

  function callouts(md) {
    md.core.ruler.after('block', 'obsidian_callout', function (state) {
      var tokens = state.tokens;
      for (var i = 0; i < tokens.length; i++) {
        if (tokens[i].type !== 'blockquote_open') continue;
        var para = tokens[i + 1];
        var inline = tokens[i + 2];
        if (!para || para.type !== 'paragraph_open') continue;
        if (!inline || inline.type !== 'inline') continue;

        var lines = inline.content.split('\n');
        var m = /^\[!([\w-]+)\]([+-]?)[ \t]*(.*)$/.exec(lines[0]);
        if (!m) continue;

        var spec = CALLOUTS[m[1].toLowerCase()] || CALLOUTS.note;
        var fold = m[2]; // '' fixo, '+' recolhivel aberto, '-' recolhivel fechado
        var title = m[3].trim() || spec.label;
        var body = lines.slice(1).join('\n');
        var close = findBlockquoteClose(tokens, i);
        if (close < 0) continue;

        var tag = fold ? 'details' : 'div';
        tokens[i].tag = tag;
        tokens[close].tag = tag;
        tokens[i].attrSet('class', 'callout callout-' + spec.kind);
        if (fold === '+') tokens[i].attrSet('open', 'open');

        var titleTag = fold ? 'summary' : 'div';
        var titleTok = new state.Token('html_block', '', 0);
        titleTok.content =
          '<' +
          titleTag +
          ' class="callout-title">' +
          svg(spec.icon) +
          '<span>' +
          state.md.renderInline(title, state.env) +
          '</span></' +
          titleTag +
          '>\n';

        if (body.trim()) {
          inline.content = body;
          inline.children = []; // forca o reparse inline com o marcador removido
          tokens.splice(i + 1, 0, titleTok);
        } else {
          tokens.splice(i + 1, 3, titleTok); // callout sem corpo: so o titulo
        }
      }
    });
  }

  // ------------------------------------------------------------- wikilinks
  // [[Nota]] [[Nota|texto]] [[Nota#secao]] [[#secao]] ![[imagem.png]]
  var MEDIA = /\.(png|jpe?g|gif|webp|svg|avif|bmp|mp4|webm|ogg|mp3|wav|m4a)$/i;

  function slugify(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
  }

  function wikilinks(md) {
    md.inline.ruler.before('link', 'wikilink', function (state, silent) {
      var src = state.src;
      var start = state.pos;
      var embed = src.charCodeAt(start) === 0x21; /* ! */
      var p = embed ? start + 1 : start;
      if (src.charCodeAt(p) !== 0x5b || src.charCodeAt(p + 1) !== 0x5b) return false;

      var end = src.indexOf(']]', p + 2);
      if (end < 0) return false;
      var raw = src.slice(p + 2, end);
      if (!raw.trim() || raw.indexOf('\n') >= 0 || raw.indexOf('[') >= 0) return false;

      var bar = raw.indexOf('|');
      var target = (bar >= 0 ? raw.slice(0, bar) : raw).trim();
      var label = (bar >= 0 ? raw.slice(bar + 1) : '').trim();

      var hash = target.indexOf('#');
      var heading = hash >= 0 ? target.slice(hash + 1).trim() : '';
      var file = (hash >= 0 ? target.slice(0, hash) : target).trim();

      // Protocolo explicito dentro de wikilink: devolve como texto, nunca como href.
      if (/^[a-z][a-z0-9+.-]*:/i.test(file)) return false;

      var href;
      if (!file) {
        href = '#' + slugify(heading); // [[#secao]] -> ancora local
      } else {
        var path = /\.[a-z0-9]{1,5}$/i.test(file) ? file : file + '.md';
        href = encodeURI(path) + (heading ? '#' + slugify(heading) : '');
      }

      if (!silent) {
        if (embed && MEDIA.test(file)) {
          var img = state.push('image', 'img', 0);
          img.attrs = [
            ['src', encodeURI(file)],
            ['alt', label || file],
            ['class', 'wikiembed'],
          ];
          img.children = [];
          img.content = label || file;
        } else {
          var open = state.push('link_open', 'a', 1);
          open.attrs = [
            ['href', href],
            ['class', 'wikilink'],
          ];
          state.push('text', '', 0).content = label || target;
          state.push('link_close', 'a', -1);
        }
      }
      state.pos = end + 2;
      return true;
    });
  }

  // ------------------------------------------------------------- ==marca==
  function highlight(md) {
    md.inline.ruler.after('emphasis', 'obsidian_mark', function (state, silent) {
      var src = state.src;
      var start = state.pos;
      if (src.charCodeAt(start) !== 0x3d || src.charCodeAt(start + 1) !== 0x3d) return false;
      var end = src.indexOf('==', start + 2);
      if (end < 0 || end === start + 2) return false;
      var content = src.slice(start + 2, end);
      if (/^\s|\s$/.test(content) || content.indexOf('\n') >= 0) return false;

      if (!silent) {
        var children = [];
        state.md.inline.parse(content, state.md, state.env, children); // permite ==**x**==
        state.push('mark_open', 'mark', 1);
        for (var k = 0; k < children.length; k++) state.tokens.push(children[k]);
        state.push('mark_close', 'mark', -1);
      }
      state.pos = end + 2;
      return true;
    });
  }

  // ----------------------------------------------------------------- #tags
  // So dispara apos inicio-de-linha ou espaco, e exige letra apos o #.
  // Evita `#5`, `pagina.com#ancora` e headings (que sao bloco, nem chegam aqui).
  function tags(md) {
    md.inline.ruler.after('obsidian_mark', 'obsidian_tag', function (state, silent) {
      var src = state.src;
      var start = state.pos;
      if (src.charCodeAt(start) !== 0x23 /* # */) return false;
      if (start > 0 && !/[\s(\[]/.test(src[start - 1])) return false;
      var m = /^#([\p{L}_][\p{L}\p{N}_/-]*)/u.exec(src.slice(start));
      if (!m) return false;

      if (!silent) {
        var open = state.push('link_open', 'a', 1);
        open.attrs = [
          ['href', '#'],
          ['class', 'md-tag'],
          ['data-tag', m[1]],
        ];
        state.push('text', '', 0).content = '#' + m[1];
        state.push('link_close', 'a', -1);
      }
      state.pos = start + m[0].length;
      return true;
    });
  }

  // ------------------------------------------------------------ task lists
  function taskLists(md) {
    md.core.ruler.after('inline', 'task_lists', function (state) {
      var tokens = state.tokens;
      for (var i = 2; i < tokens.length; i++) {
        if (tokens[i].type !== 'inline') continue;
        if (tokens[i - 1].type !== 'paragraph_open') continue;
        if (tokens[i - 2].type !== 'list_item_open') continue;

        var first = tokens[i].children && tokens[i].children[0];
        if (!first || first.type !== 'text') continue;
        var m = /^\[([ xX])\]\s+/.exec(first.content);
        if (!m) continue;

        first.content = first.content.slice(m[0].length);
        var box = new state.Token('html_inline', '', 0);
        box.content =
          '<input class="task" type="checkbox" disabled' + (m[1] === ' ' ? '' : ' checked') + '> ';
        tokens[i].children.unshift(box);
        tokens[i - 2].attrJoin('class', 'task-item');
      }
    });
  }

  // ---------------------------------------------------------- block refs ^id
  function blockRefs(md) {
    md.core.ruler.after('block', 'obsidian_blockref', function (state) {
      state.tokens.forEach(function (t) {
        if (t.type === 'inline') t.content = t.content.replace(/[ \t]+\^[\w-]+[ \t]*$/gm, '');
      });
    });
  }

  // -------------------------------------------------------- fences especiais
  // ```mermaid -> placeholder com a fonte como TEXTO do elemento. Atributos
  // data-* nao sobrevivem ao DOMPurify; texto sobrevive sempre.
  function fences(md) {
    var base =
      md.renderer.rules.fence ||
      function (t, i, o, e, self) {
        return self.renderToken(t, i, o);
      };
    md.renderer.rules.fence = function (tokens, idx, options, env, self) {
      var info = (tokens[idx].info || '').trim().split(/\s+/)[0].toLowerCase();
      var code = tokens[idx].content;
      if (info === 'mermaid') {
        return '<div class="mermaid-block">' + md.utils.escapeHtml(code) + '</div>\n';
      }
      if (info === 'math' || info === 'latex' || info === 'tex') {
        return '<div class="math-display">\\[' + escapeTex(code) + '\\]</div>\n';
      }
      return base(tokens, idx, options, env, self);
    };
  }

  // ------------------------------------------------------------- montagem
  // Unica fonte da ordem dos plugins: o content.js e os testes usam esta funcao.
  // A ordem importa - math entra antes de sub/sup, senao `$x^2$` vira <sup>.
  function createParser(settings) {
    var md = root.markdownit({
      html: true, // .md do Claude Code costuma ter <br>, <kbd>, <details>
      linkify: true,
      breaks: false,
      typographer: false,
      highlight: function (code, lang) {
        try {
          if (lang && root.hljs && root.hljs.getLanguage(lang)) {
            return root.hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
          }
        } catch (e) {
          /* cai no escape padrao do markdown-it */
        }
        return '';
      },
    });

    if (settings.math) md.use(math);
    md.use(root.markdownitSub);
    md.use(root.markdownitSup);
    md.use(root.markdownitFootnote);
    // o bundle 3.x expoe a funcao direta; versoes com variantes expoem .full
    if (settings.emoji) md.use(root.markdownitEmoji.full || root.markdownitEmoji);

    md.use(blockRefs);
    md.use(callouts);
    if (settings.wikilinks) md.use(wikilinks);
    md.use(highlight);
    if (settings.tags) md.use(tags);
    md.use(taskLists);
    md.use(fences);

    return md;
  }

  root.VladeMD = {
    splitFrontmatter: splitFrontmatter,
    parseFrontmatter: parseFrontmatter,
    slugify: slugify,
    createParser: createParser,
    plugins: {
      math: math,
      callouts: callouts,
      wikilinks: wikilinks,
      highlight: highlight,
      tags: tags,
      taskLists: taskLists,
      blockRefs: blockRefs,
      fences: fences,
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);

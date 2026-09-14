'use strict';

const DEFAULTS = {
  theme: 'system',
  toc: true,
  width: 768,
  tags: true,
  wikilinks: true,
  math: true,
  mermaid: true,
  emoji: true,
};

const FIELDS = Object.keys(DEFAULTS);
const $ = (id) => document.getElementById(id);

function load() {
  chrome.storage.sync.get(DEFAULTS, (v) => {
    const s = Object.assign({}, DEFAULTS, v);
    for (const k of FIELDS) {
      const el = $(k);
      if (!el) continue;
      if (el.type === 'checkbox') el.checked = !!s[k];
      else el.value = s[k];
    }
  });
}

function save() {
  const out = {};
  for (const k of FIELDS) {
    const el = $(k);
    if (!el) continue;
    if (el.type === 'checkbox') out[k] = el.checked;
    else if (el.type === 'number') out[k] = Math.min(1600, Math.max(480, +el.value || DEFAULTS[k]));
    else out[k] = el.value;
  }
  chrome.storage.sync.set(out, () => flash('salvo'));
}

function flash(text) {
  const el = $('status');
  el.textContent = text;
  el.classList.add('on');
  setTimeout(() => el.classList.remove('on'), 1600);
}

$('save').addEventListener('click', save);
$('reset').addEventListener('click', () => {
  chrome.storage.sync.set(DEFAULTS, () => {
    load();
    flash('padroes restaurados');
  });
});

// chrome:// nao pode ser aberto por link, entao o caminho vai copiavel.
const url = `chrome://extensions/?id=${chrome.runtime.id}`;
$('extlink').value = url;
$('copy').addEventListener('click', () => {
  navigator.clipboard.writeText(url).then(() => flash('link copiado'));
});

chrome.extension.isAllowedFileSchemeAccess((allowed) => {
  const el = $('filestatus');
  el.textContent = allowed
    ? 'Ligado - arquivos .md do seu disco ja sao renderizados.'
    : 'Desligado - arquivos file:// ainda nao serao renderizados.';
  el.style.color = allowed ? '#08b94e' : '#ec7500';
  el.style.fontWeight = '500';
});

load();

'use strict';

const url = `chrome://extensions/?id=${chrome.runtime.id}`;
document.getElementById('extlink').value = url;

document.getElementById('copy').addEventListener('click', (e) => {
  navigator.clipboard.writeText(url).then(() => {
    e.target.textContent = 'copiado';
    setTimeout(() => (e.target.textContent = 'Copiar'), 1500);
  });
});

document.getElementById('opts').addEventListener('click', () => chrome.runtime.openOptionsPage());

chrome.extension.isAllowedFileSchemeAccess((allowed) => {
  const el = document.getElementById('filestatus');
  el.textContent = allowed
    ? 'Pronto: o acesso a arquivos locais ja esta ligado.'
    : 'Status atual: desligado.';
  el.style.color = allowed ? '#08b94e' : '#ec7500';
});

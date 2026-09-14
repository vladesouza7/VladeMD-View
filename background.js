// Injeta sob demanda as libs pesadas (Mermaid ~2.5MB, MathJax ~2MB) no mesmo
// mundo isolado do content script. Sem isso, todo .md aberto pagaria o parse
// das duas mesmo sem conter diagrama ou formula.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'vmd-options') {
    chrome.runtime.openOptionsPage(); // indisponivel no content script
    return;
  }
  if (!msg || msg.type !== 'vmd-inject' || !sender.tab) return;
  const files = (msg.files || []).filter((f) => /^vendor\/[\w.-]+\.js$/.test(f));
  if (!files.length) {
    sendResponse({ ok: false, error: 'arquivo invalido' });
    return;
  }
  chrome.scripting
    .executeScript({
      target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
      files,
      world: 'ISOLATED',
    })
    .then(
      () => sendResponse({ ok: true }),
      (err) => sendResponse({ ok: false, error: String(err) })
    );
  return true; // resposta assincrona
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') chrome.tabs.create({ url: 'welcome.html' });
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// content.js — 页面侧桥接脚本（可选）
// 部分页面 CSP 严格时，scripting.executeScript 的 MAIN world 注入仍可用；
// 这个 content script 作为备用通道，通过 window.postMessage 回传存储快照。
(function () {
  const dump = (store) => {
    const out = {};
    try {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        out[k] = store.getItem(k);
      }
    } catch (e) { out.__error = String(e); }
    return out;
  };

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'PING_STORAGE') {
      sendResponse({
        ok: true,
        data: {
          url: location.href,
          origin: location.origin,
          localStorage: dump(window.localStorage),
          sessionStorage: dump(window.sessionStorage),
          documentCookie: document.cookie
        }
      });
    }
    return true;
  });
})();

// background.js — MV3 service worker
// 统一处理 Cookie / Web Storage 的读取请求。

const STORE_KEY = 'sniffer_last';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg && msg.type) {
    case 'GET_TAB':
      chrome.tabs.query({ active: true, currentWindow: true })
        .then(tabs => sendResponse(tabs[0] || null))
        .catch(e => sendResponse({ error: String(e) }));
      return true;

    case 'GET_COOKIES':
      getCookies(msg.url)
        .then(sendResponse)
        .catch(e => sendResponse({ ok: false, error: String(e) }));
      return true;

    case 'GET_ALL_COOKIES':
      // 不带 url 参数 -> 返回整个 cookie store（能看到 DevTools 面板漏掉的）
      chrome.cookies.getAll(msg.filter || {})
        .then(cookies => sendResponse({ ok: true, cookies, count: cookies.length }))
        .catch(e => sendResponse({ ok: false, error: String(e) }));
      return true;

    case 'GET_COOKIE_STORES':
      chrome.cookies.getAllCookieStores()
        .then(stores => sendResponse({ ok: true, stores }))
        .catch(e => sendResponse({ ok: false, error: String(e) }));
      return true;

    case 'GET_STORAGE':
      getStorage(msg.tabId)
        .then(sendResponse)
        .catch(e => sendResponse({ ok: false, error: String(e) }));
      return true;

    case 'SAVE_SNAPSHOT':
      chrome.storage.local.set({ [STORE_KEY]: msg.data });
      sendResponse({ ok: true });
      return true;

    case 'LOAD_SNAPSHOT':
      chrome.storage.local.get(STORE_KEY)
        .then(r => sendResponse({ ok: true, data: r[STORE_KEY] || null }))
        .catch(e => sendResponse({ ok: false, error: String(e) }));
      return true;

    case 'CLEAR_SNAPSHOT':
      chrome.storage.local.remove(STORE_KEY);
      sendResponse({ ok: true });
      return true;

    default:
      return false;
  }
});

// ---- Cookie 读取 ----------------------------------------------------------
// 读取当前页面 URL 可见的全部 cookie（含 HttpOnly / Secure / SameSite）。
async function getCookies(url) {
  if (!url || !/^https?:/i.test(url)) {
    return { ok: false, error: '当前标签页不是 http(s) 页面', cookies: [] };
  }
  const cookies = await chrome.cookies.getAll({ url });
  // 按 domain 排序，方便阅读
  cookies.sort((a, b) =>
    (a.domain + a.name).localeCompare(b.domain + b.name));
  return { ok: true, cookies, count: cookies.length };
}

// ---- Web Storage 读取 -----------------------------------------------------
// 注入到目标页面的主世界上下文，抓取 localStorage / sessionStorage。
async function getStorage(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    world: 'MAIN',
    func: () => {
      const dump = (store) => {
        const out = {};
        try {
          for (let i = 0; i < store.length; i++) {
            const k = store.key(i);
            out[k] = store.getItem(k);
          }
        } catch (e) {
          out.__error = String(e);
        }
        return out;
      };
      return {
        url: location.href,
        origin: location.origin,
        title: document.title,
        localStorage: dump(window.localStorage),
        sessionStorage: dump(window.sessionStorage),
        documentCookie: document.cookie
      };
    }
  });
  return { ok: true, data: results && results[0] ? results[0].result : null };
}

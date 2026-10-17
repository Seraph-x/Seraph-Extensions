/* CodecLens - background.js (MV3 service worker)
 * 右键菜单、快捷键、图标徽章，以及内容脚本热重载
 */

var MENU_DECODE_SELECTION = 'cl-decode-selection';
var MENU_DECODE_LINK = 'cl-decode-link';
var MENU_RESCAN = 'cl-rescan';
var MENU_REINJECT = 'cl-reinject';
var MENU_OPTIONS = 'cl-options';

/* 注入顺序必须与 manifest.content_scripts 一致 */
var CONTENT_FILES = [
  'src/lib/util.js',
  'src/lib/codecs.js',
  'src/lib/detector.js',
  'src/content/highlighter.js',
  'src/content/tooltip.js',
  'src/content/content.js'
];
var CONTENT_CSS = ['src/content/content.css'];
var WATCH_FILES = CONTENT_FILES.concat(CONTENT_CSS);
var PAGE_URLS = ['http://*/*', 'https://*/*', 'file:///*'];

/* ---------------------------------------------------------------- *
 * 右键菜单
 * ---------------------------------------------------------------- */

function createMenus() {
  try {
    chrome.contextMenus.removeAll(function () {
      chrome.contextMenus.create({
        id: MENU_DECODE_SELECTION,
        title: 'CodecLens：解码选中文本',
        contexts: ['selection']
      });
      chrome.contextMenus.create({
        id: MENU_DECODE_LINK,
        title: 'CodecLens：解码链接中的编码',
        contexts: ['link']
      });
      chrome.contextMenus.create({ id: 'cl-sep-1', type: 'separator', contexts: ['page'] });
      chrome.contextMenus.create({
        id: MENU_RESCAN,
        title: 'CodecLens：重新扫描本页',
        contexts: ['page']
      });
      chrome.contextMenus.create({
        id: MENU_REINJECT,
        title: 'CodecLens：重新注入脚本（开发用）',
        contexts: ['page']
      });
      chrome.contextMenus.create({
        id: MENU_OPTIONS,
        title: 'CodecLens：设置',
        contexts: ['page', 'action']
      });
    });
  } catch (e) {}
}

chrome.runtime.onInstalled.addListener(function (details) {
  createMenus();
  if (details && details.reason === 'install') {
    try { chrome.runtime.openOptionsPage(); } catch (e) {}
  }
});

chrome.runtime.onStartup.addListener(function () {
  createMenus();
  /* 浏览器刚起来时标签页可能还在恢复，稍等一会儿做一次兜底注入 */
  setTimeout(function () { reinjectAllTabs(true); }, 2500);
});

/* ---------------------------------------------------------------- *
 * 与标签页通信
 * ---------------------------------------------------------------- */

function sendToTab(tabId, message) {
  return new Promise(function (resolve) {
    try {
      chrome.tabs.sendMessage(tabId, message, function (res) {
        if (chrome.runtime.lastError) { resolve({ ok: false, error: chrome.runtime.lastError.message }); return; }
        resolve(res || { ok: false });
      });
    } catch (e) {
      resolve({ ok: false, error: String(e) });
    }
  });
}

function pingTab(tabId) {
  return sendToTab(tabId, { type: 'CL_PING' }).then(function (res) {
    return !!(res && res.ok && res.ready && !res.disposed);
  });
}

/* ---------------------------------------------------------------- *
 * 注入 / 重新注入
 * ---------------------------------------------------------------- */

function unloadOldInstance(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function () {
      try {
        var NS = globalThis.CodecLens;
        if (NS && typeof NS.__dispose === 'function') NS.__dispose();
        delete globalThis.CodecLens;
      } catch (e) {}
    }
  });
}

async function injectInto(tabId) {
  try {
    /* 1) 先卸载旧实例并清空命名空间 —— 否则 lib 文件顶部的
     *    "if (NS.util) return" 会让新代码整段跳过，热重载失效。 */
    await unloadOldInstance(tabId);
    /* 2) 按序重新注入全部脚本 */
    await chrome.scripting.executeScript({ target: { tabId: tabId }, files: CONTENT_FILES });
    /* 3) 样式：先移除再插入，避免重复叠加 */
    try {
      await chrome.scripting.removeCSS({ target: { tabId: tabId }, files: CONTENT_CSS });
    } catch (e) {}
    await chrome.scripting.insertCSS({ target: { tabId: tabId }, files: CONTENT_CSS });
    return true;
  } catch (e) {
    return false;
  }
}

async function listPageTabs() {
  try {
    var tabs = await chrome.tabs.query({ url: PAGE_URLS });
    return tabs || [];
  } catch (e) {
    try {
      var all = await chrome.tabs.query({});
      return (all || []).filter(function (t) {
        return t.url && /^(https?|file):/i.test(t.url);
      });
    } catch (e2) { return []; }
  }
}

async function reinjectAllTabs(onlyDead) {
  var tabs = await listPageTabs();
  var injected = 0, skipped = 0, failed = 0;
  for (var i = 0; i < tabs.length; i++) {
    var id = tabs[i].id;
    if (id == null) continue;
    if (onlyDead) {
      var alive = await pingTab(id);
      if (alive) { skipped++; continue; }
    }
    var ok = await injectInto(id);
    if (ok) injected++; else failed++;
  }
  return { total: tabs.length, injected: injected, skipped: skipped, failed: failed };
}

/* ---------------------------------------------------------------- *
 * 标签页导航自愈
 *   整页跳转时内容脚本本会重新注入，但下面几种情况会漏：
 *     · 页面在扩展安装 / 更新之前就已经打开
 *     · 单页应用（pushState / replaceState）跳转 —— 文档没换，
 *       页面里挂着的还是上一屏的扫描结果
 *     · 往返缓存（bfcache）恢复后监听被断开
 *   所以在标签页完成加载、以及被切到前台时做一次兜底检查。
 * ---------------------------------------------------------------- */

async function isAutoHeal() {
  try {
    var r = await chrome.storage.local.get({ autoHeal: true });
    return r.autoHeal !== false;
  } catch (e) { return true; }
}

async function ensureInjected(tabId) {
  if (tabId == null) return false;
  if (!(await isAutoHeal())) return false;
  if (await pingTab(tabId)) return true;
  return await injectInto(tabId);
}

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  var url = changeInfo.url || (tab && tab.url) || '';
  if (!/^(https?|file):/i.test(url)) return;
  if (changeInfo.status === 'complete') {
    /* 整页加载完成：这一页要是没接上，补注入一次 */
    ensureInjected(tabId);
    return;
  }
  if (changeInfo.url) {
    /* 同文档导航（SPA）：脚本还活着，让它清掉旧结果重新扫 */
    sendToTab(tabId, { type: 'CL_URL_CHANGED' });
  }
});

chrome.tabs.onActivated.addListener(function (info) {
  if (info && info.tabId != null) ensureInjected(info.tabId);
});

/* ---------------------------------------------------------------- *
 * 代码指纹（用于热重载检测）
 * ---------------------------------------------------------------- */

var hashCache = { at: 0, hash: null };
var HASH_TTL_MS = 1200;

function djb2(str, seed) {
  var h = seed >>> 0;
  for (var i = 0; i < str.length; i++) {
    h = (((h << 5) + h) + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

async function bundleHash() {
  var now = Date.now();
  if (hashCache.hash && now - hashCache.at < HASH_TTL_MS) return hashCache.hash;
  var h = 5381;
  for (var i = 0; i < WATCH_FILES.length; i++) {
    try {
      var url = chrome.runtime.getURL(WATCH_FILES[i]) + '?cl=' + now;
      var res = await fetch(url, { cache: 'no-store' });
      var text = await res.text();
      h = djb2(WATCH_FILES[i] + ':' + text.length + ':' + text, h);
    } catch (e) {
      h = djb2(WATCH_FILES[i] + ':ERR', h);
    }
  }
  var hex = ('0000000' + h.toString(16)).slice(-8);
  hashCache = { at: now, hash: hex };
  return hex;
}

async function isDevWatch() {
  try {
    var r = await chrome.storage.local.get({ devWatch: false });
    return !!r.devWatch;
  } catch (e) { return false; }
}

/* ---------------------------------------------------------------- *
 * 右键菜单
 * ---------------------------------------------------------------- */

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (!tab || tab.id == null) return;
  if (info.menuItemId === MENU_OPTIONS) {
    try { chrome.runtime.openOptionsPage(); } catch (e) {}
    return;
  }
  if (info.menuItemId === MENU_RESCAN) {
    sendToTab(tab.id, { type: 'CL_RESCAN' });
    return;
  }
  if (info.menuItemId === MENU_REINJECT) {
    injectInto(tab.id);
    return;
  }
  if (info.menuItemId === MENU_DECODE_SELECTION) {
    var text = (info.selectionText || '').trim();
    if (!text) return;
    sendToTab(tab.id, { type: 'CL_DECODE_TEXT', text: text }).then(function (res) {
      if (!res || !res.ok) {
        try {
          chrome.tabs.create({ url: chrome.runtime.getURL('src/popup/popup.html?text=' + encodeURIComponent(text)) });
        } catch (e) {}
      }
    });
    return;
  }
  if (info.menuItemId === MENU_DECODE_LINK) {
    var url = info.linkUrl || '';
    var m = url.match(/[?&](?:url|u|target|redirect|to|link|r)=([^&]+)/i);
    var candidate = m ? decodeURIComponent(m[1]) : url;
    sendToTab(tab.id, { type: 'CL_DECODE_TEXT', text: candidate });
    return;
  }
});

/* ---------------------------------------------------------------- *
 * 快捷键
 * ---------------------------------------------------------------- */

chrome.commands.onCommand.addListener(function (command) {
  if (command === 'toggle-scan') {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || !tabs[0] || tabs[0].id == null) return;
      sendToTab(tabs[0].id, { type: 'CL_TOGGLE_ENABLED' }).then(function (res) {
        if (res && typeof res.enabled === 'boolean') {
          setBadge(tabs[0].id, res.enabled ? '' : 'off', res.enabled ? '#1f6feb' : '#6e7681');
        }
      });
    });
    return;
  }
  if (command === 'reload-pages') {
    reinjectAllTabs(false);
  }
});

/* ---------------------------------------------------------------- *
 * 徽章
 * ---------------------------------------------------------------- */

function setBadge(tabId, text, color) {
  try {
    chrome.action.setBadgeText({ tabId: tabId, text: String(text || '') });
    if (color) chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: color });
  } catch (e) {}
}

/* ---------------------------------------------------------------- *
 * 消息总线
 * ---------------------------------------------------------------- */

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || !msg.type) return;
  var tabId = sender && sender.tab && sender.tab.id;

  if (msg.type === 'CL_BADGE') {
    if (tabId == null) return;
    var n = Number(msg.count) || 0;
    if (n > 0) setBadge(tabId, n > 999 ? '999+' : String(n), '#1f6feb');
    else setBadge(tabId, '', '#1f6feb');
    return;
  }

  if (msg.type === 'CL_DEV_PING') {
    (async function () {
      var watch = await isDevWatch();
      if (!watch) { sendResponse({ ok: true, watch: false }); return; }
      var hash = await bundleHash();
      sendResponse({ ok: true, watch: true, hash: hash });
    })();
    return true;
  }

  if (msg.type === 'CL_REINJECT_ME') {
    (async function () {
      var ok = (tabId != null) ? await injectInto(tabId) : false;
      sendResponse({ ok: ok });
    })();
    return true;
  }

  if (msg.type === 'CL_REINJECT_ALL') {
    (async function () {
      var r = await reinjectAllTabs(false);
      sendResponse(Object.assign({ ok: true }, r));
    })();
    return true;
  }

  if (msg.type === 'CL_GET_DEV_INFO') {
    (async function () {
      var watch = await isDevWatch();
      var autoHeal = await isAutoHeal();
      var hash = await bundleHash();
      var tabs = await listPageTabs();
      var alive = 0;
      for (var i = 0; i < tabs.length && i < 40; i++) {
        if (tabs[i].id == null) continue;
        if (await pingTab(tabs[i].id)) alive++;
      }
      sendResponse({
        ok: true,
        version: chrome.runtime.getManifest().version,
        hash: hash,
        watch: watch,
        autoHeal: autoHeal,
        tabCount: tabs.length,
        aliveCount: alive
      });
    })();
    return true;
  }

  if (msg.type === 'CL_SET_DEV_WATCH') {
    (async function () {
      try {
        await chrome.storage.local.set({ devWatch: !!msg.value });
        hashCache = { at: 0, hash: null };
        sendResponse({ ok: true, watch: !!msg.value });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  if (msg.type === 'CL_SET_AUTO_HEAL') {
    (async function () {
      try {
        await chrome.storage.local.set({ autoHeal: !!msg.value });
        sendResponse({ ok: true, autoHeal: !!msg.value });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  if (msg.type === 'CL_RELOAD_EXTENSION') {
    sendResponse({ ok: true });
    try {
      chrome.storage.session.set({ pendingReinject: true }, function () {
        setTimeout(function () { chrome.runtime.reload(); }, 150);
      });
    } catch (e) {
      setTimeout(function () { chrome.runtime.reload(); }, 150);
    }
    return true;
  }
});

/* ---------------------------------------------------------------- *
 * 启动恢复：扩展被重载后，把打开着的页面重新接上
 * ---------------------------------------------------------------- */

(async function bootRecover() {
  try {
    var s = await chrome.storage.session.get({ pendingReinject: false });
    if (s && s.pendingReinject) {
      await chrome.storage.session.set({ pendingReinject: false });
      setTimeout(function () { reinjectAllTabs(true); }, 900);
    }
  } catch (e) {}
})();

/*!
 * background.js —— MV3 service worker：统一抓取 / 缓存汇率，供 content script 与 popup 使用
 */
importScripts('lib/rates.js');

var CACHE_KEY = 'cc:rates';
var mem = null;

var storage = {
  get: function (key, def) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(key, function (o) {
          if (chrome.runtime.lastError) return resolve(def);
          resolve(o && o[key] !== undefined ? o[key] : def);
        });
      } catch (e) { resolve(def); }
    });
  },
  set: function (key, val) {
    return new Promise(function (resolve) {
      try { var o = {}; o[key] = val; chrome.storage.local.set(o, resolve); }
      catch (e) { resolve(); }
    });
  }
};

function httpJson(url) {
  return fetch(url, { credentials: 'omit', cache: 'no-cache' }).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
}

var store = CurrencyRates.createRateStore({ http: httpJson, storage: storage });
var inflight = null;

function getRates(opts) {
  if (inflight) return inflight;
  inflight = store.load(opts).then(function (d) { inflight = null; return d; },
    function (e) { inflight = null; throw e; });
  return inflight;
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || typeof msg.type !== 'string') return;

  if (msg.type === 'cc:rates') {
    getRates({ force: !!msg.force, ttlHours: msg.ttlHours || 6, source: msg.source || 'auto' })
      .then(function (data) { sendResponse({ ok: !!data, data: data }); })
      .catch(function (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); });
    return true;
  }

  if (msg.type === 'cc:clear-cache') {
    store.clear().then(function () { sendResponse({ ok: true }); });
    return true;
  }

  if (msg.type === 'cc:diagnose') {
    getRates({ force: false, ttlHours: 1, source: 'auto' }).then(function (d) {
      sendResponse({
        ok: true,
        sources: CurrencyRates.SOURCES.map(function (s) { return s.id + ' (' + s.label + ')'; }),
        got: d ? { source: d.source, date: d.date, fetchedAt: d.fetchedAt, stale: !!d.stale, count: Object.keys(d.rates || {}).length } : null
      });
    });
    return true;
  }

  if (msg.type === 'cc:broadcast' && msg.settings) {
    chrome.tabs.query({}, function (tabs) {
      tabs.forEach(function (t) {
        if (!t.id) return;
        chrome.tabs.sendMessage(t.id, { type: 'cc:apply', settings: msg.settings, reset: !!msg.reset, force: !!msg.force }, function () {
          void chrome.runtime.lastError;
        });
      });
    });
    sendResponse({ ok: true });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(function () {
  /* 安装后预热一次汇率缓存 */
  getRates({ force: false, ttlHours: 6, source: 'auto' }).catch(function () {});
});

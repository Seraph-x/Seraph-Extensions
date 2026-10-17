/*!
 * CurrencyRates -- 实时汇率获取 + 缓存（多源自动降级）
 * 依赖注入：{ http(url)->Promise<json>, storage:{get,set} }
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') module.exports = factory();
  else root.CurrencyRates = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CACHE_KEY = 'cc:rates';
  var HOUR = 3600 * 1000;

  function num(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : null; }

  /* ---- 各家返回格式归一化：{ base, date, rates:{CODE:perUSD} } ---- */
  function parseFawaz(j) {
    var src = j && j.usd;
    if (!src || typeof src !== 'object') throw new Error('bad payload');
    var rates = { USD: 1 }, k, c, v;
    for (k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      c = String(k).toUpperCase();
      if (!/^[A-Z]{3,4}$/.test(c)) continue;
      v = num(src[k]);
      if (v) rates[c] = v;
    }
    if (Object.keys(rates).length < 10) throw new Error('too few rates');
    return { base: 'USD', date: j.date || '', rates: rates };
  }

  function parseErApi(j) {
    if (!j || !j.rates) throw new Error('bad payload');
    var rates = { USD: 1 }, k, c, v;
    for (k in j.rates) {
      if (!Object.prototype.hasOwnProperty.call(j.rates, k)) continue;
      c = String(k).toUpperCase();
      v = num(j.rates[k]);
      if (v && /^[A-Z]{3,4}$/.test(c)) rates[c] = v;
    }
    if (Object.keys(rates).length < 10) throw new Error('too few rates');
    return { base: 'USD', date: j.time_last_update_utc || '', rates: rates };
  }

  function parseFrankfurter(j) {
    if (!j || !j.rates) throw new Error('bad payload');
    var rates = { USD: 1 }, k, v;
    for (k in j.rates) {
      if (!Object.prototype.hasOwnProperty.call(j.rates, k)) continue;
      v = num(j.rates[k]);
      if (v) rates[String(k).toUpperCase()] = v;
    }
    if (j.base && j.base !== 'USD' && rates[j.base]) {
      // 把 base 归一到 USD
      var b = rates[j.base], kk;
      for (kk in rates) rates[kk] = rates[kk] / b;
      rates.USD = 1;
    }
    if (Object.keys(rates).length < 10) throw new Error('too few rates');
    return { base: 'USD', date: j.date || '', rates: rates };
  }

  var SOURCES = [
    { id: 'jsdelivr', label: 'currency-api (jsDelivr CDN)', url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', parse: parseFawaz },
    { id: 'cf-pages', label: 'currency-api (Cloudflare)', url: 'https://latest.currency-api.pages.dev/v1/currencies/usd.json', parse: parseFawaz },
    { id: 'er-api', label: 'open.er-api.com', url: 'https://open.er-api.com/v6/latest/USD', parse: parseErApi },
    { id: 'frankfurter', label: 'frankfurter.app (ECB)', url: 'https://api.frankfurter.app/latest?from=USD', parse: parseFrankfurter }
  ];

  function createRateStore(cfg) {
    cfg = cfg || {};
    var http = cfg.http;
    var storage = cfg.storage;
    var memory = null;

    function isFresh(c, ttlHours) {
      if (!c || !c.rates || !c.fetchedAt) return false;
      return (Date.now() - c.fetchedAt) < ttlHours * HOUR;
    }

    function readCache() {
      return storage.get(CACHE_KEY, null).then(function (c) {
        if (c && c.rates) memory = c;
        return c || memory;
      });
    }

    function writeCache(c) {
      memory = c;
      return storage.set(CACHE_KEY, c);
    }

    function fetchOne(src) {
      return http(src.url).then(function (json) {
        var out = src.parse(json);
        out.source = src.id;
        out.sourceLabel = src.label;
        out.fetchedAt = Date.now();
        return out;
      });
    }

    /**
     * 取汇率。opts: { force, ttlHours, source, onFallback }
     * 返回 { base, date, rates, source, fetchedAt, stale? }
     */
    function load(opts) {
      opts = opts || {};
      var ttl = opts.ttlHours == null ? 6 : opts.ttlHours;
      var srcId = opts.source || 'auto';
      return readCache().then(function (cached) {
        if (!opts.force && cached && isFresh(cached, ttl) && (srcId === 'auto' || cached.source === srcId)) {
          return cached;
        }
        var list = SOURCES.slice();
        if (srcId && srcId !== 'auto') {
          list = list.filter(function (s) { return s.id === srcId; }).concat(list.filter(function (s) { return s.id !== srcId; }));
        }
        var errors = [];
        function tryAt(i) {
          if (i >= list.length) {
            if (cached) { var stale = Object.assign({}, cached, { stale: true }); return stale; }
            throw new Error('all sources failed: ' + errors.join(' | '));
          }
          return fetchOne(list[i]).then(function (out) {
            /* 注意：writeCache 返回 storage.set 的 Promise（值可能是 undefined），
               必须显式把解析结果传下去，否则 load() 会 resolve 成 undefined */
            return Promise.resolve(writeCache(out)).then(function () { return out; });
          }).catch(function (e) {
            errors.push(list[i].id + ': ' + (e && e.message ? e.message : e));
            return tryAt(i + 1);
          });
        }
        return tryAt(0);
      }).catch(function (e) {
        if (memory) return Object.assign({}, memory, { stale: true, error: String(e) });
        return null;
      });
    }

    function clear() { memory = null; return Promise.resolve(storage.set(CACHE_KEY, null)).then(function () { return true; }); }

    return { load: load, clear: clear, sources: SOURCES, CACHE_KEY: CACHE_KEY, isFresh: isFresh };
  }

  return { createRateStore: createRateStore, SOURCES: SOURCES, parseFawaz: parseFawaz, parseErApi: parseErApi, parseFrankfurter: parseFrankfurter };
});

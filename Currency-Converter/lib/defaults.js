/*!
 * CurrencyDefaults -- 默认设置 / 站点匹配 / 常用币种
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') module.exports = factory();
  else root.CurrencyDefaults = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DEFAULTS = {
    enabled: true,
    target: 'CNY',
    displayMode: 'replace',      // replace | append | tooltip（默认就是“替换原文”）
    modeTouched: false,          // 用户是否在弹窗/面板里手动选过显示方式
    decimals: 'auto',
    compact: false,
    symbolStyle: 'symbol',       // symbol | code | both
    highlight: true,
    showTitle: true,
    convertSameCurrency: false,
    convertBare: false,
    bareCurrency: 'USD',
    minAmount: 0,
    maxAmount: 0,
    currencyOverride: {},
    blacklist: [],
    whitelist: [],
    siteMode: 'all',             // all | whitelist
    panelCollapsed: false,       // 面板是否收起为小胶囊
    ttlHours: 6,
    source: 'auto',
    maxNodes: 0,
    allowed: true
  };

  var COMMON = ['CNY', 'USD', 'EUR', 'JPY', 'GBP', 'HKD', 'TWD', 'KRW', 'SGD', 'AUD', 'CAD',
    'CHF', 'NZD', 'RUB', 'THB', 'MYR', 'INR', 'IDR', 'VND', 'PHP', 'BRL', 'MXN', 'SEK', 'NOK',
    'DKK', 'PLN', 'CZK', 'HUF', 'TRY', 'ZAR', 'AED', 'SAR', 'ILS', 'EGP', 'NGN', 'USDT', 'BTC'];

  /* 支持 example.com / *.example.com / sub.example.com */
  function hostMatches(host, patterns) {
    if (!host || !patterns || !patterns.length) return false;
    host = String(host).toLowerCase();
    for (var i = 0; i < patterns.length; i++) {
      var p = String(patterns[i] || '').trim().toLowerCase();
      if (!p) continue;
      if (p.charAt(0) === '*') {
        var suffix = p.replace(/^\*+/, '');
        if (host.slice(-suffix.length) === suffix) return true;
      } else if (p.indexOf('://') >= 0) {
        try { if (new URL(p).hostname === host) return true; } catch (e) { /* ignore */ }
      } else if (host === p) {
        return true;
      } else if (host.slice(-(p.length + 1)) === '.' + p) {
        return true;
      }
    }
    return false;
  }

  function siteAllowed(settings, host) {
    if (!settings || settings.enabled === false) return false;
    if (hostMatches(host, settings.blacklist)) return false;
    if (settings.siteMode === 'whitelist') return hostMatches(host, settings.whitelist);
    return true;
  }

  var MODES = ['replace', 'append', 'tooltip'];

  /* 归一化：显示方式默认「替换原文」——没手动选过就强制回默认，避免旧设置把页面改成追加模式 */
  function normalize(s) {
    var out = merge(DEFAULTS, s || {});
    if (MODES.indexOf(out.displayMode) < 0 || !out.modeTouched) out.displayMode = 'replace';
    return out;
  }

  function merge(base, patch) {
    var out = {}, k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    for (k in patch) if (patch[k] !== undefined) out[k] = patch[k];
    return out;
  }

  return { DEFAULTS: DEFAULTS, COMMON: COMMON, MODES: MODES, hostMatches: hostMatches, siteAllowed: siteAllowed, merge: merge, normalize: normalize };
});

/*!
 * CurrencyBus -- 跨执行环境单实例选举 + 设置/动作广播
 *
 * 背景：Chrome 的 content script（扩展）与用户脚本各自跑在独立的 isolated world，
 * window 上挂的标记互相看不见，但 **DOM 属性与 DOM 事件是共享的**。
 * 于是：用 <html data-cc-host> 做选举（带心跳，超时视为已死可接管），
 * 用 document 上的 CustomEvent 广播设置/动作；detail 一律传 JSON 字符串，
 * 避免跨世界读不到对象的问题。
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') module.exports = factory();
  else root.CurrencyBus = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ATTR = 'data-cc-host';
  var BEAT = 4000;      // 心跳间隔
  var STALE = 12000;    // 超过这个时间没心跳，视为旧实例已死，可以接管
  var EV_SETTINGS = 'cc:settings';
  var EV_ACTION = 'cc:action';
  var STATS_ATTR = 'data-cc-stats';  // 主实例把运行状态写在这里，弹窗（另一个执行环境）也能读到

  function createBus(cfg) {
    cfg = cfg || {};
    var doc = cfg.doc || document;
    var win = cfg.win || window;
    var kind = cfg.kind || 'page';
    var id = cfg.id || (kind + '-' + Math.random().toString(36).slice(2, 9));
    var owner = false;
    var timer = null;

    function now() { return Date.now(); }

    function readHost() {
      try {
        var raw = doc.documentElement && doc.documentElement.getAttribute(ATTR);
        if (!raw) return null;
        var info = JSON.parse(raw);
        return info && info.id ? info : null;
      } catch (e) { return null; }
    }

    function writeHost() {
      try {
        doc.documentElement.setAttribute(ATTR, JSON.stringify({ id: id, kind: kind, ts: now() }));
      } catch (e) { /* ignore */ }
    }

    /* 抢主：没有活着的实例就自己上，否则退让 */
    function claim() {
      var cur = readHost();
      if (cur && cur.id !== id && (now() - (cur.ts || 0)) < STALE) { owner = false; return false; }
      owner = true;
      writeHost();
      if (!timer && typeof win.setInterval === 'function') timer = win.setInterval(writeHost, BEAT);
      return true;
    }

    function release() {
      if (timer && typeof win.clearInterval === 'function') win.clearInterval(timer);
      timer = null;
      var cur = readHost();
      if (owner && cur && cur.id === id) {
        try { doc.documentElement.removeAttribute(ATTR); } catch (e) { /* ignore */ }
        try { doc.documentElement.removeAttribute(STATS_ATTR); } catch (e) { /* ignore */ }
      }
      owner = false;
    }

    /* 运行状态：写 / 读 <html data-cc-stats>，让弹窗能显示"已换算 N 处" */
    function writeStats(obj) {
      try { doc.documentElement.setAttribute(STATS_ATTR, JSON.stringify(obj || {})); } catch (e) { /* ignore */ }
    }

    function readStats() {
      try {
        var raw = doc.documentElement && doc.documentElement.getAttribute(STATS_ATTR);
        if (!raw) return null;
        var info = JSON.parse(raw);
        return info && typeof info === 'object' ? info : null;
      } catch (e) { return null; }
    }

    function dispatch(name, payload) {
      try {
        var ev = new win.CustomEvent(name, { detail: JSON.stringify(payload == null ? {} : payload) });
        doc.dispatchEvent(ev);
        return true;
      } catch (e) { return false; }
    }

    function parse(e) {
      try { return JSON.parse((e && e.detail) || '{}'); } catch (x) { return {}; }
    }

    function emitSettings(patch) { return dispatch(EV_SETTINGS, patch || {}); }
    function emitAction(name, value) { return dispatch(EV_ACTION, { name: name, value: value }); }

    function onSettings(fn) {
      if (typeof fn !== 'function') return;
      doc.addEventListener(EV_SETTINGS, function (e) {
        var d = parse(e);
        if (!d || typeof d !== 'object') return;
        /* 单个监听器抛错不能拖垮广播（否则另一个实例就收不到设置了） */
        try { fn(d); } catch (x) { /* ignore */ }
      });
    }

    function onAction(fn) {
      if (typeof fn !== 'function') return;
      doc.addEventListener(EV_ACTION, function (e) {
        var d = parse(e);
        try { fn(d.name, d.value); } catch (x) { /* ignore */ }
      });
    }

    return {
      id: id,
      kind: kind,
      claim: claim,
      release: release,
      isOwner: function () { return owner; },
      readHost: readHost,
      emitSettings: emitSettings,
      emitAction: emitAction,
      onSettings: onSettings,
      onAction: onAction,
      writeStats: writeStats,
      readStats: readStats,
      ATTR: ATTR,
      STATS_ATTR: STATS_ATTR
    };
  }

  return { createBus: createBus, ATTR: ATTR, STATS_ATTR: STATS_ATTR, BEAT: BEAT, STALE: STALE,
    EV_SETTINGS: EV_SETTINGS, EV_ACTION: EV_ACTION };
});

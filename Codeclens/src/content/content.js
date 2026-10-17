/* CodecLens - content.js
 * 页面侧主流程：扫描 -> 高亮 -> 交互 -> 响应消息
 * 支持热重载：重复注入时先卸载上一个实例（见 NS.__dispose）
 */
(function () {
  'use strict';

  var NS = globalThis.CodecLens;
  if (!NS || !NS.detector) return;

  /* ---- 热重载：若已存在上一个实例，先彻底卸载 ---- */
  if (typeof NS.__dispose === 'function') {
    try { NS.__dispose(); } catch (e) {}
  }
  NS.__contentLoaded = true;

  var U = NS.util;
  var D = NS.detector;
  var HL = NS.highlighter;
  var TIP = NS.tooltip;

  var settings = U.clone(U.DEFAULT_SETTINGS);
  var entries = [];
  var replacedNodes = [];
  var scanning = false;
  var scanQueued = false;
  var observer = null;
  var stats = { nodes: 0, hits: 0, ms: 0, lastScan: 0 };
  var disposed = false;

  var MAX_NODES = 60000;
  var MAX_TEXT_LEN = 400000;
  var SELF_MUTATION_MS = 400;
  var lastSelfMutation = 0;
  var lastFingerprint = '';
  var forceRender = true;

  var devTimer = null;
  var knownHash = null;
  var DEV_INTERVAL_MS = 4000;

  var lastUrl = location.href;
  var urlTimer = null;
  var URL_POLL_MS = 600;
  var lastScanReason = '';

  /* ================================================================ *
   * 可见性 / 可扫描性
   * ================================================================ */

  var SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, OPTION: 1,
    CANVAS: 1, SVG: 1, MATH: 1, TEMPLATE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1
  };

  var visibilityCache = new WeakMap();

  function isVisible(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (visibilityCache.has(el)) return visibilityCache.get(el);
    var result = true;
    try {
      var style = window.getComputedStyle(el);
      if (!style || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
        result = false;
      } else if (style.opacity === '0') {
        result = false;
      }
    } catch (e) {
      result = true;
    }
    visibilityCache.set(el, result);
    return result;
  }

  function isScanTarget(node) {
    var text = node.nodeValue;
    if (!text || text.length < Math.max(6, settings.minLength || 12)) return false;
    var parent = node.parentElement;
    if (!parent) return false;
    if (SKIP_TAGS[parent.tagName]) return false;
    if (settings.skipCodeBlocks) {
      var anc = parent.closest && parent.closest('pre, code, .highlight, .hljs');
      if (anc) return false;
    }
    if (parent.closest && parent.closest('[data-codeclens]')) return false;
    if (parent.isContentEditable) return false;
    return isVisible(parent);
  }

  /* ================================================================ *
   * 收集文本节点（含 open shadow root）
   * ================================================================ */

  function collectRoots() {
    var roots = [];
    var base = document.body || document.documentElement;
    if (!base) return roots;
    roots.push(base);
    if (!settings.scanShadow) return roots;

    var queue = [base];
    var found = 0;
    while (queue.length && found < 300) {
      var host = queue.shift();
      var all;
      try { all = host.querySelectorAll('*'); } catch (e) { continue; }
      for (var i = 0; i < all.length; i++) {
        var sr = all[i].shadowRoot;
        if (sr && roots.indexOf(sr) < 0) {
          roots.push(sr);
          queue.push(sr);
          if (++found >= 300) break;
        }
      }
    }
    return roots;
  }

  function collectTextNodes() {
    var nodes = [];
    var roots = collectRoots();
    var guard = 0;
    for (var r = 0; r < roots.length; r++) {
      var walker;
      try {
        walker = document.createTreeWalker(roots[r], NodeFilter.SHOW_TEXT, {
          acceptNode: function (node) {
            return isScanTarget(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          }
        });
      } catch (e) { continue; }
      while (walker.nextNode()) {
        nodes.push(walker.currentNode);
        if (++guard >= MAX_NODES) return nodes;
      }
    }
    return nodes;
  }

  /* ================================================================ *
   * 扫描
   * ================================================================ */

  function fingerprint(list) {
    var parts = [String(list.length)];
    for (var i = 0; i < list.length && i < 400; i++) {
      parts.push(list[i].hit.type + ',' + list[i].start + ',' + list[i].end);
    }
    return parts.join(';');
  }

  function scan() {
    if (disposed) return;
    if (scanning) { scanQueued = true; return; }
    scanning = true;
    var t0 = performance.now();

    if (!settings.enabled || settings.mode === 'off' ||
        U.hostMatchesBlacklist(location.hostname, settings.blacklist)) {
      clearAll();
      scanning = false;
      return;
    }

    visibilityCache = new WeakMap();
    var nodes = collectTextNodes();
    var out = [];
    var i = 0;

    function step() {
      if (disposed) { scanning = false; return; }
      var end = Math.min(i + 400, nodes.length);
      for (; i < end; i++) {
        var node = nodes[i];
        var text = node.nodeValue;
        if (!text) continue;
        if (text.length > MAX_TEXT_LEN) text = text.slice(0, MAX_TEXT_LEN);
        var hits;
        try { hits = D.detectText(text, settings); } catch (e) { hits = []; }
        for (var k = 0; k < hits.length; k++) {
          out.push({ node: node, start: hits[k].start, end: hits[k].end, hit: hits[k] });
        }
      }
      if (i < nodes.length) {
        schedule(step);
      } else {
        entries = out;
        stats.nodes = nodes.length;
        stats.hits = out.length;
        stats.ms = Math.round(performance.now() - t0);
        stats.lastScan = Date.now();
        var fp = fingerprint(out);
        if (fp !== lastFingerprint || forceRender) {
          lastFingerprint = fp;
          forceRender = false;
          render();
        }
        scanning = false;
        if (scanQueued) { scanQueued = false; scan(); }
      }
    }
    step();
  }

  function schedule(fn) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(fn, { timeout: 60 });
    } else {
      setTimeout(fn, 0);
    }
  }

  function render() {
    HL.render(entries);
    applyReplacement();
    updateBadge();
  }

  function clearAll() {
    entries = [];
    lastFingerprint = '';
    forceRender = true;
    HL.clear();
    clearReplacement();
    updateBadge();
  }

  function updateBadge() {
    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'CL_BADGE', count: entries.length });
      }
    } catch (e) {}
  }

  /* ================================================================ *
   * 追加（"替换"）模式
   * ================================================================ */

  function applyReplacement() {
    clearReplacement();
    if (settings.mode !== 'replace') return;
    lastSelfMutation = Date.now();

    var byNode = new Map();
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!byNode.has(e.node)) byNode.set(e.node, []);
      byNode.get(e.node).push(e);
    }
    byNode.forEach(function (list, node) {
      list.sort(function (a, b) { return b.end - a.end; });
      for (var k = 0; k < list.length; k++) {
        var it = list[k];
        try {
          var chain = (it.hit.chain && it.hit.chain.length) ? it.hit.chain : [it.hit];
          var finalText = chain[chain.length - 1].text || '';
          var span = document.createElement('span');
          span.className = 'cl-replaced';
          span.setAttribute('data-codeclens', 'replacement');
          span.textContent = ' \u2192 ' + U.truncate(finalText.replace(/\s+/g, ' '), 160);
          span.title = finalText;
          var r = document.createRange();
          r.setStart(node, it.end);
          r.setEnd(node, it.end);
          r.insertNode(span);
          replacedNodes.push(span);
        } catch (err) {}
      }
    });
    lastSelfMutation = Date.now();
  }

  function clearReplacement() {
    if (replacedNodes.length) lastSelfMutation = Date.now();
    for (var i = 0; i < replacedNodes.length; i++) {
      var span = replacedNodes[i];
      try {
        if (span.parentNode) {
          span.parentNode.removeChild(span);
          span.parentNode.normalize();
        }
      } catch (e) {}
    }
    replacedNodes = [];
    lastSelfMutation = Date.now();
  }

  /* ================================================================ *
   * 交互
   * ================================================================ */

  var CLICK_SUPPRESS_MS = 250;
  var lastClickAt = 0;

  function onClick(ev) {
    if (disposed) return;
    if (Date.now() - lastClickAt < CLICK_SUPPRESS_MS) return;
    var path = ev.composedPath ? ev.composedPath() : [];
    for (var i = 0; i < path.length; i++) {
      var n = path[i];
      if (n === TIP) break;
      if (n && n.getAttribute && n.getAttribute('data-codeclens')) return;
    }
    if (TIP.containsNode(ev.target)) return;

    var entry = HL.hitTest(ev.clientX, ev.clientY);
    if (entry) {
      ev.preventDefault();
      ev.stopPropagation();
      lastClickAt = Date.now();
      TIP.hide();
      HL.clearActive();
      HL.markActive(entry);
      TIP.show(entry.hit, ev.clientX, ev.clientY);
      return;
    }
    if (TIP.isOpen()) TIP.hide();
  }

  /* ================================================================ *
   * 动态页面监听
   * ================================================================ */

  function onDomChange() {
    if (disposed) return;
    if (!settings.enabled || !settings.scanDynamic) return;
    if (Date.now() - lastSelfMutation < SELF_MUTATION_MS) return;
    scan();
  }

  var debouncedDomChange = U.debounce(onDomChange, 700);

  function startObserver() {
    if (observer) { try { observer.disconnect(); } catch (e) {} observer = null; }
    if (!settings.scanDynamic || !document.body) return;
    observer = new MutationObserver(function (muts) {
      if (disposed) return;
      if (Date.now() - lastSelfMutation < SELF_MUTATION_MS) return;
      for (var i = 0; i < muts.length; i++) {
        var t = muts[i].target;
        if (t && t.closest && t.closest('[data-codeclens]')) continue;
        debouncedDomChange();
        return;
      }
    });
    try {
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e) {}
  }

  /* ================================================================ *
   * 热重载轮询（仅在设置页开启「自动热重载」时生效）
   * ================================================================ */

  function showStaleNotice() {
    try {
      if (document.getElementById('codeclens-stale')) return;
      var d = document.createElement('div');
      d.id = 'codeclens-stale';
      d.setAttribute('data-codeclens', 'notice');
      d.textContent = 'CodecLens 已更新，按 F5 刷新本页即可恢复扫描';
      d.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:24px;z-index:2147483647;' +
        'background:#1f6feb;color:#fff;font:13px/1.5 -apple-system,system-ui,sans-serif;' +
        'padding:8px 16px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.35);';
      document.documentElement.appendChild(d);
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 8000);
    } catch (e) {}
  }

  function stopDevWatch() {
    if (devTimer) { clearInterval(devTimer); devTimer = null; }
  }

  function startDevWatch() {
    if (devTimer || disposed) return;
    devTimer = setInterval(function () {
      if (disposed) { stopDevWatch(); return; }
      try {
        chrome.runtime.sendMessage({ type: 'CL_DEV_PING', hash: knownHash }, function (res) {
          if (chrome.runtime.lastError) {
            var m = String(chrome.runtime.lastError.message || '');
            stopDevWatch();
            if (m.indexOf('invalidated') >= 0 || m.indexOf('Receiving end') >= 0) showStaleNotice();
            return;
          }
          if (!res || !res.ok || !res.watch) return;
          if (knownHash && res.hash && res.hash !== knownHash) {
            try { chrome.runtime.sendMessage({ type: 'CL_REINJECT_ME' }); } catch (e) {}
          }
          knownHash = res.hash;
        });
      } catch (e) {
        stopDevWatch();
        showStaleNotice();
      }
    }, DEV_INTERVAL_MS);
  }

  /* ================================================================ *
   * 消息
   * ================================================================ */

  function summarize() {
    var out = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var chain = (e.hit.chain && e.hit.chain.length) ? e.hit.chain : [e.hit];
      out.push({
        index: i,
        type: e.hit.type,
        label: e.hit.label,
        score: Math.round(Math.min(100, Math.max(0, e.hit.score || 0))),
        raw: e.hit.raw,
        text: chain[chain.length - 1].text || '',
        depth: chain.length,
        compression: (e.hit.meta && e.hit.meta.compression) || null
      });
    }
    return out;
  }

  function scrollToIndex(index) {
    var e = entries[index];
    if (!e) return false;
    try {
      var r = document.createRange();
      r.setStart(e.node, e.start);
      r.setEnd(e.node, e.end);
      var rect = r.getBoundingClientRect();
      var target = rect.top + window.scrollY - window.innerHeight / 2;
      window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
      HL.clearActive();
      HL.markActive(e);
      setTimeout(function () {
        if (disposed) return;
        TIP.hide();
        TIP.show(e.hit, Math.min(window.innerWidth - 40, Math.max(20, rect.left)), Math.max(80, rect.top + rect.height / 2));
      }, 320);
      return true;
    } catch (err) { return false; }
  }

  function showTextResult(text, x, y) {
    var results = D.decodeAny(text, settings);
    var px = (typeof x === 'number') ? x : window.innerWidth / 2 - 200;
    var py = (typeof y === 'number') ? y : 120;
    if (!results.length) {
      TIP.show({
        type: 'unknown',
        label: '未识别',
        score: 0,
        raw: text,
        text: '未匹配到已知编码格式。可尝试在扩展弹窗中手动指定解码器。',
        chain: []
      }, px, py);
      return { ok: false, count: 0 };
    }
    TIP.show(results[0], px, py);
    return { ok: true, count: results.length, results: results.map(function (r) { return r.label; }) };
  }

  function onMessage(msg, sender, sendResponse) {
    if (disposed || !msg || !msg.type) return;
    switch (msg.type) {
      case 'CL_PING':
        sendResponse({ ok: true, ready: true, disposed: false, url: location.href, reason: lastScanReason });
        return true;
      case 'CL_GET_RESULTS':
        sendResponse({
          ok: true,
          results: summarize(),
          stats: stats,
          settings: { mode: settings.mode, enabled: settings.enabled, highlightApi: HL.supportsHighlightApi }
        });
        return true;
      case 'CL_RESCAN':
        forceRender = true;
        scan();
        sendResponse({ ok: true });
        return true;
      case 'CL_SCROLL_TO':
        sendResponse({ ok: scrollToIndex(msg.index) });
        return true;
      case 'CL_DECODE_TEXT':
        sendResponse(showTextResult(msg.text, msg.x, msg.y));
        return true;
      case 'CL_SETTINGS_UPDATED':
        settings = U.mergeSettings(msg.settings);
        forceRender = true;
        startObserver();
        scan();
        sendResponse({ ok: true });
        return true;
      case 'CL_TOGGLE_ENABLED':
        settings.enabled = !settings.enabled;
        forceRender = true;
        scan();
        sendResponse({ ok: true, enabled: settings.enabled });
        return true;
      case 'CL_URL_CHANGED':
        onNavigation('bg');
        sendResponse({ ok: true });
        return true;
      case 'CL_HIDE_TIP':
        TIP.hide();
        sendResponse({ ok: true });
        return true;
      default:
        return;
    }
  }

  function onStorageChanged(changes, area) {
    if (disposed || area !== 'sync' || !changes.settings) return;
    settings = U.mergeSettings(changes.settings.newValue);
    forceRender = true;
    startObserver();
    scan();
  }

  function onPageHide() {
    stopDevWatch();
    stopUrlWatch();
    if (observer) { try { observer.disconnect(); } catch (e) {} }
    try { HL.clear(); } catch (e) {}
    try { clearReplacement(); } catch (e) {}
  }

  function onLoad() { if (!disposed) scan(); }

  /* ================================================================ *
   * 卸载
   * ================================================================ */

  function dispose() {
    if (disposed) return;
    disposed = true;
    stopDevWatch();
    stopUrlWatch();
    if (observer) { try { observer.disconnect(); } catch (e) {} }
    observer = null;
    try { document.removeEventListener('click', onClick, true); } catch (e) {}
    try { window.removeEventListener('pagehide', onPageHide); } catch (e) {}
    try { window.removeEventListener('pageshow', onPageShow); } catch (e) {}
    try { window.removeEventListener('load', onLoad); } catch (e) {}
    try { chrome.runtime.onMessage.removeListener(onMessage); } catch (e) {}
    try { chrome.storage.onChanged.removeListener(onStorageChanged); } catch (e) {}
    try { if (HL && HL.destroy) HL.destroy(); } catch (e) {}
    try { clearReplacement(); } catch (e) {}
    try { if (TIP && TIP.destroy) TIP.destroy(); } catch (e) {}
    entries = [];
    replacedNodes = [];
    stats = { nodes: 0, hits: 0, ms: 0, lastScan: 0 };
    try { if (NS.__dispose === dispose) NS.__dispose = null; } catch (e) {}
  }

  NS.__dispose = dispose;

  /* ================================================================ *
   * 导航感知
   *   整页跳转 -> 新文档会重新注入脚本，无需处理
   *   同文档跳转（SPA / pushState / 锚点）-> URL 轮询 + popstate/hashchange
   *   bfcache 前进后退恢复 -> pageshow(persisted)
   * ================================================================ */

  function resetHighlights() {
    try { HL.clear(); } catch (e) {}
    try { HL.clearActive(); } catch (e) {}
    try { TIP.hide(); } catch (e) {}
    try { clearReplacement(); } catch (e) {}
    entries = [];
    replacedNodes = [];
    lastFingerprint = '';
  }

  function onNavigation(reason) {
    if (disposed) return;
    lastUrl = location.href;
    lastScanReason = reason || '';
    forceRender = true;
    /* 同文档跳转后旧的 Range 可能指向已被移除的节点，先清干净再扫 */
    resetHighlights();
    if (!settings.enabled || settings.mode === 'off') return;
    startObserver();
    scan();
  }

  function checkUrl() {
    if (disposed) return;
    if (location.href !== lastUrl) onNavigation('poll');
  }

  function onPopState() { onNavigation('popstate'); }

  function onVisibility() {
    if (disposed) return;
    if (document.visibilityState !== 'visible') return;
    checkUrl();
    /* 回到这个标签页时若依然没有任何结果，补扫一次（页面可能在后台才渲染完） */
    if (!entries.length && Date.now() - stats.lastScan > 3000) {
      forceRender = true;
      lastScanReason = 'visible';
      scan();
    }
  }

  /* 注意：pageshow 的监听必须一直挂着（pagehide 里也不许摘）。
     页面进 bfcache 时我们主动 stopUrlWatch()，如果 pageshow 也一起被摘掉，
     恢复时就没人叫醒我们了 —— 那正是「后退回来要按 F5」的根因。 */
  function onPageShow(ev) {
    if (disposed) return;
    /* 从往返缓存（bfcache）恢复：pagehide 里断开的监听要重新接上 */
    if (ev && ev.persisted) {
      startUrlWatch();
      startObserver();
      startDevWatch();
      onNavigation('bfcache');
    }
  }

  function startUrlWatch() {
    stopUrlWatch();
    urlTimer = setInterval(checkUrl, URL_POLL_MS);
    try { window.addEventListener('popstate', onPopState); } catch (e) {}
    try { window.addEventListener('hashchange', onPopState); } catch (e) {}
    try { document.addEventListener('visibilitychange', onVisibility); } catch (e) {}
  }

  function stopUrlWatch() {
    if (urlTimer) { clearInterval(urlTimer); urlTimer = null; }
    try { window.removeEventListener('popstate', onPopState); } catch (e) {}
    try { window.removeEventListener('hashchange', onPopState); } catch (e) {}
    try { document.removeEventListener('visibilitychange', onVisibility); } catch (e) {}
  }

  /* ================================================================ *
   * 挂载与启动
   * ================================================================ */

  document.addEventListener('click', onClick, true);
  window.addEventListener('pagehide', onPageHide);
  /* pageshow 常驻：整页加载与 bfcache 恢复都会触发，是恢复流程的唯一入口 */
  window.addEventListener('pageshow', onPageShow);
  try { chrome.runtime.onMessage.addListener(onMessage); } catch (e) {}
  try { chrome.storage.onChanged.addListener(onStorageChanged); } catch (e) {}

  U.loadSettings().then(function (s) {
    if (disposed) return;
    settings = s;
    startObserver();
    startDevWatch();
    startUrlWatch();
    if (document.readyState === 'complete') scan();
    else window.addEventListener('load', onLoad, { once: true });
    setTimeout(function () { if (!disposed) scan(); }, 1500);
  });
})();

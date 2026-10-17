/*!
 * CurrencyEngine -- 页面扫描 / 替换 / 监听
 * 依赖注入：{ Core, settings, getRates, doc, win }
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') module.exports = factory();
  else root.CurrencyEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, CODE: 1, PRE: 1,
    KBD: 1, SAMP: 1, SVG: 1, MATH: 1, CANVAS: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, VIDEO: 1, AUDIO: 1,
    HEAD: 1, META: 1, LINK: 1, TITLE: 1, TEMPLATE: 1, SCRIPT2: 1
  };
  var SKIP_SEL = '.cc-amt,.cc-root,[data-cc-skip],.cm-editor,.CodeMirror,.monaco-editor,.ace_editor,.hljs,.katex,.MathJax,.select2,.tox-edit-area';

  var CSS =
    /* 只做淡陶土底色，不加任何下划线（下划线会破坏原站排版观感） */
    '.cc-amt{background-color:rgba(182,97,60,.10);border-radius:4px;padding:0 2px;margin:0 -1px;' +
    'cursor:inherit;box-decoration-break:clone;-webkit-box-decoration-break:clone;' +
    'transition:background-color .15s,box-shadow .15s}' +
    '.cc-amt:hover{background-color:rgba(182,97,60,.20);box-shadow:0 0 0 1px rgba(182,97,60,.28)}' +
    /* 追加模式的小标签：不换行、不撑开行高 */
    '.cc-amt.cc-add{white-space:nowrap;padding:0 2px;margin:0 0 0 1px;border-radius:5px}' +
    /* 仅悬停模式：原文保持原样，只有指针压上去才给一点底色 */
    '.cc-amt.cc-tip{background-color:transparent;padding:0;margin:0;box-shadow:none}' +
    '.cc-amt.cc-tip:hover{background-color:rgba(182,97,60,.12)}' +
    '.cc-amt.cc-plain{background-color:transparent;padding:0;margin:0;box-shadow:none}' +
    '.cc-amt.cc-plain:hover{background-color:transparent;box-shadow:none}';

  var CHUNK = 400;          // 每帧处理的文本节点数
  var DEBOUNCE = 350;       // DOM 变动防抖

  function createEngine(cfg) {
    var Core = cfg.Core;
    var doc = cfg.doc || document;
    var win = cfg.win || window;
    var settings = cfg.settings || {};
    var getRates = cfg.getRates || function () { return null; };
    var onState = cfg.onState || function () {};

    var records = [];          // { span, orig, parent }
    var queue = [];            // 待扫描元素（每轮 flush 内部再去重，避免元素被永久拉黑）
    var observer = null;
    var debounceTimer = null;
    var idleHandle = null;
    var busy = false;
    var styleEl = null;
    var stats = { converted: 0, nodes: 0, scannedAt: 0, pending: 0, lastError: '' };

    /* ---------------- 工具 ---------------- */
    function shouldSkip(node) {
      var el = node.nodeType === 1 ? node : node.parentNode;
      while (el && el !== doc.documentElement) {
        if (el.nodeType === 1) {
          if (SKIP_TAGS[el.tagName]) return true;
          if (el.isContentEditable) return true;
          if (el.getAttribute && el.getAttribute('data-cc-skip') !== null) return true;
          if (el.classList && (el.classList.contains('cc-amt') || el.classList.contains('cc-root'))) return true;
        }
        el = el.parentNode;
      }
      return false;
    }

    function isSkippedBySelector(el) {
      if (!el || el.nodeType !== 1) return false;
      if (typeof el.closest !== 'function') return false;
      try { return !!el.closest(SKIP_SEL); } catch (e) { return false; }
    }

    function injectStyle() {
      if (styleEl || !doc.head) return;
      styleEl = doc.createElement('style');
      styleEl.setAttribute('data-cc-skip', '');
      styleEl.textContent = CSS;
      doc.head.appendChild(styleEl);
    }

    function rateLine(from, to) {
      var rates = getRates();
      if (!rates || !rates.rates) return '';
      var rf = rates.rates[from], rt = rates.rates[to];
      if (!isFinite(rf) || !isFinite(rt)) return '';
      var one = rt / rf;
      return '1 ' + from + ' = ' + (one >= 1 ? one.toFixed(4) : one.toPrecision(4)) + ' ' + to;
    }

    function infoLine(from, to) {
      var bits = [];
      var rl = rateLine(from, to);
      if (rl) bits.push(rl);
      var store = getRates();
      if (store && store.source) bits.push(store.source);
      return bits.join('  \u00b7  ');
    }

    /* 手动“还原原文”后暂停自动重扫，否则 MutationObserver 会立刻把金额又注入回来 */
    var suspended = false;

    /* 追加模式的幂等标记：文本节点 -> 处理代数；revert 时代数 +1，旧标记自动作废 */
    var gen = 0;
    var doneTexts = typeof WeakMap === 'function' ? new WeakMap() : null;
    var chipsOf = typeof WeakMap === 'function' ? new WeakMap() : null;

    /* ---------------- 悬停卡片提示 ---------------- */
    var tip = null, tipBound = false;

    function ensureTip() {
      if (tip) return tip;
      var T = cfg.Tip || (typeof CurrencyTip !== 'undefined' ? CurrencyTip : null);
      if (!T || typeof T.createTip !== 'function') return null;
      try { tip = T.createTip({ doc: doc, win: win }); } catch (e) { tip = null; }
      return tip;
    }

    function tipWanted() {
      return settings.showTitle !== false || settings.displayMode === 'tooltip';
    }

    function hideTip() { if (tip) tip.hide(); }

    function onTipOver(e) {
      var t = e && e.target;
      if (!t) return;
      if (t.nodeType !== 1 && t.parentNode) t = t.parentNode;
      var span = (t && t.nodeType === 1 && t.closest) ? t.closest('.cc-amt') : null;
      if (!span || !tipWanted()) { hideTip(); return; }
      var out = span.getAttribute('data-cc-out');
      if (!out) { hideTip(); return; }
      var tp = ensureTip();
      if (!tp) return;
      tp.show({
        orig: span.getAttribute('data-cc-orig') || '',
        from: span.getAttribute('data-cc-from') || '',
        to: span.getAttribute('data-cc-to') || '',
        out: out,
        info: span.getAttribute('data-cc-info') || ''
      }, e);
    }

    function bindTip() {
      if (tipBound) return;
      tipBound = true;
      doc.addEventListener('mouseover', onTipOver, true);
      doc.addEventListener('mouseout', hideTip, true);
      doc.addEventListener('scroll', hideTip, true);
      doc.addEventListener('mousedown', hideTip, true);
    }

    /* ---------------- 构建上下文 ---------------- */
    function buildCtx() {
      var langAttr = (doc.documentElement && doc.documentElement.getAttribute('lang')) || '';
      var lang = langAttr || (win.navigator && (win.navigator.language || (win.navigator.languages && win.navigator.languages[0]))) || 'en-US';
      var host = (win.location && win.location.hostname) || '';
      var store = getRates();
      return Core.buildContext({
        settings: settings,
        lang: lang,
        host: host,
        rates: store && store.rates ? store.rates : null
      });
    }

    /* ---------------- 单节点处理 ---------------- */
    function processTextNode(node) {
      var text = node.nodeValue;
      if (!text || text.length < 2 || !/\d/.test(text)) return 0;
      var ctx = buildCtx();
      if (!ctx.rates) return 0;
      var hits;
      try { hits = Core.findMatches(text, ctx); } catch (e) { stats.lastError = String(e); return 0; }
      if (!hits.length) return 0;
      if (!ctx.settings.enabled) return 0;

      var parent = node.parentNode;
      if (!parent) return 0;
      /* 追加模式下原文留在原地，MutationObserver 会把同一节点再送回来；用代数标记保证只贴一次标签 */
      if (doneTexts && doneTexts.get(node) === gen) return 0;
      var mode = ctx.settings.displayMode;
      var plain = settings.highlight === false ? ' cc-plain' : '';
      var frag = doc.createDocumentFragment();
      var made = [];
      var last = 0, i, h, span;
      function tn(s) { var t = doc.createTextNode(s); made.push(t); return t; }
      /* 把可换行的空格换成不换行空格：整段金额变成一个不可拆开的整体 */
      function nb(s) { return String(s).replace(/[ \u00a0\u202f\u2009]+/g, '\u00a0'); }
      function tag(el, hit) {
        el.setAttribute('data-cc-orig', hit.text);
        el.setAttribute('data-cc-from', hit.from);
        el.setAttribute('data-cc-to', hit.to);
        el.setAttribute('data-cc-value', String(hit.value));
        el.setAttribute('data-cc-out', hit.formatted);
        el.setAttribute('data-cc-info', infoLine(hit.from, hit.to));
        return el;
      }
      for (i = 0; i < hits.length; i++) {
        h = hits[i];
        if (h.start > last) frag.appendChild(tn(text.slice(last, h.start)));
        if (mode === 'append') {
          /* 原文照旧留在文本节点里，只在其后补一个小标签：任何外层的 span 都可能改变原站的排版 */
          /* 金额内部只用不换行空格：补上标签后行宽变紧，「IDR 45.000」也不会被从中间折断 */
          var seg = tn(nb(h.text));
          frag.appendChild(seg);
          /* 单独一个空格文本节点当换行点：位置不够时只让标签掉到下一行，原价留在原位，标签底色也不会盖住空格 */
          var gap = tn(' ');
          frag.appendChild(gap);
          span = doc.createElement('span');
          span.className = 'cc-amt cc-add' + plain;
          span.textContent = '(' + nb(h.formatted) + ')';
          tag(span, h);
          try { span.ccGap = gap; } catch (e) { /* ignore */ }
          frag.appendChild(span);
          if (chipsOf) chipsOf.set(seg, span);
          records.push({ span: span, insert: true, seg: seg, segOrig: h.text, segOut: seg.nodeValue, gap: gap });
          last = h.end;
          continue;
        }
        span = doc.createElement('span');
        span.className = 'cc-amt' + plain;
        if (mode === 'tooltip') { span.textContent = h.text; span.className += ' cc-tip'; }
        else span.textContent = h.formatted;
        /* 悬停提示走自绘卡片（src/tip.js），不再写原生 title，避免出现两套 tooltip */
        tag(span, h);
        frag.appendChild(span);
        records.push({ span: span, orig: h.text });
        last = h.end;
      }
      if (last < text.length) frag.appendChild(tn(text.slice(last)));
      parent.replaceChild(frag, node);
      /* 新生成的文本节点都打上本代标记，后续 MutationObserver 再扫到时直接跳过 */
      if (doneTexts) { for (i = 0; i < made.length; i++) doneTexts.set(made[i], gen); }
      stats.converted += hits.length;
      return hits.length;
    }

    /* ---------------- 扫描一棵子树 ---------------- */
    function collectNodes(root, out) {
      if (!root) return out;
      if (root.nodeType === 3) { out.push(root); return out; }
      if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return out;
      if (root.nodeType === 1 && (shouldSkip(root) || isSkippedBySelector(root))) return out;
      var walker = doc.createTreeWalker(root, win.NodeFilter ? win.NodeFilter.SHOW_TEXT : 4, null);
      var n;
      while ((n = walker.nextNode())) {
        var p = n.parentNode;
        if (!p || shouldSkip(p) || isSkippedBySelector(p)) continue;
        out.push(n);
      }
      return out;
    }

    function scanRoot(root, done) {
      if (suspended) return;
      var nodes = collectNodes(root, []);
      stats.nodes += nodes.length;
      var i = 0;
      var cap = Number(settings.maxNodes) > 0 ? Number(settings.maxNodes) : 0;
      function step() {
        idleHandle = null;
        var budgetEnd = Date.now() + 14;
        while (i < nodes.length && Date.now() < budgetEnd) {
          var n = nodes[i++];
          if (cap && stats.nodes > cap) break;
          if (!n.parentNode) continue;
          processTextNode(n);
        }
        if (i < nodes.length) scheduleIdle(step);
        else { stats.scannedAt = Date.now(); emit(); if (done) done(stats.converted); }
      }
      scheduleIdle(step);
    }

    function scheduleIdle(fn) {
      if (win.requestIdleCallback) { idleHandle = win.requestIdleCallback(fn, { timeout: 500 }); }
      else { idleHandle = win.setTimeout(fn, 16); }
    }

    function emit() {
      try { onState({ converted: stats.converted, records: records.length, error: stats.lastError }); } catch (e) { /* ignore */ }
    }

    /* ---------------- 还原 ---------------- */
    function revert() {
      hideTip();
      suspended = true;
      gen++;   /* 作废所有「已处理」标记，重新启用时不会被误跳过 */
      if (!records.length) return 0;
      var parents = [];
      var n = 0, i, r, txt;
      for (i = 0; i < records.length; i++) {
        r = records[i];
        if (!r.span || !r.span.parentNode) continue;
        var p = r.span.parentNode;
        if (r.insert) {
          /* 优先用标签左边那个文本节点：站点重扫 / normalize 合并之后，记录的引用可能已经不是 DOM 里的那个了 */
          var keep = (r.gap && r.gap.parentNode) ? r.gap.previousSibling : ((r.span.previousSibling && r.span.previousSibling.nodeType === 3) ? r.span.previousSibling : r.seg);
          /* 只有那段文本还是我们写进去的内容时才还原：站点自己改过价就别覆盖回去 */
          if (keep && keep.parentNode && typeof r.segOrig === 'string' && (typeof r.segOut !== 'string' || keep.nodeValue === r.segOut)) keep.nodeValue = r.segOrig;
          if (r.gap && r.gap.parentNode) p.removeChild(r.gap);
          p.removeChild(r.span);
          if (r.seg && chipsOf) chipsOf.delete(r.seg);
          parents.push(p); n++; continue;
        }
        txt = doc.createTextNode(r.orig);
        p.replaceChild(txt, r.span);
        parents.push(p);
        n++;
      }
      for (i = 0; i < parents.length; i++) {
        try { parents[i].normalize(); } catch (e) { /* ignore */ }
      }
      records = [];
      stats.converted = 0;
      emit();
      return n;
    }

    /* ---------------- 全量应用 ---------------- */
    function apply() {
      if (!settings.enabled) { revert(); return; }
      injectStyle();
      if (tipWanted()) bindTip();
      revert();
      suspended = false;
      stats.nodes = 0;
      scanRoot(doc.body || doc.documentElement);
    }

    /* ---------------- DOM 监听 ---------------- */
    function onMutations(muts) {
      var i, j, m, node;
      for (i = 0; i < muts.length; i++) {
        m = muts[i];
        if (m.type === 'characterData') {
          node = m.target;
          /* 站点改了自己那段文本：先摘掉旧标签、作废标记，再重扫一遍 */
          if (doneTexts && doneTexts.get(node) === gen) {
            var old = chipsOf && chipsOf.get(node);
            if (old && old.ccGap && old.ccGap.parentNode) old.ccGap.parentNode.removeChild(old.ccGap);
            if (old && old.parentNode) old.parentNode.removeChild(old);
            if (chipsOf) chipsOf.delete(node);
            doneTexts.delete(node);
          }
          if (node.parentNode && !shouldSkip(node.parentNode) && !isSkippedBySelector(node.parentNode)) queue.push(node.parentNode);
        } else if (m.type === 'childList') {
          for (j = 0; j < m.addedNodes.length; j++) {
            node = m.addedNodes[j];
            if (node.nodeType === 1) {
              /* 自己插进去的 .cc-amt 别再触发一轮扫描，否则追加模式会无限叠加标签 */
              if (node.classList && node.classList.contains('cc-amt')) continue;
              if (!shouldSkip(node) && !isSkippedBySelector(node)) queue.push(node);
            } else if (node.nodeType === 3 && node.parentNode) {
              if (doneTexts && doneTexts.get(node) === gen) continue;
              queue.push(node.parentNode);
            }
          }
        }
      }
      if (queue.length) scheduleFlush();
    }

    function scheduleFlush() {
      if (debounceTimer) return;
      debounceTimer = win.setTimeout(function () {
        debounceTimer = null;
        flushQueue();
      }, DEBOUNCE);
    }

    function flushQueue() {
      if (suspended || !settings.enabled || !queue.length) { queue = []; return; }
      if (busy) { scheduleFlush(); return; }   // 本轮还在扫，稍后重试，别丢变动
      busy = true;
      var items = queue;
      queue = [];
      var uniq = [];
      var seenNow = new Set();
      var i;
      for (i = 0; i < items.length; i++) {
        var el = items[i];
        if (!el || !el.isConnected) continue;
        if (seenNow.has(el)) continue;
        seenNow.add(el);
        uniq.push(el);
      }
      var k = 0;
      function step() {
        var end = Date.now() + 12;
        while (k < uniq.length && Date.now() < end) {
          var el = uniq[k++];
          if (!el.isConnected) continue;
          var nodes = collectNodes(el, []);
          for (var t = 0; t < nodes.length; t++) {
            if (nodes[t].parentNode) processTextNode(nodes[t]);
          }
        }
        if (k < uniq.length) { scheduleIdle(step); }
        else { busy = false; emit(); }
      }
      scheduleIdle(step);
    }

    function start() {
      if (observer) return;
      observer = new win.MutationObserver(onMutations);
      observer.observe(doc.documentElement, { childList: true, subtree: true, characterData: true });
    }

    function stop() {
      if (observer) { observer.disconnect(); observer = null; }
      if (debounceTimer) { win.clearTimeout(debounceTimer); debounceTimer = null; }
      if (idleHandle) { if (win.cancelIdleCallback) win.cancelIdleCallback(idleHandle); else win.clearTimeout(idleHandle); idleHandle = null; }
      queue = [];
    }

    function updateSettings(next) {
      var prevTarget = settings.target;
      var prevEnabled = settings.enabled;
      settings = Object.assign({}, settings, next || {});
      cfg.settings = settings;
      if (next && 'enabled' in next && !next.enabled) { revert(); return Promise.resolve(); }
      if (next && 'enabled' in next && next.enabled && prevEnabled === false) { apply(); return Promise.resolve(); }
      if (next && (next.target !== prevTarget || 'displayMode' in next || 'decimals' in next || 'compact' in next)) { apply(); }
      else if (next && 'highlight' in next) { revert(); apply(); }
      return Promise.resolve();
    }

    function rescan() { apply(); return stats; }

    return {
      apply: apply, revert: revert, start: start, stop: stop, rescan: rescan,
      updateSettings: updateSettings,
      get stats() { return stats; },
      get settings() { return settings; },
      processTextNode: processTextNode,
      get tip() { return tip; },
      _collect: collectNodes
    };
  }

  return { createEngine: createEngine, SKIP_TAGS: SKIP_TAGS, SKIP_SEL: SKIP_SEL, CSS: CSS };
});

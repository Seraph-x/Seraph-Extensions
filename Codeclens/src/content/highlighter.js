/* CodecLens - highlighter.js
 * 高亮渲染层：优先使用 CSS Custom Highlight API（不改动页面 DOM），
 * 不支持时回退到 span 包裹。
 * 挂载到 globalThis.CodecLens.highlighter
 */
(function () {
  'use strict';

  var NS = (globalThis.CodecLens = globalThis.CodecLens || {});
  if (NS.highlighter) return;

  var GROUP_OF = {
    base64: 'a', base64url: 'a', dataUri: 'a',
    base58: 'b', base32: 'b', hex: 'b', ascii85: 'b',
    jwt: 'c', url: 'c', htmlEntity: 'c', unicodeEscape: 'c',
    rot13: 'd', gzip: 'd', unknown: 'd'
  };
  var GROUP_NAMES = ['a', 'b', 'c', 'd'];
  var HIGHLIGHT_KEYS = GROUP_NAMES.map(function (g) { return 'cl-hl-' + g; });

  var supportsHighlightApi = (function () {
    try {
      return typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined';
    } catch (e) { return false; }
  })();

  var state = {
    supported: supportsHighlightApi,
    entries: [],          // { node, start, end, hit }
    byNode: new Map(),    // node -> entries[]
    fallbackSpans: [],
    activeIndex: -1
  };

  function groupOf(type) {
    return GROUP_OF[type] || 'd';
  }

  /* ---------------- Custom Highlight API 模式 ---------------- */

  function applyHighlightApi(entries) {
    var buckets = { a: [], b: [], c: [], d: [] };
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      try {
        var r = document.createRange();
        r.setStart(e.node, e.start);
        r.setEnd(e.node, e.end);
        buckets[groupOf(e.hit.type)].push(r);
      } catch (err) { /* 节点已被移除 */ }
    }
    GROUP_NAMES.forEach(function (g) {
      var key = 'cl-hl-' + g;
      try {
        if (buckets[g].length) {
          CSS.highlights.set(key, new Highlight.apply(null, buckets[g]));
        } else {
          CSS.highlights.delete(key);
        }
      } catch (e) {
        try { CSS.highlights.delete(key); } catch (e2) {}
      }
    });
  }

  function clearHighlightApi() {
    HIGHLIGHT_KEYS.forEach(function (k) {
      try { CSS.highlights.delete(k); } catch (e) {}
    });
    try { CSS.highlights.delete('cl-hl-active'); } catch (e) {}
  }

  /* ---------------- DOM 回退模式 ---------------- */

  function applyFallback(entries) {
    clearFallback();
    // 按 node 分组，从后往前包裹，避免偏移错乱
    var byNode = new Map();
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!byNode.has(e.node)) byNode.set(e.node, []);
      byNode.get(e.node).push(e);
    }
    byNode.forEach(function (list, node) {
      list.sort(function (a, b) { return b.start - a.start; });
      for (var k = 0; k < list.length; k++) {
        var it = list[k];
        try {
          var text = node.nodeValue;
          if (!text || it.end > text.length) continue;
          var range = document.createRange();
          range.setStart(node, it.start);
          range.setEnd(node, it.end);
          var span = document.createElement('span');
          span.className = 'cl-fallback-mark';
          span.setAttribute('data-cl-group', groupOf(it.hit.type));
          span.setAttribute('data-cl-index', String(entries.indexOf(it)));
          try {
            range.surroundContents(span);
          } catch (err) {
            span.appendChild(range.extractContents());
            range.insertNode(span);
          }
          state.fallbackSpans.push(span);
          it.span = span;
          it.node = span.firstChild;
          it.start = 0;
          it.end = span.firstChild ? span.firstChild.nodeValue.length : 0;
        } catch (err) { /* 跨节点范围，跳过 */ }
      }
    });
  }

  function clearFallback() {
    for (var i = 0; i < state.fallbackSpans.length; i++) {
      var span = state.fallbackSpans[i];
      try {
        var parent = span.parentNode;
        if (!parent) continue;
        parent.replaceChild(document.createTextNode(span.textContent), span);
        parent.normalize();
      } catch (e) {}
    }
    state.fallbackSpans = [];
  }

  /* ---------------- 对外接口 ---------------- */

  function render(entries) {
    state.entries = entries || [];
    state.byNode = new Map();
    for (var i = 0; i < state.entries.length; i++) {
      var e = state.entries[i];
      if (!state.byNode.has(e.node)) state.byNode.set(e.node, []);
      state.byNode.get(e.node).push(e);
    }
    if (supportsHighlightApi) {
      applyHighlightApi(state.entries);
    } else {
      applyFallback(state.entries);
    }
  }

  function clear() {
    state.entries = [];
    state.byNode = new Map();
    state.activeIndex = -1;
    if (supportsHighlightApi) clearHighlightApi();
    clearFallback();
  }

  function markActive(entry) {
    if (!supportsHighlightApi || !entry) return;
    try {
      var r = document.createRange();
      r.setStart(entry.node, entry.start);
      r.setEnd(entry.node, entry.end);
      CSS.highlights.set('cl-hl-active', new Highlight(r));
    } catch (e) {}
  }

  function clearActive() {
    if (!supportsHighlightApi) return;
    try { CSS.highlights.delete('cl-hl-active'); } catch (e) {}
  }

  function pointToOffset(node, offset) {
    if (!node) return -1;
    if (node.nodeType === Node.TEXT_NODE) return offset;
    if (offset < node.childNodes.length) {
      var child = node.childNodes[offset];
      if (child && child.nodeType === Node.TEXT_NODE) return 0;
    }
    return -1;
  }

  function caretAt(x, y) {
    if (document.caretRangeFromPoint) {
      return document.caretRangeFromPoint(x, y);
    }
    if (document.caretPositionFromPoint) {
      var pos = document.caretPositionFromPoint(x, y);
      if (!pos) return null;
      var r = document.createRange();
      try {
        r.setStart(pos.offsetNode, pos.offset);
        r.setEnd(pos.offsetNode, pos.offset);
      } catch (e) { return null; }
      return r;
    }
    return null;
  }

  function hitTest(x, y) {
    var caret = caretAt(x, y);
    if (!caret) return null;
    var node = caret.startContainer;
    var offset = caret.startOffset;
    if (!node) return null;

    var list = state.byNode.get(node);
    if (!list) {
      // 回退模式下点击的是 span 本身
      var el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;
      while (el && el !== document.body) {
        if (el.classList && el.classList.contains('cl-fallback-mark')) {
          var idx = parseInt(el.getAttribute('data-cl-index'), 10);
          if (!isNaN(idx) && state.entries[idx]) return state.entries[idx];
        }
        el = el.parentNode;
      }
      return null;
    }
    var off = pointToOffset(node, offset);
    for (var i = 0; i < list.length; i++) {
      if (off >= list[i].start && off <= list[i].end) return list[i];
    }
    return null;
  }

  function getEntries() { return state.entries; }

  /* 卸载：清掉全部高亮与 DOM 回退标记，供热重载使用 */
  function destroy() {
    try { clear(); } catch (e) {}
    try { clearHighlightApi(); } catch (e) {}
    try { clearFallback(); } catch (e) {}
    state.entries = [];
    state.byNode = new Map();
    state.fallbackSpans = [];
    state.activeIndex = -1;
  }

  NS.highlighter = {
    render: render,
    clear: clear,
    hitTest: hitTest,
    markActive: markActive,
    clearActive: clearActive,
    getEntries: getEntries,
    destroy: destroy,
    supportsHighlightApi: supportsHighlightApi
  };
})();

/* CodecLens - popup.js */
(function () {
  'use strict';

  var U = globalThis.CodecLens.util;
  var C = globalThis.CodecLens.codecs;
  var D = globalThis.CodecLens.detector;

  var els = {};
  var allResults = [];
  var settings = U.clone(U.DEFAULT_SETTINGS);
  var activeTabId = null;

  function $(id) { return document.getElementById(id); }

  function esc(s) { return U.escapeHtml(String(s == null ? '' : s)); }

  function groupOf(type) {
    if (type === 'base64' || type === 'base64url' || type === 'dataUri') return 'a';
    if (type === 'base58' || type === 'base32' || type === 'hex' || type === 'ascii85') return 'b';
    if (type === 'jwt' || type === 'url' || type === 'htmlEntity' || type === 'unicodeEscape') return 'c';
    return 'd';
  }

  /* ---------------------------------------------------------------- *
   * 初始化
   * ---------------------------------------------------------------- */

  function init() {
    els.toggle = $('toggle-enabled');
    els.rescan = $('btn-rescan');
    els.options = $('btn-options');
    els.list = $('list');
    els.empty = $('empty');
    els.filter = $('filter');
    els.statHits = $('stat-hits');
    els.statNodes = $('stat-nodes');
    els.statMs = $('stat-ms');
    els.codec = $('codec');
    els.toolIn = $('tool-in');
    els.toolOut = $('tool-out');
    els.outLabel = $('out-label');
    els.run = $('btn-run');
    els.chain = $('tool-chain');

    bindTabs();
    bindEvents();

    U.loadSettings().then(function (s) {
      settings = s;
      els.toggle.checked = !!s.enabled;
      return refresh();
    });

    var params = new URLSearchParams(location.search);
    var preset = params.get('text');
    if (preset) {
      switchTab('tool');
      els.toolIn.value = preset;
      runTool();
    }
  }

  function bindTabs() {
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        switchTab(this.getAttribute('data-tab'));
      });
    }
  }

  function switchTab(name) {
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === name);
    }
    var panels = document.querySelectorAll('.panel');
    for (var j = 0; j < panels.length; j++) {
      panels[j].classList.toggle('active', panels[j].id === 'panel-' + name);
    }
  }

  function bindEvents() {
    els.toggle.addEventListener('change', function () {
      settings.enabled = els.toggle.checked;
      U.saveSettings(settings);
      sendToTab({ type: 'CL_SETTINGS_UPDATED', settings: settings });
    });

    els.rescan.addEventListener('click', function () {
      els.rescan.style.transform = 'rotate(360deg)';
      els.rescan.style.transition = 'transform .4s';
      setTimeout(function () { els.rescan.style.transform = ''; els.rescan.style.transition = ''; }, 420);
      sendToTab({ type: 'CL_RESCAN' }).then(function () {
        setTimeout(refresh, 420);
      });
    });

    els.options.addEventListener('click', function () {
      if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
    });

    els.filter.addEventListener('input', renderList);

    $('btn-copy-all').addEventListener('click', function () {
      var lines = allResults.map(function (r) {
        return '[' + r.label + '] ' + r.raw + '\n  -> ' + r.text.replace(/\n/g, ' ');
      });
      copy(lines.join('\n\n'), this);
    });

    els.run.addEventListener('click', runTool);
    els.toolIn.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runTool();
    });
    $('btn-copy-out').addEventListener('click', function () {
      copy(els.toolOut.textContent || '', this);
    });
  }

  /* ---------------------------------------------------------------- *
   * 与内容脚本通信
   * ---------------------------------------------------------------- */

  function getActiveTab() {
    return new Promise(function (resolve) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        resolve(tabs && tabs[0] ? tabs[0] : null);
      });
    });
  }

  function sendToTab(message) {
    return new Promise(function (resolve) {
      if (activeTabId == null) { resolve(null); return; }
      try {
        chrome.tabs.sendMessage(activeTabId, message, function (res) {
          if (chrome.runtime.lastError) { resolve(null); return; }
          resolve(res || null);
        });
      } catch (e) { resolve(null); }
    });
  }

  function refresh() {
    return getActiveTab().then(function (tab) {
      if (!tab) return;
      activeTabId = tab.id;
      return sendToTab({ type: 'CL_GET_RESULTS' }).then(function (res) {
        if (!res || !res.ok) {
          allResults = [];
          renderList();
          els.statHits.textContent = '—';
          els.statNodes.textContent = '—';
          els.statMs.textContent = '—';
          els.empty.querySelector('p').textContent = '无法访问当前页面（浏览器内置页面 / 扩展商店页面不支持注入）。';
          els.empty.style.display = 'block';
          return;
        }
        allResults = res.results || [];
        var st = res.stats || {};
        els.statHits.textContent = allResults.length;
        els.statNodes.textContent = st.nodes || 0;
        els.statMs.textContent = st.ms || 0;
        els.empty.querySelector('p').textContent = '当前页面未检测到可解码的数据。';
        renderList();
      });
    });
  }

  /* ---------------------------------------------------------------- *
   * 结果列表
   * ---------------------------------------------------------------- */

  function renderList() {
    var q = (els.filter.value || '').trim().toLowerCase();
    var list = allResults;
    if (q) {
      list = allResults.filter(function (r) {
        return (r.label + ' ' + r.type + ' ' + r.raw + ' ' + r.text).toLowerCase().indexOf(q) >= 0;
      });
    }

    if (!list.length) {
      els.list.innerHTML = '';
      els.empty.style.display = 'block';
      return;
    }
    els.empty.style.display = 'none';

    var LIMIT = 300;
    var html = '';
    for (var i = 0; i < Math.min(list.length, LIMIT); i++) {
      var r = list[i];
      var g = groupOf(r.type);
      html += '<div class="item" data-index="' + r.index + '">';
      html += '<div class="item-head">';
      html += '<span class="tag g-' + g + '">' + esc(r.label) + '</span>';
      if (r.depth > 1) html += '<span class="item-depth">' + r.depth + ' 层</span>';
      if (r.compression) html += '<span class="item-depth">' + esc(r.compression) + '</span>';
      html += '<span class="item-score">置信度 ' + r.score + '</span>';
      html += '</div>';
      html += '<div class="row"><span class="row-label">原文</span><span class="row-val raw">' + esc(U.truncate(r.raw, 180)) + '</span></div>';
      html += '<div class="row"><span class="row-label">解码</span><span class="row-val out">' + esc(U.truncate(r.text, 260)) + '</span></div>';
      html += '</div>';
    }
    if (list.length > LIMIT) {
      html += '<div class="dim" style="text-align:center;padding:6px">仅显示前 ' + LIMIT + ' 条，共 ' + list.length + ' 条</div>';
    }
    els.list.innerHTML = html;

    var items = els.list.querySelectorAll('.item');
    for (var k = 0; k < items.length; k++) {
      items[k].addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-index'), 10);
        sendToTab({ type: 'CL_SCROLL_TO', index: idx }).then(function (res) {
          if (res && res.ok) window.close();
        });
      });
    }
  }

  /* ---------------------------------------------------------------- *
   * 手动解码工具
   * ---------------------------------------------------------------- */

  function runTool() {
    var input = els.toolIn.value;
    var mode = els.codec.value;
    els.chain.innerHTML = '';

    if (!input.trim()) {
      els.toolOut.textContent = '';
      els.outLabel.textContent = '输出';
      return;
    }

    if (mode === 'b64encode') {
      els.outLabel.textContent = 'Base64 编码';
      els.toolOut.textContent = C.base64.encode(input, false);
      return;
    }
    if (mode === 'urlencode') {
      els.outLabel.textContent = 'URL 编码';
      els.toolOut.textContent = C.url.encode(input);
      return;
    }

    if (mode === 'auto') {
      var results = D.decodeAny(input, settings);
      if (!results.length) {
        els.outLabel.textContent = '未识别';
        els.toolOut.textContent = '未匹配到已知编码格式。\n\n提示：Base58 与 Base64 字符集高度重叠，短串容易混淆；可尝试手动指定解码器。';
        return;
      }
      var best = results[0];
      els.outLabel.textContent = best.label + ' · 置信度 ' + Math.round(best.score);
      els.toolOut.textContent = best.text;
      renderChain(best);
      return;
    }

    var fn = C[mode] && C[mode].decode;
    if (!fn) {
      els.toolOut.textContent = '不支持的解码器: ' + mode;
      return;
    }
    try {
      var r = fn(input.trim());
      els.outLabel.textContent = (D.TYPE_LABEL[mode] || mode) + ' 解码结果';
      els.toolOut.textContent = r.text;
      var hit = {
        type: mode,
        label: D.TYPE_LABEL[mode] || mode,
        raw: input.trim(),
        text: r.text,
        bytes: r.bytes,
        meta: r.meta || {},
        score: 0
      };
      hit.chain = D.deepDecode(hit, settings);
      renderChain(hit);
    } catch (e) {
      els.outLabel.textContent = '解码失败';
      els.toolOut.textContent = String(e && e.message ? e.message : e);
    }
  }

  function renderChain(hit) {
    var chain = (hit.chain && hit.chain.length) ? hit.chain : [];
    if (chain.length <= 1) { els.chain.innerHTML = ''; return; }
    var html = '<div class="dim" style="margin-bottom:4px">链式解码路径</div>';
    for (var i = 0; i < chain.length; i++) {
      html += '<div class="chain-item"><b>' + (i + 1) + '</b><span>' + esc(chain[i].label) + '</span><span class="dim">' + esc(U.truncate(chain[i].text, 90)) + '</span></div>';
    }
    els.chain.innerHTML = html;
  }

  /* ---------------------------------------------------------------- *
   * 复制
   * ---------------------------------------------------------------- */

  function copy(text, btn) {
    var done = function (ok) {
      if (!btn) return;
      var old = btn.textContent;
      btn.textContent = ok ? '已复制' : '失败';
      setTimeout(function () { btn.textContent = old; }, 1100);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        done(ok);
      }
    } catch (e) { done(false); }
  }

  document.addEventListener('DOMContentLoaded', init);
})();

/* CodecLens - tooltip.js
 * 悬浮解码卡片（Shadow DOM 隔离，不受页面样式影响）
 * 挂载到 globalThis.CodecLens.tooltip
 */
(function () {
  'use strict';

  var NS = (globalThis.CodecLens = globalThis.CodecLens || {});
  if (NS.tooltip) return;
  var U = NS.util;

  var STYLE = [
    ':host { all: initial; }',
    '* { box-sizing: border-box; }',
    '.wrap {',
    '  position: fixed; z-index: 2147483647; width: 460px; max-width: calc(100vw - 24px);',
    '  background: #0d1117; color: #e6edf3; border: 1px solid #30363d; border-radius: 10px;',
    '  box-shadow: 0 12px 40px rgba(0,0,0,.55);',
    '  font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;',
    '  overflow: hidden;',
    '}',
    '.head { display:flex; align-items:center; gap:8px; padding:8px 10px; background:#161b22; border-bottom:1px solid #30363d; }',
    '.badge { background:#1f6feb; color:#fff; border-radius:4px; padding:1px 7px; font-size:11px; font-weight:600; letter-spacing:.3px; }',
    '.badge.g-b { background:#8957e5; }',
    '.badge.g-c { background:#2ea043; }',
    '.badge.g-d { background:#db6d28; }',
    '.score { color:#8b949e; font-size:11px; }',
    '.spacer { flex:1; }',
    '.btn { background:#21262d; color:#c9d1d9; border:1px solid #30363d; border-radius:5px; padding:2px 8px; cursor:pointer; font-size:11px; font-family:inherit; }',
    '.btn:hover { background:#30363d; }',
    '.btn.primary { background:#238636; border-color:#2ea043; color:#fff; }',
    '.btn.primary:hover { background:#2ea043; }',
    '.body { max-height: 52vh; overflow:auto; padding: 8px 10px 10px; }',
    '.sec { margin-bottom: 8px; }',
    '.sec:last-child { margin-bottom: 0; }',
    '.sec-title { color:#8b949e; font-size:11px; margin-bottom:3px; display:flex; align-items:center; gap:6px; }',
    '.chain-tag { background:#21262d; border-radius:3px; padding:0 5px; color:#7ee787; font-size:10px; }',
    'pre { margin:0; background:#161b22; border:1px solid #21262d; border-radius:6px; padding:7px 9px; white-space:pre-wrap; word-break:break-all; max-height:220px; overflow:auto; color:#c9d1d9; }',
    '.foot { display:flex; align-items:center; gap:6px; padding:6px 10px; background:#161b22; border-top:1px solid #30363d; }',
    '.hint { color:#6e7681; font-size:10px; }',
    '.err { color:#f85149; }',
    '.ok { color:#3fb950; }',
    '.close { cursor:pointer; color:#8b949e; font-size:16px; line-height:1; padding:0 2px; }',
    '.close:hover { color:#e6edf3; }'
  ].join('\n');

  var host = null;
  var root = null;
  var wrap = null;
  var current = null;

  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.className = 'codeclens-ui';
    host.setAttribute('data-codeclens', 'root');
    host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
    root = host.attachShadow({ mode: 'open' });
    var st = document.createElement('style');
    st.textContent = STYLE;
    root.appendChild(st);
    (document.body || document.documentElement).appendChild(host);
  }

  function groupOf(type) {
    if (type === 'base64' || type === 'base64url' || type === 'dataUri') return 'a';
    if (type === 'base58' || type === 'base32' || type === 'hex' || type === 'ascii85') return 'b';
    if (type === 'jwt' || type === 'url' || type === 'htmlEntity' || type === 'unicodeEscape') return 'c';
    return 'd';
  }

  function esc(s) {
    return U.escapeHtml(String(s == null ? '' : s));
  }

  function copyText(text, btn) {
    var done = function (ok) {
      var old = btn.textContent;
      btn.textContent = ok ? '已复制' : '复制失败';
      setTimeout(function () { btn.textContent = old; }, 1200);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        done(ok);
      }
    } catch (e) { done(false); }
  }

  function buildHtml(entry) {
    var g = groupOf(entry.type);
    var chain = (entry.chain && entry.chain.length) ? entry.chain : [entry];
    var finalText = chain[chain.length - 1].text || '';
    var html = '';

    html += '<div class="wrap">';
    html += '<div class="head">';
    html += '<span class="badge g-' + g + '">' + esc(entry.label || entry.type) + '</span>';
    if (chain.length > 1) html += '<span class="chain-tag">链式 ' + chain.length + ' 层</span>';
    html += '<span class="score">置信度 ' + Math.round(Math.min(100, Math.max(0, entry.score || 0))) + '</span>';
    html += '<span class="spacer"></span>';
    html += '<button class="btn" data-act="copy">复制结果</button>';
    html += '<span class="close" data-act="close">\u00d7</span>';
    html += '</div>';

    html += '<div class="body">';
    html += '<div class="sec"><div class="sec-title">原始数据 <span class="hint">(' + entry.raw.length + ' 字符)</span></div>';
    html += '<pre>' + esc(U.truncate(entry.raw, 4000)) + '</pre></div>';

    for (var i = 0; i < chain.length; i++) {
      var step = chain[i];
      var title = (i === 0) ? '解码结果' : '第 ' + i + ' 层 · ' + (step.label || step.type);
      html += '<div class="sec"><div class="sec-title">' + esc(title) + '</div>';
      html += '<pre>' + esc(U.truncate(step.text == null ? '' : step.text, 12000)) + '</pre></div>';
    }

    if (entry.meta && entry.meta.compression) {
      html += '<div class="sec"><div class="sec-title">压缩流</div>';
      html += '<pre>检测到 ' + esc(entry.meta.compression) + ' 压缩数据</pre></div>';
    }
    html += '</div>';

    html += '<div class="foot">';
    if (entry.meta && entry.meta.compression) {
      html += '<button class="btn primary" data-act="inflate">展开压缩流</button>';
    }
    html += '<span class="hint">Esc 关闭 · 点击卡片外部关闭</span>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  function position(x, y) {
    if (!wrap) return;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var rect = wrap.getBoundingClientRect();
    var left = Math.min(Math.max(8, x + 12), Math.max(8, vw - rect.width - 12));
    var top = y + 16;
    if (top + rect.height > vh - 8) {
      top = Math.max(8, y - rect.height - 16);
    }
    wrap.style.left = left + 'px';
    wrap.style.top = top + 'px';
  }

  function show(entry, x, y) {
    ensureHost();
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    var holder = document.createElement('div');
    holder.innerHTML = buildHtml(entry);
    wrap = holder.firstChild;
    root.appendChild(wrap);
    current = entry;

    wrap.addEventListener('click', function (ev) {
      var act = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-act');
      if (!act) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (act === 'close') hide();
      else if (act === 'copy') {
        var chain = (entry.chain && entry.chain.length) ? entry.chain : [entry];
        copyText(chain[chain.length - 1].text || '', ev.target);
      } else if (act === 'inflate') {
        inflate(entry, ev.target);
      }
    }, true);

    position(x, y);
  }

  function inflate(entry, btn) {
    if (!entry.bytes || !entry.meta || !entry.meta.compression) return;
    btn.textContent = '解压中…';
    btn.disabled = true;
    NS.codecs.decompressBytes(entry.bytes, entry.meta.compression).then(function (bytes) {
      var text;
      try { text = U.bytesToUtf8(bytes, true); }
      catch (e) { text = U.bytesToUtf8(bytes, false); }
      if (U.printableRatio(text) < 0.8) text = NS.detector.hexdump(bytes, 1024);
      var sec = document.createElement('div');
      sec.className = 'sec';
      sec.innerHTML = '<div class="sec-title">解压结果 <span class="hint">(' + bytes.length + ' 字节)</span></div><pre>' + esc(U.truncate(text, 20000)) + '</pre>';
      var body = wrap.querySelector('.body');
      if (body) body.appendChild(sec);
      btn.textContent = '已展开';
      setTimeout(function () { if (btn.isConnected) { btn.textContent = '展开压缩流'; btn.disabled = false; } }, 1500);
    }).catch(function (err) {
      btn.textContent = '解压失败';
      btn.disabled = false;
      var body = wrap.querySelector('.body');
      if (body) {
        var d = document.createElement('div');
        d.className = 'sec err';
        d.textContent = String(err && err.message ? err.message : err);
        body.appendChild(d);
      }
    });
  }

  function hide() {
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    wrap = null;
    current = null;
    NS.highlighter.clearActive();
  }

  function isOpen() { return !!wrap; }
  function containsNode(node) {
    return host && node && (node === host || (node.compareDocumentPosition && (node.compareDocumentPosition(host) & Node.DOCUMENT_POSITION_CONTAINED_BY)));
  }
  function getCurrent() { return current; }

  function onKeydown(e) {
    if (e.key === 'Escape' && wrap) hide();
  }
  function onResize() { if (wrap) hide(); }

  document.addEventListener('keydown', onKeydown, true);
  window.addEventListener('resize', onResize, true);

  /* 卸载：移除宿主节点与全局监听，供热重载使用 */
  function destroy() {
    try { hide(); } catch (e) {}
    document.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('resize', onResize, true);
    try { if (host && host.parentNode) host.parentNode.removeChild(host); } catch (e) {}
    host = null;
    root = null;
    wrap = null;
    current = null;
  }

  NS.tooltip = {
    show: show,
    hide: hide,
    isOpen: isOpen,
    containsNode: containsNode,
    getCurrent: getCurrent,
    destroy: destroy
  };
})();

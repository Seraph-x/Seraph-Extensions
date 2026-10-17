/* CodecLens - options.js */
(function () {
  'use strict';

  var U = globalThis.CodecLens.util;
  var D = globalThis.CodecLens.detector;

  var TYPE_META = [
    { key: 'base64', name: 'Base64', eg: 'aGVsbG8gd29ybGQ=' },
    { key: 'base64url', name: 'Base64URL', eg: 'eyJhbGciOiJIUzI1NiJ9' },
    { key: 'base58', name: 'Base58', eg: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2' },
    { key: 'base32', name: 'Base32', eg: 'JBSWY3DPEBLW64TMMQ======' },
    { key: 'hex', name: 'Hex', eg: '48656c6c6f2c20576f726c6421' },
    { key: 'ascii85', name: 'Ascii85', eg: '<~87cURD]i,"Ebo80~>' },
    { key: 'jwt', name: 'JWT', eg: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig' },
    { key: 'url', name: 'URL 百分号编码', eg: '%E4%BD%A0%E5%A5%BD%E4%B8%96%E7%95%8C' },
    { key: 'htmlEntity', name: 'HTML 实体', eg: '&lt;div class=&quot;x&quot;&gt;' },
    { key: 'unicodeEscape', name: 'Unicode 转义', eg: '\\u4f60\\u597d\\u4e16\\u754c' },
    { key: 'rot13', name: 'ROT13', eg: 'Uryyb Jbeyq' },
    { key: 'dataUri', name: 'Data URI', eg: 'data:text/plain;base64,SGVsbG8=' }
  ];

  var SAMPLE = [
    'Base64  : aGVsbG8gd29ybGQ=',
    'Base64 嵌套 : VGhpcyBpcyBhIHRlc3Q=  ->  嵌套示例 aGVsbG8=',
    'Base64URL : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    'Hex     : 48656c6c6f2c20576f726c6421',
    'Base32  : JBSWY3DPEBLW64TMMQ======',
    'URL     : %E4%BD%A0%E5%A5%BD%E4%B8%96%E7%95%8C',
    '实体    : &lt;div class=&quot;card&quot;&gt;Hello&lt;/div&gt;',
    '转义    : \\u4f60\\u597d\\u4e16\\u754c',
    'JWT     : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    'JSON in b64 : eyJuYW1lIjoiQ29kZWNMZW5zIiwidmVyc2lvbiI6IjEuMC4wIiwidGFncyI6WyJiYXNlNjQiLCJqd3QiXX0=',
    '普通文本(不应误报) : 这是一段普通的中文说明文字，用来验证误报率。',
    '随机串(不应误报) : aB3xY9kLmN2pQ7rTzW4v'
  ].join('\n');

  var els = {};

  function $(id) { return document.getElementById(id); }

  function init() {
    els.enabled = $('enabled');
    els.mode = $('mode');
    els.scanDynamic = $('scanDynamic');
    els.scanShadow = $('scanShadow');
    els.skipCodeBlocks = $('skipCodeBlocks');
    els.devWatch = $('devWatch');
    els.autoHeal = $('autoHeal');
    els.minLength = $('minLength');
    els.maxDepth = $('maxDepth');
    els.blacklist = $('blacklist');
    els.types = $('types');

    buildTypes();

    els.minLength.addEventListener('input', function () { $('minLength-val').textContent = els.minLength.value; });
    els.maxDepth.addEventListener('input', function () { $('maxDepth-val').textContent = els.maxDepth.value; });

    $('btn-save').addEventListener('click', save);
    $('btn-reset').addEventListener('click', function () {
      if (!confirm('恢复默认设置？')) return;
      apply(U.clone(U.DEFAULT_SETTINGS));
      save();
    });
    $('btn-test').addEventListener('click', runTest);
    $('btn-test-sample').addEventListener('click', function () {
      $('selftest').value = SAMPLE;
      runTest();
    });

    bindDev();

    U.loadSettings().then(function (s) { apply(s); });
  }

  function devOut(text) {
    var el = $('dev-out');
    if (el) el.textContent = text;
  }

  function devSend(type, payload, onOk) {
    try {
      chrome.runtime.sendMessage(Object.assign({ type: type }, payload || {}), function (res) {
        if (chrome.runtime.lastError) {
          devOut('后台未响应：' + chrome.runtime.lastError.message + '\n（如果刚重载过扩展，刷新本设置页即可）');
          return;
        }
        if (onOk) onOk(res || {});
      });
    } catch (e) {
      devOut('后台未响应：' + String(e && e.message ? e.message : e));
    }
  }

  function bindDev() {
    chrome.storage.local.get({ devWatch: false, autoHeal: true }, function (r) {
      if (chrome.runtime.lastError) return;
      els.devWatch.checked = !!r.devWatch;
      els.autoHeal.checked = r.autoHeal !== false;
    });

    els.autoHeal.addEventListener('change', function () {
      var on = els.autoHeal.checked;
      devSend('CL_SET_AUTO_HEAL', { value: on }, function (res) {
        if (!res.ok) { devOut('设置失败。'); return; }
        devOut(on
          ? '导航自动补注入已开启\n\n换页、单页应用跳转、后退缓存恢复时都会确认脚本是否接上，\n没接上就自动补注入一次。'
          : '导航自动补注入已关闭。\n换页后若发现扩展没生效，需要手动按 F5 或 Alt+Shift+R。');
      });
    });

    els.devWatch.addEventListener('change', function () {
      var on = els.devWatch.checked;
      devSend('CL_SET_DEV_WATCH', { value: on }, function (res) {
        if (!res.ok) { devOut('设置失败。'); return; }
        devOut(on
          ? '自动热重载已开启\n\n现在修改 src/lib 或 src/content 下的脚本，最多 4 秒后会自动注入到所有已打开的页面。\n页面不会刷新，滚动位置与表单内容都会保留。'
          : '自动热重载已关闭。');
      });
    });

    $('btn-reinject').addEventListener('click', function () {
      devOut('正在重新注入…');
      devSend('CL_REINJECT_ALL', null, function (res) {
        if (!res.ok) { devOut('重新注入失败。'); return; }
        devOut('完成。\n共 ' + res.total + ' 个页面标签页：注入 ' + res.injected + ' 个，失败 ' + res.failed + ' 个。');
      });
    });

    $('btn-dev-info').addEventListener('click', function () {
      devOut('读取中…');
      devSend('CL_GET_DEV_INFO', null, function (res) {
        if (!res.ok) { devOut('读取失败。'); return; }
        devOut([
          '扩展版本   : v' + res.version,
          '代码指纹   : ' + res.hash,
          '自动热重载 : ' + (res.watch ? '开启' : '关闭'),
          '导航补注入 : ' + (res.autoHeal === false ? '关闭' : '开启'),
          '页面标签页 : ' + res.tabCount + ' 个',
          '已连接实例 : ' + res.aliveCount + ' 个'
        ].join('\n'));
      });
    });

    $('btn-reload-ext').addEventListener('click', function () {
      devOut('正在重载扩展…\n本设置页可能被关闭，重新打开即可。');
      devSend('CL_RELOAD_EXTENSION', null, function () {});
    });
  }

  function buildTypes() {
    var html = '';
    for (var i = 0; i < TYPE_META.length; i++) {
      var t = TYPE_META[i];
      html += '<label class="type-item">';
      html += '<input type="checkbox" data-type="' + t.key + '">';
      html += '<span class="type-meta"><span class="type-name">' + U.escapeHtml(t.name) + '</span>';
      html += '<span class="type-eg">' + U.escapeHtml(t.eg) + '</span></span>';
      html += '</label>';
    }
    els.types.innerHTML = html;
  }

  function apply(s) {
    els.enabled.checked = !!s.enabled;
    els.mode.value = s.mode || 'highlight';
    els.scanDynamic.checked = !!s.scanDynamic;
    els.scanShadow.checked = !!s.scanShadow;
    els.skipCodeBlocks.checked = !!s.skipCodeBlocks;
    els.minLength.value = s.minLength;
    els.maxDepth.value = s.maxDepth;
    $('minLength-val').textContent = s.minLength;
    $('maxDepth-val').textContent = s.maxDepth;
    els.blacklist.value = (s.blacklist || []).join('\n');

    var boxes = els.types.querySelectorAll('input[data-type]');
    for (var i = 0; i < boxes.length; i++) {
      var k = boxes[i].getAttribute('data-type');
      boxes[i].checked = !!s.types[k];
    }
  }

  function collect() {
    var types = {};
    var boxes = els.types.querySelectorAll('input[data-type]');
    for (var i = 0; i < boxes.length; i++) {
      types[boxes[i].getAttribute('data-type')] = boxes[i].checked;
    }
    return {
      enabled: els.enabled.checked,
      mode: els.mode.value,
      scanDynamic: els.scanDynamic.checked,
      scanShadow: els.scanShadow.checked,
      skipCodeBlocks: els.skipCodeBlocks.checked,
      minLength: parseInt(els.minLength.value, 10),
      maxDepth: parseInt(els.maxDepth.value, 10),
      showBadge: true,
      types: types,
      blacklist: els.blacklist.value.split(/[\n,]/).map(function (x) { return x.trim(); }).filter(Boolean)
    };
  }

  function save() {
    var s = collect();
    U.saveSettings(s).then(function () {
      toast('已保存');
    });
  }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 1600);
  }

  function runTest() {
    var text = $('selftest').value;
    var out = $('test-out');
    if (!text.trim()) { out.textContent = '请先输入内容。'; return; }

    var s = U.mergeSettings(collect());
    var lines = [];
    var hits = D.detectText(text, s);

    lines.push('== 自动识别（' + hits.length + ' 处命中）==');
    if (!hits.length) lines.push('（无）');
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      var chain = (h.chain && h.chain.length) ? h.chain : [h];
      lines.push('');
      lines.push('#' + (i + 1) + '  ' + h.label + '   置信度 ' + Math.round(h.score));
      lines.push('  原文: ' + trunc(h.raw, 120));
      for (var k = 0; k < chain.length; k++) {
        lines.push('  ' + (k === 0 ? '解码' : '第' + k + '层') + ': ' + trunc(chain[k].text, 200));
      }
    }

    lines.push('');
    lines.push('== 整段作为单一编码尝试 ==');
    var any = D.decodeAny(text, s);
    if (!any.length) lines.push('（无）');
    for (var j = 0; j < any.length; j++) {
      lines.push('· ' + any[j].label + '  (分 ' + Math.round(any[j].score) + ')  ->  ' + trunc(any[j].text, 160));
    }
    out.textContent = lines.join('\n');
  }

  function trunc(s, n) {
    s = String(s == null ? '' : s).replace(/\n/g, ' \\n ');
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  document.addEventListener('DOMContentLoaded', init);
})();

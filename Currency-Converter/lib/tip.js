/*!
 * CurrencyTip -- 悬停卡片提示（Shadow DOM 隔离，避免被站点样式污染）
 * 依赖注入：{ doc, win }
 * 用法：var tip = CurrencyTip.createTip({doc:doc, win:win}); tip.show({orig, from, to, out, info}, mouseEvent); tip.hide();
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') module.exports = factory();
  else root.CurrencyTip = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* 配色与扩展弹窗、悬浮面板统一（Claude 风：米白卡片 + 陶土色点缀，绝不用深色玻璃） */
  var CSS = [
    ':host{all:initial}',
    '.tip{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;',
    'opacity:0;transform:translate3d(0,5px,0) scale(.97);transform-origin:top left;',
    'transition:opacity .13s ease,transform .16s cubic-bezier(.22,1,.36,1);',
    'background:linear-gradient(180deg,#ffffff,#faf9f5);',
    'border:1px solid hsl(48 12% 87%);border-radius:13px;',
    'box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 16px 40px rgba(60,50,40,.18),0 2px 8px rgba(60,50,40,.08);',
    'padding:10px 14px 9px 15px;color:hsl(60 3% 12%);max-width:320px;overflow:hidden;',
    'font:12px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif}',
    '.tip:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;',
    'background:linear-gradient(180deg,#b6613c,#d08a63)}',
    '.tip.show{opacity:1;transform:translate3d(0,0,0) scale(1)}',
    '.t1{display:flex;align-items:center;gap:8px;color:#8b8378;font-size:11.5px;white-space:nowrap;letter-spacing:.1px}',
    '.t1 .from{text-decoration:line-through;text-decoration-color:rgba(120,110,95,.45);text-decoration-thickness:1px}',
    '.chip{flex:none;font-size:9.5px;letter-spacing:.5px;padding:1.5px 5.5px;border-radius:5px;',
    'background:rgba(182,97,60,.12);color:#8a4a2c;font-weight:600;',
    'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}',
    '.t2{display:flex;align-items:baseline;gap:8px;margin-top:5px;white-space:nowrap}',
    '.arw{flex:none;color:#b6613c;font-size:12px;line-height:1}',
    '.to{font-size:17.5px;font-weight:700;letter-spacing:.2px;color:hsl(60 3% 12%)}',
    '.to .code{font-size:10.5px;font-weight:600;color:#8a4a2c;margin-left:5px;',
    'background:rgba(182,97,60,.12);padding:1px 5px;border-radius:5px;',
    'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}',
    '.ft{margin-top:8px;padding-top:7px;border-top:1px solid hsl(48 14% 90%);',
    'color:#8b8378;font-size:10.5px;white-space:nowrap;',
    'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}'
  ].join('');

  var HTML =
    '<div class="tip" data-el="tip">' +
      '<div class="t1"><span class="from" data-el="from"></span><span class="chip" data-el="chip"></span></div>' +
      '<div class="t2"><span class="arw">&#8646;</span><span class="to" data-el="to"></span><span class="code" data-el="code"></span></div>' +
      '<div class="ft" data-el="ft"></div>' +
    '</div>';

  function createTip(cfg) {
    cfg = cfg || {};
    var doc = cfg.doc || document;
    var win = cfg.win || window;
    var host = doc.createElement('div');
    host.className = 'cc-tip-host';
    host.setAttribute('data-cc-skip', '');
    host.style.cssText = 'all:initial';
    (doc.documentElement || doc.body).appendChild(host);
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    root.innerHTML = '<style>' + CSS + '</style>' + HTML;

    var box = root.querySelector('[data-el="tip"]');
    var elFrom = root.querySelector('[data-el="from"]');
    var elChip = root.querySelector('[data-el="chip"]');
    var elTo = root.querySelector('[data-el="to"]');
    var elCode = root.querySelector('[data-el="code"]');
    var elFt = root.querySelector('[data-el="ft"]');
    var visible = false;

    function place(ev) {
      var de = doc.documentElement || {};
      var vw = win.innerWidth || de.clientWidth || 1024;
      var vh = win.innerHeight || de.clientHeight || 768;
      var rect = box.getBoundingClientRect ? box.getBoundingClientRect() : { width: 0, height: 0 };
      var w = rect.width || 210;
      var h = rect.height || 68;
      var cx = (ev && ev.clientX) || 0;
      var cy = (ev && ev.clientY) || 0;
      var x = cx + 14;
      var y = cy + 18;
      if (x + w > vw - 8) x = Math.max(8, cx - w - 14);
      if (y + h > vh - 8) y = Math.max(8, cy - h - 14);
      box.style.left = Math.round(x) + 'px';
      box.style.top = Math.round(y) + 'px';
    }

    function show(data, ev) {
      data = data || {};
      if (!data.out && !data.orig) return false;
      elFrom.textContent = data.orig || '';
      elChip.textContent = data.from || '';
      elChip.style.display = data.from ? '' : 'none';
      elTo.textContent = data.out || '';
      elCode.textContent = data.to || '';
      elFt.textContent = data.info || '';
      elFt.style.display = data.info ? '' : 'none';
      place(ev);
      box.classList.add('show');
      visible = true;
      return true;
    }

    function hide() {
      if (!visible) return false;
      box.classList.remove('show');
      visible = false;
      return true;
    }

    return {
      host: host,
      root: root,
      box: box,
      show: show,
      hide: hide,
      isVisible: function () { return visible; },
      destroy: function () { if (host.parentNode) host.parentNode.removeChild(host); }
    };
  }

  return { createTip: createTip, CSS: CSS, HTML: HTML };
});

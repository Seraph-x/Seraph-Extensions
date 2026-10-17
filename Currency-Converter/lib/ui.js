/*!
 * CurrencyPanel -- 悬浮控制面板（Shadow DOM 隔离样式）
 * 依赖注入：{ getSettings, onSettings, onAction, doc, win, collapsed }
 * 交互：标题栏可拖动、双击收起；右上角 ⚙ 高级、— 收起为小胶囊；胶囊点击展开
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') module.exports = factory();
  else root.CurrencyPanel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var HTML =
    '<style>' + ":host{all:initial}.box{position:fixed;z-index:2147483646;right:18px;bottom:18px;font:13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;color:hsl(60 3% 12%);-webkit-font-smoothing:antialiased}@keyframes cc-pop{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}.panel{width:318px;border-radius:16px;overflow:hidden;background:linear-gradient(180deg,#ffffff,#fdfcf8);border:1px solid hsl(48 12% 87%);box-shadow:0 18px 46px rgba(60,50,40,.18),0 2px 8px rgba(60,50,40,.08);animation:cc-pop .2s cubic-bezier(.22,1,.36,1)}.hd{display:flex;align-items:center;gap:9px;padding:11px 9px 11px 12px;cursor:move;user-select:none;background:linear-gradient(135deg,rgba(182,97,60,.12),rgba(182,97,60,.03));border-bottom:1px solid hsl(48 14% 90%)}.logo{flex:none;width:27px;height:27px;border-radius:9px;display:grid;place-items:center;font-size:14px;color:#faf9f5;background:linear-gradient(135deg,#b6613c,#d08a63);box-shadow:0 4px 12px rgba(182,97,60,.28)}.tt{flex:1;min-width:0}.tt b{display:block;font-size:13px;font-weight:600;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tt span{display:block;font-size:10.5px;color:#8b8378;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ibtn{all:unset;cursor:pointer;flex:none;width:24px;height:24px;border-radius:8px;display:grid;place-items:center;font-size:13px;color:#6b6a63;transition:background .15s,color .15s}.ibtn:hover{background:rgba(60,50,40,.08);color:hsl(60 3% 12%)}.bd{padding:12px 12px 10px;display:grid;gap:11px}.row{display:flex;align-items:center;gap:10px;min-height:26px}.row>label{flex:1;color:#6b6a63;font-size:12px}select,input[type=text],input[type=number]{all:unset;box-sizing:border-box;flex:0 1 auto;min-width:120px;max-width:178px;padding:6px 26px 6px 9px;color:hsl(60 3% 12%);font:12px inherit;cursor:pointer;border-radius:9px;background-color:#fff;border:1px solid hsl(48 12% 87%);transition:border-color .15s,box-shadow .15s;background-image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6'><path d='M1 1l4 4 4-4' fill='none' stroke='%238b8378' stroke-width='1.6' stroke-linecap='round'/></svg>\");background-repeat:no-repeat;background-position:right 9px center}select:hover{border-color:hsl(48 12% 74%)}select:focus{border-color:#b6613c;box-shadow:0 0 0 3px rgba(182,97,60,.18)}.seg{display:flex;flex:none;gap:2px;padding:2px;border-radius:9px;background:hsl(48 30% 95.5%);border:1px solid hsl(48 12% 88%)}.seg button{all:unset;cursor:pointer;padding:4px 9px;border-radius:7px;font-size:11.5px;color:#6b6a63;transition:.15s}.seg button:hover{color:hsl(60 3% 12%)}.seg button.on{background:#fff;color:#a8542f;font-weight:600;box-shadow:0 1px 3px rgba(60,50,40,.14)}.sw{position:relative;flex:none;width:42px;height:23px;border-radius:12px;background:#d8d3c8;cursor:pointer;transition:background .2s}.sw i{position:absolute;top:2.5px;left:2.5px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .2s cubic-bezier(.22,1,.36,1)}.sw.on{background:linear-gradient(135deg,#b6613c,#d08a63)}.sw.on i{transform:translateX(19px)}.rate{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:10px;font-size:11.5px;color:#6b6a63;background:hsl(48 30% 96.5%);border:1px solid hsl(48 14% 90%);word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.dot{flex:none;width:7px;height:7px;border-radius:50%;background:#3f9e6b;box-shadow:0 0 0 3px rgba(63,158,107,.18)}.dot.warn{background:#d8a13c;box-shadow:0 0 0 3px rgba(216,161,60,.18)}.dot.err{background:#c2503c;box-shadow:0 0 0 3px rgba(194,80,60,.18)}.acts{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}button.btn{all:unset;cursor:pointer;box-sizing:border-box;text-align:center;padding:7px 6px;border-radius:10px;font-size:11.5px;white-space:nowrap;color:#faf9f5;background:linear-gradient(135deg,#b6613c,#c9773f);box-shadow:0 4px 14px rgba(182,97,60,.26);transition:filter .15s,transform .1s}button.btn:hover{filter:brightness(1.1)}button.btn:active{transform:translateY(1px)}button.btn.sec{background:#fff;color:#4a4740;box-shadow:0 1px 2px rgba(60,50,40,.06);border:1px solid hsl(48 12% 87%)}button.btn.sec:hover{background:hsl(48 30% 96%)}.stat{font-size:11px;color:#8b8378;min-height:14px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.adv{display:none;gap:9px}.adv.show{display:grid;animation:cc-pop .18s ease}.adv .acts{grid-template-columns:1fr 1fr}.hint{font-size:11px;color:#8b8378;line-height:1.45}textarea{all:unset;box-sizing:border-box;width:100%;height:74px;padding:7px 9px;border-radius:9px;color:hsl(60 3% 12%);background:#fff;border:1px solid hsl(48 12% 87%);white-space:pre;overflow:auto;font:11px/1.5 ui-monospace,Menlo,Consolas,monospace}textarea:focus{border-color:#b6613c;box-shadow:0 0 0 3px rgba(182,97,60,.18)}a{color:#a8542f;text-decoration:none}.launcher{all:unset;box-sizing:border-box;display:none;align-items:center;gap:8px;height:42px;padding:0 13px 0 10px;cursor:pointer;border-radius:21px;color:hsl(60 3% 12%);font:12px/1 inherit;background:linear-gradient(180deg,#fff,#fdfcf8);border:1px solid hsl(48 12% 87%);box-shadow:0 10px 28px rgba(60,50,40,.18);transition:border-color .15s,transform .15s}.launcher:hover{border-color:hsl(48 12% 70%);transform:translateY(-1px)}.launcher .ic{flex:none;width:26px;height:26px;border-radius:9px;display:grid;place-items:center;font-size:13px;color:#faf9f5;background:linear-gradient(135deg,#b6613c,#d08a63);box-shadow:0 4px 12px rgba(182,97,60,.28)}.launcher .code{font-weight:600;letter-spacing:.4px}.launcher .cnt{color:#8b8378;font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.box.off .launcher .ic{background:linear-gradient(135deg,#c9c4b8,#b5b0a4);box-shadow:none}.box.off .launcher .code{color:#8b8378}.box.collapsed .panel{display:none}.box.collapsed .launcher{display:flex}.box.off .logo{background:linear-gradient(135deg,#c9c4b8,#b5b0a4);box-shadow:none}" + '</style>' +
    "<div class=\"box\" data-el=\"box\"><div class=\"panel\"><div class=\"hd\" data-el=\"hd\"><span class=\"logo\">&#8646;</span><span class=\"tt\"><b>货币自动换算</b><span data-el=\"sub\">正在载入设置…</span></span><button class=\"ibtn\" data-act=\"adv\" title=\"高级设置\">&#9881;</button><button class=\"ibtn\" data-act=\"collapse\" title=\"收起为小胶囊\">&#8211;</button></div><div class=\"bd\"><div class=\"row\"><label>启用换算</label><div class=\"sw\" data-act=\"toggle\" title=\"开 / 关\"><i></i></div></div><div class=\"row\"><label>目标货币</label><select data-act=\"target\"></select></div><div class=\"row\"><label>显示方式</label><div class=\"seg\" data-el=\"seg\"><button data-act=\"mode\" data-v=\"replace\">替换</button><button data-act=\"mode\" data-v=\"append\">追加</button><button data-act=\"mode\" data-v=\"tooltip\">悬停</button></div></div><div class=\"row\"><label>小数位</label><select data-act=\"decimals\"><option value=\"auto\">自动</option><option value=\"0\">0 位</option><option value=\"1\">1 位</option><option value=\"2\">2 位</option><option value=\"3\">3 位</option><option value=\"4\">4 位</option></select></div><div class=\"rate\"><span class=\"dot\" data-el=\"dot\"></span><span data-el=\"rate\">正在获取汇率…</span></div><div class=\"acts\"><button class=\"btn\" data-act=\"rescan\">重新扫描</button><button class=\"btn sec\" data-act=\"undo\">还原原文</button><button class=\"btn sec\" data-act=\"refresh\">刷新汇率</button></div><div class=\"stat\" data-el=\"stat\"></div><div class=\"adv\" data-el=\"adv\"><div class=\"hint\">站点黑名单：每行一个，支持 *.example.com</div><textarea data-el=\"blacklist\" spellcheck=\"false\"></textarea><div class=\"acts\"><button class=\"btn sec\" data-act=\"save-adv\">保存名单</button><button class=\"btn sec\" data-act=\"clear-cache\">清空汇率缓存</button></div></div></div></div><button class=\"launcher\" data-act=\"expand\" title=\"展开面板（Alt+Shift+C）\"><span class=\"ic\">&#8646;</span><span class=\"code\" data-el=\"laCode\">CNY</span><span class=\"cnt\" data-el=\"laCnt\"></span></button></div>";

  function mount(cfg) {
    cfg = cfg || {};
    var doc = cfg.doc || document;
    var win = cfg.win || window;
    var getSettings = cfg.getSettings || function () { return {}; };
    var onSettings = cfg.onSettings || function () {};
    var onAction = cfg.onAction || function () {};
    var host = doc.createElement('div');
    host.className = 'cc-root';
    host.setAttribute('data-cc-skip', '');
    host.style.cssText = 'all:initial';
    doc.documentElement.appendChild(host);
    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML = HTML;

    var box = root.querySelector('[data-el="box"]');
    var els = {};
    ['rate', 'dot', 'stat', 'adv', 'blacklist', 'sub', 'seg', 'laCode', 'laCnt', 'hd'].forEach(function (k) {
      els[k] = root.querySelector('[data-el="' + k + '"]');
    });
    var sw = root.querySelector('[data-act="toggle"]');
    var selTarget = root.querySelector('[data-act="target"]');
    var selDec = root.querySelector('[data-act="decimals"]');
    var launcher = root.querySelector('.launcher');
    var collapsed = false;

    function fillTargets(list, current) {
      selTarget.innerHTML = '';
      list.forEach(function (c) {
        var o = doc.createElement('option');
        o.value = c.code;
        o.textContent = c.code + ' ' + c.name;
        selTarget.appendChild(o);
      });
      selTarget.value = current;
      els.laCode.textContent = current || selTarget.value || 'CNY';
    }

    function sync(s) {
      s = s || {};
      sw.classList.toggle('on', !!s.enabled);
      box.classList.toggle('off', !s.enabled);
      if (s.target) selTarget.value = s.target;
      var mode = s.displayMode || 'replace';
      Array.prototype.forEach.call(els.seg.querySelectorAll('[data-act="mode"]'), function (b) {
        b.classList.toggle('on', b.getAttribute('data-v') === mode);
      });
      selDec.value = String(s.decimals == null ? 'auto' : s.decimals);
      els.blacklist.value = (s.blacklist || []).join('\n');
      var code = s.target || selTarget.value || 'CNY';
      els.laCode.textContent = code;
      els.sub.textContent = (s.enabled ? '换算为 ' + code : '已停用') + ' · 实时汇率';
      launcher.setAttribute('title', (s.enabled ? '换算为 ' + code : '已停用') + ' — 点击展开面板（Alt+Shift+C）');
    }

    function setStat(txt) {
      txt = txt || '';
      els.stat.textContent = txt;
      var m = /已换算\s*(\d+)/.exec(txt);
      els.laCnt.textContent = m ? m[1] + ' 处' : '';
    }

    function setRate(txt, kind) {
      txt = txt || '';
      els.rate.textContent = txt;
      var k = kind;
      if (!k) {
        if (/失败|错误|无法/.test(txt)) k = 'err';
        else if (/缓存|过期|尚未/.test(txt)) k = 'warn';
        else k = 'ok';
      }
      els.dot.className = 'dot' + (k === 'ok' ? '' : ' ' + k);
    }

    function collapse(v) {
      collapsed = (v === undefined) ? !collapsed : !!v;
      box.classList.toggle('collapsed', collapsed);
      onAction('collapsed', collapsed);
      return collapsed;
    }

    root.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!t) return;
      var act = t.getAttribute('data-act');
      if (act === 'toggle') { onSettings({ enabled: !getSettings().enabled }); sync(getSettings()); }
      else if (act === 'adv') { els.adv.classList.toggle('show'); }
      else if (act === 'collapse') { collapse(true); }
      else if (act === 'expand') { collapse(false); }
      else if (act === 'mode') { onSettings({ displayMode: t.getAttribute('data-v'), modeTouched: true }); sync(getSettings()); }
      else if (act === 'rescan') { onAction('rescan'); }
      else if (act === 'undo') { onAction('undo'); }
      else if (act === 'refresh') { onAction('refresh'); }
      else if (act === 'clear-cache') { onAction('clear-cache'); }
      else if (act === 'save-adv') {
        var lines = els.blacklist.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
        onSettings({ blacklist: lines });
        onAction('saved');
      }
    });
    selTarget.addEventListener('change', function () { onSettings({ target: selTarget.value }); });
    selDec.addEventListener('change', function () { onSettings({ decimals: selDec.value === 'auto' ? 'auto' : Number(selDec.value) }); });

    /* 双击标题栏也可收起 / 展开 */
    els.hd.addEventListener('dblclick', function () { collapse(); });

    /* 拖动：面板与胶囊共用 */
    (function () {
      var dragging = false, sx = 0, sy = 0, r0 = null;
      function start(e) {
        if (e.button) return;
        dragging = true; sx = e.clientX; sy = e.clientY;
        r0 = box.getBoundingClientRect();
        e.preventDefault();
      }
      els.hd.addEventListener('mousedown', start);
      launcher.addEventListener('mousedown', start);
      win.addEventListener('mousemove', function (e) {
        if (!dragging) return;
        box.style.left = Math.max(4, Math.min(win.innerWidth - r0.width - 4, r0.left + (e.clientX - sx))) + 'px';
        box.style.top = Math.max(4, Math.min(win.innerHeight - 40, r0.top + (e.clientY - sy))) + 'px';
        box.style.right = 'auto'; box.style.bottom = 'auto';
      });
      win.addEventListener('mouseup', function () { dragging = false; });
    })();

    if (cfg.collapsed) collapse(true);

    return {
      host: host, root: root, box: box, sync: sync, setStat: setStat, setRate: setRate,
      fillTargets: fillTargets, collapse: collapse,
      isCollapsed: function () { return collapsed; },
      show: function () { host.style.display = ''; collapse(false); },
      hide: function () { host.style.display = 'none'; },
      toggle: function () { if (host.style.display === 'none') { this.show(); } else { this.hide(); } },
      destroy: function () { host.remove(); }
    };
  }

  return { mount: mount, HTML: HTML };
});
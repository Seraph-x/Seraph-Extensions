/*!
 * popup.js —— 扩展弹窗控制器
 * 布局：头部（站点 + 总开关）/ 设置卡片 / 汇率条 / 操作按钮 / 高级设置 / 底部状态
 */
(function () {
  'use strict';
  var D = CurrencyDefaults, Core = CurrencyCore;
  var $ = function (id) { return document.getElementById(id); };
  var settings = D.normalize(null);
  var activeTab = null;
  var lastHost = '';

  /* ---------------- 存储 ---------------- */
  function loadSettings() {
    return new Promise(function (resolve) {
      chrome.storage.sync.get('cc:settings', function (o) {
        resolve(o && o['cc:settings'] ? o['cc:settings'] : null);
      });
    });
  }
  /* chrome.storage.sync 有配额：MAX_WRITE_OPERATIONS_PER_MINUTE = 120、每小时 1800。
     所以写入要 (1) 内容没变就不写 (2) 连续改动合并成一次 (3) 读 lastError，配额超了就退避重试。 */
  var savedJson = '';
  var saveTimer = null;
  var retryTimer = null;
  var retryCount = 0;

  function writeSettings() {
    var json = JSON.stringify(settings);
    if (json === savedJson) return;
    savedJson = json;
    var o = {}; o['cc:settings'] = settings;
    chrome.storage.sync.set(o, function () {
      var err = chrome.runtime.lastError;
      if (!err) {
        if (retryCount) { retryCount = 0; try { askStats(300); } catch (e) { /* ignore */ } }
        return;
      }
      /* 写失败（配额 / 同步错误）：把状态标成「未保存」，稍后重试一次，别让设置卡在弹窗里 */
      savedJson = '';
      try { $('stat').textContent = '\u8bbe\u7f6e\u6682\u65f6\u6ca1\u5b58\u4e0a\uff0c\u6b63\u5728\u91cd\u8bd5\u2026'; } catch (e) { /* ignore */ }
      if (retryCount < 3 && !retryTimer) {
        retryCount++;
        retryTimer = setTimeout(function () {
          retryTimer = null;
          writeSettings();
        }, 1500 * retryCount);
      }
    });
  }

  function saveSettings(now) {
    if (saveTimer) { if (!now) return; clearTimeout(saveTimer); saveTimer = null; }
    if (now) { writeSettings(); return; }
    saveTimer = setTimeout(function () { saveTimer = null; writeSettings(); }, 250);
  }
  function saveLocal(state) {
    var o = {}; o['cc:ui'] = state; chrome.storage.local.set(o, function () { });
  }
  function loadLocal() {
    return new Promise(function (resolve) {
      chrome.storage.local.get('cc:ui', function (o) { resolve(o && o['cc:ui'] ? o['cc:ui'] : {}); });
    });
  }

  /* ---------------- 和内容脚本通信 ---------------- */
  function tell(tabId, msg, cb) {
    if (!tabId) { if (cb) cb(null); return; }
    chrome.tabs.sendMessage(tabId, msg, function (resp) {
      if (chrome.runtime.lastError) { if (cb) cb(null); return; }
      if (cb) cb(resp || null);
    });
  }
  function refreshTab(reset) {
    if (!activeTab || !activeTab.id) return;
    tell(activeTab.id, { type: 'cc:apply', settings: settings, reset: !!reset });
  }

  function fillCurrencies() {
    var order = D.COMMON.filter(function (c) { return Core.CURRENCIES[c]; });
    Object.keys(Core.CURRENCIES).forEach(function (c) { if (order.indexOf(c) < 0) order.push(c); });
    var html = order.map(function (c) {
      var info = Core.CURRENCIES[c];
      return '<option value="' + c + '">' + c + ' — ' + (info && info.name ? info.name : '') + '</option>';
    }).join('');
    $('target').innerHTML = html;
    $('bareCurrency').innerHTML = html;
  }

  function render() {
    $('enabled').checked = !!settings.enabled;
    $('target').value = settings.target;
    $('displayMode').value = settings.displayMode;
    $('decimals').value = String(settings.decimals);
    $('symbolStyle').value = settings.symbolStyle;
    $('ttlHours').value = String(settings.ttlHours);
    $('siteMode').value = settings.siteMode;
    $('blacklist').value = (settings.blacklist || []).join('\n');
    $('whitelist').value = (settings.whitelist || []).join('\n');
    $('highlight').checked = !!settings.highlight;
    $('convertSameCurrency').checked = !!settings.convertSameCurrency;
    $('convertBare').checked = !!settings.convertBare;
    $('bareCurrency').value = settings.bareCurrency || 'USD';
  }

  function lines(id) {
    return $(id).value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function onEdit(key, getter) {
    return function () {
      settings = D.merge(settings, (function () { var o = {}; o[key] = getter(); return o; })());
      saveSettings();
      refreshTab(key === 'target' || key === 'decimals' || key === 'symbolStyle' || key === 'enabled');
      askStats(700);
    };
  }

  /* ---------------- 汇率条 ---------------- */
  function rateLine() {
    var t = settings.target;
    chrome.runtime.sendMessage({ type: 'cc:rates', force: false, ttlHours: settings.ttlHours, source: settings.source }, function (resp) {
      if (chrome.runtime.lastError || !resp || !resp.ok || !resp.data) {
        $('rate').textContent = '汇率获取失败，点右侧「刷新汇率」重试';
        $('rate').className = 'rate err';
        if ($('dot')) $('dot').className = 'dot err';
        return;
      }
      var d = resp.data, v = d.rates && d.rates[t];
      var ago = Math.round((Date.now() - d.fetchedAt) / 60000);
      var when = ago < 1 ? '刚刚' : (ago < 60 ? ago + ' 分钟前' : Math.round(ago / 60) + ' 小时前');
      $('rate').textContent = '1 USD = ' + (v || '?') + ' ' + t + ' · ' + when + ' · ' + (d.source || '') + (d.stale ? ' · 缓存' : '');
      $('rate').className = 'rate' + (d.stale ? ' warn' : '');
      if ($('dot')) $('dot').className = 'dot' + (d.stale ? ' warn' : '');
    });
  }

  /* ---------------- 底部状态条 ---------------- */
  function renderStat(info) {
    var ft = document.querySelector('.ft'), el = $('stat');
    if (!ft || !el) return;
    ft.className = 'ft';
    if (!settings.enabled) { ft.classList.add('off'); el.textContent = '已停用 · 页面保持原始金额'; return; }
    if (lastHost && !D.siteAllowed(settings, lastHost)) {
      ft.classList.add('off');
      el.textContent = lastHost + ' 未生效（黑名单内 / 不在白名单）';
      return;
    }
    var st = info && info.stats;
    if (st && typeof st.converted === 'number') {
      ft.classList.add('on');
      el.textContent = '已换算 ' + st.converted + ' 处' + (info.role === 'standby' ? ' · 同级实例执行' : '');
      return;
    }
    if (info && info.role) {
      ft.classList.add('warn');
      el.textContent = info.role === 'skip' ? '本页在名单内，未运行' : '已生效，本页暂无可换算金额';
      return;
    }
    ft.classList.add('err');
    el.textContent = '本页没有运行（刷新页面后重试，或检查扩展是否已启用）';
  }

  function askStats(delay) {
    if (!activeTab || !activeTab.id) { renderStat(null); return; }
    setTimeout(function () { tell(activeTab.id, { type: 'cc:stats' }, renderStat); }, delay || 0);
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    fillCurrencies();
    loadSettings().then(function (s) {
      /* 显示方式默认「替换原文」：没手动选过（modeTouched）就用 replace，并把结果写回 */
      settings = D.normalize(s);
      savedJson = s ? JSON.stringify(s) : '';
      if (s && (s.displayMode !== settings.displayMode || s.modeTouched !== settings.modeTouched)) saveSettings();
      render();
      rateLine();
      /* 打开弹窗就把设置（含默认的替换模式）推到页面 */
      if (activeTab && activeTab.id) refreshTab(false);
    });

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      activeTab = tabs && tabs[0];
      var host = '';
      try { host = new URL(activeTab.url).hostname; } catch (e) { host = ''; }
      lastHost = host;
      if (host) {
        var blocked = D.hostMatches(host, settings.blacklist);
        $('enabled').title = blocked ? ('已在黑名单中：' + host) : ('当前站点：' + host);
        if ($('host')) $('host').textContent = blocked ? (host + ' · 黑名单') : host;
      }
      /* 打开弹窗就把设置同步到页面，并回报实际换算数量 */
      if (activeTab && activeTab.id) { refreshTab(false); askStats(500); }
      else { renderStat(null); }
    });

    $('enabled').addEventListener('change', onEdit('enabled', function () { return $('enabled').checked; }));
    $('target').addEventListener('change', onEdit('target', function () { return $('target').value; }));
    /* 手动选过显示方式才记住，否则一直回到默认的「替换原文」 */
    $('displayMode').addEventListener('change', function () {
      settings = D.merge(settings, { displayMode: $('displayMode').value, modeTouched: true });
      saveSettings();
      refreshTab(false);
      askStats(700);
    });
    $('decimals').addEventListener('change', onEdit('decimals', function () { return $('decimals').value; }));
    $('symbolStyle').addEventListener('change', onEdit('symbolStyle', function () { return $('symbolStyle').value; }));
    $('siteMode').addEventListener('change', onEdit('siteMode', function () { return $('siteMode').value; }));
    $('ttlHours').addEventListener('change', onEdit('ttlHours', function () { return Number($('ttlHours').value); }));
    $('blacklist').addEventListener('change', onEdit('blacklist', function () { return lines('blacklist'); }));
    $('whitelist').addEventListener('change', onEdit('whitelist', function () { return lines('whitelist'); }));
    $('highlight').addEventListener('change', onEdit('highlight', function () { return $('highlight').checked; }));
    $('convertSameCurrency').addEventListener('change', onEdit('convertSameCurrency', function () { return $('convertSameCurrency').checked; }));
    $('convertBare').addEventListener('change', onEdit('convertBare', function () { return $('convertBare').checked; }));
    $('bareCurrency').addEventListener('change', onEdit('bareCurrency', function () { return $('bareCurrency').value; }));

    $('rescan').addEventListener('click', function () {
      refreshTab(true);
      askStats(800);
      $('rescan').textContent = '已重新扫描';
      setTimeout(function () { $('rescan').textContent = '重新扫描'; }, 900);
    });
    /* 只还原页面文本，不改「启用」状态（否则点一次就永久停用了） */
    $('undo').addEventListener('click', function () {
      tell(activeTab && activeTab.id, { type: 'cc:undo' });
      askStats(500);
    });
    $('refresh').addEventListener('click', function () {
      $('rate').textContent = '正在刷新…';
      chrome.runtime.sendMessage({ type: 'cc:rates', force: true, ttlHours: settings.ttlHours, source: settings.source }, function () {
        rateLine();
        refreshTab(true);
        askStats(800);
      });
    });
    $('resetDefaults').addEventListener('click', function () {
      settings = D.normalize(null);
      saveSettings();
      render();
      refreshTab(true);
      askStats(800);
      $('resetDefaults').textContent = '已恢复默认';
      setTimeout(function () { $('resetDefaults').textContent = '恢复默认设置'; }, 1200);
    });
    $('clearCache').addEventListener('click', function () {
      chrome.runtime.sendMessage({ type: 'cc:clear-cache' }, function () {
        $('rate').textContent = '缓存已清空';
        chrome.runtime.sendMessage({ type: 'cc:rates', force: true, ttlHours: settings.ttlHours, source: settings.source }, function () {
          rateLine(); refreshTab(true); askStats(800);
        });
      });
    });
    $('diagnose').addEventListener('click', function () {
      $('diag').textContent = '检查中…';
      tell(activeTab && activeTab.id, { type: 'cc:diagnose' }, function (r) {
        $('diag').textContent = JSON.stringify(r, null, 2);
      });
    });

    var adv = document.querySelector('details.adv');
    loadLocal().then(function (st) { if (st && st.advOpen && adv) adv.open = true; });
    if (adv) adv.addEventListener('toggle', function () { saveLocal({ advOpen: adv.open }); });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

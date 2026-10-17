/*!
 * 扩展内容脚本：单实例选举 + 设置同步 + 汇率装载 + 引擎
 * 注：扩展版没有页内面板（悬浮面板只属于油猴脚本版），所有操作都从扩展弹窗发起；
 *     若本页已被油猴脚本接管，本脚本进入待命，把设置与动作通过 DOM 事件转交给它。
 */
(function () {
  'use strict';
  if (window.__ccScriptLoaded) return;
  window.__ccScriptLoaded = true;

  var D = CurrencyDefaults, Core = CurrencyCore, Eng = CurrencyEngine,
      Bus = (typeof CurrencyBus !== 'undefined' ? CurrencyBus : null);

  var SET_KEY = 'cc:settings';

  var storage = {
    get: function (key, def) {
      return new Promise(function (resolve) {
        try {
          chrome.storage.sync.get(key, function (o) {
            resolve(o && o[key] !== undefined ? o[key] : def);
          });
        } catch (e) { resolve(def); }
      });
    },
    set: function (key, val) {
      return new Promise(function (resolve) {
        try {
          var o = {}; o[key] = val;
          chrome.storage.sync.set(o, function () { resolve(); });
        } catch (e) { resolve(); }
      });
    }
  };

  var settings = D.normalize(null);
  var ratesState = null;
  var engine = null;
  var role = 'pending';
  var bus = Bus ? Bus.createBus({ doc: document, win: window, kind: 'extension' }) : null;

  function getRates() { return ratesState; }

  function loadRates(force) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage({ type: 'cc:rates', force: !!force, ttlHours: settings.ttlHours, source: settings.source },
          function (resp) {
            if (resp && resp.ok && resp.data) { ratesState = resp.data; }
            resolve(ratesState);
          });
      } catch (e) { resolve(ratesState); }
    });
  }

  function rateText() {
    if (!ratesState) return '尚未取得汇率';
    var t = ratesState.rates && ratesState.rates[settings.target];
    var ago = Math.round((Date.now() - ratesState.fetchedAt) / 60000);
    var when = ago < 1 ? '刚刚' : (ago < 60 ? ago + ' 分钟前' : Math.round(ago / 60) + ' 小时前');
    return '1 USD = ' + (t || '?') + ' ' + settings.target + '  \u00b7  ' + when +
      (ratesState.stale ? '  (缓存)' : '  [' + (ratesState.source || '') + ']');
  }

  /* 运行状态写到 <html data-cc-stats>，弹窗（另一个执行环境）据此显示 已换算 N 处 */
  function updateStats() {
    if (!bus) return;
    bus.writeStats({
      role: role,
      kind: 'extension',
      target: settings.target,
      enabled: !!settings.enabled,
      allowed: D.siteAllowed(settings, location.hostname),
      converted: engine ? engine.stats.converted : 0,
      scannedAt: engine ? engine.stats.scannedAt : 0,
      lastError: engine ? (engine.stats.lastError || '') : '',
      at: Date.now()
    });
  }

  /* chrome.storage.sync 写入配额很紧（每分钟 120 次、每小时 1800 次）：
     内容没变就不写、连点合并成一次、读 lastError 免得在 chrome://extensions 报未捕获错误。 */
  var savedJson = '';
  var saveTimer = null;

  function saveSync(now) {
    if (saveTimer) { if (!now) return; clearTimeout(saveTimer); saveTimer = null; }
    var run = function () {
      saveTimer = null;
      var json = JSON.stringify(settings);
      if (json === savedJson) return;
      savedJson = json;
      try {
        var o = {}; o[SET_KEY] = settings;
        chrome.storage.sync.set(o, function () {
          if (chrome.runtime.lastError) savedJson = '';   /* 写失败就当没保存，下次改动再写 */
        });
      } catch (e) { savedJson = ''; }
    };
    if (now) run(); else saveTimer = setTimeout(run, 400);
  }

  /* fromStorage = true：这次改动本身就是存储推过来的，绝对不能再写回去，
     否则「存储 -> 内容脚本 -> 存储」会自我放大，一个弹窗操作乘以标签页数量就爆配额 */
  function applySettings(patch, fromStorage) {
    settings = D.merge(settings, patch || {});
    if (!fromStorage) saveSync();
    /* 主实例把设置广播出去，让待命的另一个实例保持镜像（避免两个实例设置不一致） */
    if (bus && bus.isOwner()) bus.emitSettings(settings);
    updateStats();
    if (!engine) return Promise.resolve();
    var blocked = !D.siteAllowed(settings, location.hostname);
    return engine.updateSettings(settings).then(function () {
      if (blocked) { engine.revert(); return null; }
      if (patch && ('source' in patch || 'ttlHours' in patch)) {
        return loadRates(true).then(function () { engine.apply(); });
      }
      return null;
    }).then(updateStats);
  }

  function runAction(act, val) {
    if (act === 'collapsed') { settings = D.merge(settings, { panelCollapsed: !!val }); saveSync(); return; }
    if (act === 'settings') { applySettings(val); return; }
    if (!engine) return;
    if (act === 'rescan') { engine.apply(); updateStats(); }
    else if (act === 'undo') { engine.revert(); updateStats(); }
    else if (act === 'refresh') { loadRates(true).then(function () { engine.apply(); updateStats(); }); }
    else if (act === 'clear-cache') {
      try {
        chrome.runtime.sendMessage({ type: 'cc:clear-cache' }, function () {
          loadRates(true).then(function () { engine.apply(); updateStats(); });
        });
      } catch (e) { /* ignore */ }
    }
  }

  function act(name, val) {
    if (bus && !bus.isOwner()) { bus.emitAction(name, val); return; }
    runAction(name, val);
  }

  function boot() {
    /* 站点黑名单：不接管，把机会让给另一个实例 */
    if (!D.siteAllowed(settings, location.hostname)) { role = 'skip'; window.__ccRole = 'skip'; updateStats(); return; }

    /* 跨执行环境选举：油猴脚本与扩展 content script 各自在 isolated world，
       window 上的标记互相看不见，只能靠 <html data-cc-host> 认主 */
    if (bus && !bus.claim()) { standby(bus.readHost()); return; }
    role = 'owner';
    window.__ccRole = 'owner';

    /* 扩展版不挂页内面板：只做换算 + 悬停卡片，全部由弹窗控制 */
    engine = Eng.createEngine({ Core: Core, settings: settings, getRates: getRates, onState: updateStats });
    window.__ccEngine = engine;

    if (bus) {
      bus.onSettings(function (patch) {
        if (!patch || typeof patch !== 'object') return;
        if (JSON.stringify(D.merge(settings, patch)) === JSON.stringify(settings)) return;
        applySettings(patch);
      });
      bus.onAction(function (name, value) { if (name) runAction(name, value); });
    }

    loadRates(false).then(function () { engine.start(); engine.apply(); updateStats(); });
  }

  function standby(host) {
    role = 'standby';
    window.__ccRole = 'standby';
    var who = host && host.kind === 'userscript' ? '油猴脚本' : (host && host.kind ? host.kind : '另一个实例');
    try {
      console.info('[货币换算] 本页已由「' + who + '」接管，本实例进入待命（不重复换算，弹窗设置会转交给它）');
    } catch (e) { /* ignore */ }
    if (bus) bus.onSettings(function (patch) { settings = D.merge(settings, patch || {}); });
  }

  /* ---------------- 弹窗消息 ---------------- */
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg) return;

    if (msg.type === 'cc:rates') {
      loadRates(!!msg.force).then(function (data) { sendResponse({ ok: !!data, data: data }); });
      return true;
    }

    if (msg.type === 'cc:stats') {
      var shared = bus ? bus.readStats() : null;
      var mine = engine ? engine.stats : null;
      sendResponse({
        ok: true,
        role: role,
        kind: 'extension',
        host: location.hostname,
        engine: mine,
        stats: mine || shared,
        who: shared ? (shared.kind || '') : 'extension'
      });
      return true;
    }

    if (msg.type === 'cc:diagnose') {
      sendResponse({
        role: role,
        kind: 'extension',
        host: location.hostname,
        settings: { enabled: settings.enabled, target: settings.target, displayMode: settings.displayMode,
          decimals: String(settings.decimals), siteMode: settings.siteMode, ttlHours: settings.ttlHours },
        siteAllowed: D.siteAllowed(settings, location.hostname),
        engine: engine ? { converted: engine.stats.converted, nodes: engine.stats.nodes,
          scannedAt: engine.stats.scannedAt, pending: engine.stats.pending, lastError: engine.stats.lastError } : null,
        rates: ratesState ? { base: ratesState.base, date: ratesState.date, source: ratesState.source,
          fetchedAt: ratesState.fetchedAt, stale: !!ratesState.stale,
          codes: ratesState.rates ? Object.keys(ratesState.rates).length : 0 } : null,
        election: bus ? { id: bus.id, owner: bus.isOwner(), host: bus.readHost() } : null
      });
      return true;
    }

    if (msg.type === 'cc:undo') {
      if (role !== 'owner') {
        if (bus) bus.emitAction('undo');
        sendResponse({ ok: true, delegated: true });
        return true;
      }
      if (engine) engine.revert();
      updateStats();
      sendResponse({ ok: true, converted: engine ? engine.stats.converted : 0 });
      return true;
    }

    if (msg.type === 'cc:apply') {
      /* 待命实例：把设置/动作通过 DOM 事件转交给真正干活的实例 */
      if (role !== 'owner') {
        if (msg.settings) {
          settings = D.merge(settings, msg.settings);
          if (bus) bus.emitSettings(settings);
        }
        if (msg.reset || msg.force) { if (bus) bus.emitAction('refresh', true); }
        sendResponse({ ok: true, delegated: true, role: role });
        return true;
      }
      if (msg.settings) { settings = D.merge(settings, msg.settings); }
      var blocked = !settings.enabled || !D.siteAllowed(settings, location.hostname);
      /* 关键：设置必须先推进引擎，再决定扫描还是还原。
         漏掉 updateSettings 会导致「popup 改了目标币种但页面纹丝不动」，
         以及「停用后又被 MutationObserver 重新注入」 */
      engine.updateSettings(settings).then(function () {
        if (blocked) { engine.revert(); return null; }
        if (msg.reset || msg.force) return loadRates(!!msg.force).then(function () { engine.apply(); });
        engine.apply();
        return null;
      }).then(function () {
        if (bus) bus.emitSettings(settings);
        updateStats();
        sendResponse({ ok: true, converted: engine.stats.converted, role: role });
      });
      return true;
    }

    /* 兼容旧消息：扩展自己不再挂面板，只把动作转给持有面板的实例 */
    if (msg.type === 'cc:toggle-panel' || msg.type === 'cc:panel') {
      if (role === 'owner') { sendResponse({ ok: true, noPanel: true }); }
      else {
        if (bus) bus.emitAction(msg.type === 'cc:panel' ? 'collapse' : 'toggle-panel',
          msg.type === 'cc:panel' ? !!msg.collapsed : undefined);
        sendResponse({ ok: true, delegated: true });
      }
      return true;
    }
  });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'sync' || !changes[SET_KEY]) return;
    var next = changes[SET_KEY].newValue;
    if (!next) return;
    if (JSON.stringify(D.merge(settings, next)) === JSON.stringify(settings)) return;
    applySettings(next, true);
  });

  storage.get(SET_KEY, null).then(function (saved) {
    if (saved && typeof saved === 'object') { settings = D.normalize(saved); savedJson = JSON.stringify(saved); }
    /* 从没在弹窗里手动选过显示方式 -> 一律回到默认「替换原文」，并把归一化结果写回存储。
       注意：只有「存储里已有旧数据、且归一化后有变化」才写。全新的配置不写，
       否则同时开 10 个标签页就会一起写 10 次（chrome.storage.sync 每分钟只允许 120 次）。 */
    if (saved && (saved.displayMode !== settings.displayMode || saved.modeTouched !== settings.modeTouched)) saveSync();
    try { boot(); } catch (e) { console.error('[currency-converter]', e); }
  });
})();

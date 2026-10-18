/* ISOLATED: establish the configuration port before page scripts run.
 * No configuration or seeds are stored in site storage or window properties.
 */
(() => {
  'use strict';
  const {normalizeHost,effectiveConfig} = GeoMaskConfig;
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
  let port = null;
  let latest = null;
  let revision = 0;
  let key = '';
  // Remove configuration caches written by versions before 1.5. Never touch
  // other site storage, and never write new configuration into it.
  function cleanupLegacyCache() {
    // Use the actual frame origin: an HTTPS sandbox URL can still have an
    // opaque origin, while about:blank can inherit accessible web storage.
    if (!/^https?:\/\//.test(window.origin)) return;
    const detail=error=>String(error?.name || 'Error')+': '+String(error?.message ?? error);
    let storage;
    try { storage=window.localStorage; }
    catch (error) {
      if (error?.name==='SecurityError') {
        console.info('[GeoMask] 跳过旧配置缓存清理：浏览器禁止访问站点存储；'+detail(error));
      } else {
        console.warn('[GeoMask] 旧配置缓存读取失败：'+detail(error),error);
      }
      return;
    }
    try {
      for (const name of Object.keys(storage)) {
        if (name.startsWith('__gm_cfg_v2__:')) storage.removeItem(name);
      }
    } catch (error) {console.warn('[GeoMask] 旧配置缓存清理失败：'+detail(error),error);}
  }
  cleanupLegacyCache();
  try {
    const href = location.hostname ? location.href : document.referrer;
    // Hostless frames may legitimately have no referrer. Keep their existing
    // global configuration without parsing an empty URL or inventing a host.
    if (href) {
      const url = new URL(href);
      if (url.protocol === 'http:' || url.protocol === 'https:') key = normalizeHost(url.hostname);
    }
  } catch (error) {
    console.warn('[GeoMask] 当前 frame 无法确定 hostname:',error);
  }

  function publishToken() {
    if (!port) document.dispatchEvent(new CustomEvent('gm:bridge-ready',{detail:token}));
  }
  function connect(event) {
    if (event.source !== window || event.data?.__gm !== 'connect' || event.data.token !== token || !event.ports[0] || port) return;
    // The transferred endpoint belongs only to the bridge, never the page.
    event.stopImmediatePropagation();
    port = event.ports[0];
    window.removeEventListener('message',connect,true);
    port.start();
    if (latest) port.postMessage(latest);
  }
  window.addEventListener('message',connect,true);
  document.addEventListener('gm:main-ready',publishToken,true);
  publishToken();

  async function pull() {
    const version = ++revision;
    try {
      const st = await chrome.storage.local.get(['profile','settings','hostProfiles']);
      if (version !== revision) return;
      latest = effectiveConfig(st.profile,st.settings,st.hostProfiles,key);
      port?.postMessage(latest);
    } catch (error) { console.error('[GeoMask] 配置读取失败:',error); }
  }
  pull();
  if (key) {
    chrome.runtime.sendMessage({type:'resolveHost',host:key}).then(res => {
      if (res?.ok === false) console.error('[GeoMask] 站点探测失败:',res.error);
    }).catch(error => console.error('[GeoMask] 站点探测失败:',error));
  }
  chrome.storage.onChanged.addListener((changes,area) => {
    if (area === 'local' && (changes.profile || changes.settings || changes.hostProfiles)) pull();
  });
})();

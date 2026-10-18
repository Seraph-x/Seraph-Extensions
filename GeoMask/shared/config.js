/* Shared configuration policy. Loaded only in extension/ISOLATED contexts. */
globalThis.GeoMaskConfig = (() => {
'use strict';
const ORIGINAL_UA=globalThis.navigator?.userAgent || '';
const ORIGINAL_UA_DATA=globalThis.navigator?.userAgentData;
const DEFAULT_SETTINGS = {
  enabled: true,
  startupMode: 'standard',
  spoofTimezone: true,
  spoofGeolocation: true,
  spoofLanguage: true,
  spoofIntlLocale: true,
  blockWebRTC: true,
  rewriteAcceptLanguage: true,
  jitter: true,
  accuracy: 1500,
  rtcFilter: false,
  workerAutoFallback: true,
  workerModeByDomain: {},
  refreshMinutes: 30,
  hostTtlMinutes: 30,
  probeTemplates: ['https://{host}/cdn-cgi/trace'],
  fp: {
    enabled: false,
    seed: 'gm-default',
    profile: 'win-chrome',
    uaCH: 'native',
    canvas: true,
    webgl: true,
    audio: true,
    fonts: true,
    navigator: true,
    screen: true,
    media: true
  },
  manual: null,
  manualPriority: 'fallback',
  manualByPriority: {},
  hostAliases: {},
  identities: {},
  identityByDomain: {},
  defaultIdentity: null
};
const PRESETS = {
    'win-chrome': {
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      appVersion: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      platform: 'Win32',
      vendor: 'Google Inc.',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelDepth: 24 },
      dpr: 1,
      webglVendor: 'Google Inc. (NVIDIA)',
      webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      uaData: {
        brands: [
          { brand: 'Google Chrome', version: '131' },
          { brand: 'Chromium', version: '131' },
          { brand: 'Not_A Brand', version: '24' }
        ],
        mobile: false, platform: 'Windows', platformVersion: '15.0.0',
        architecture: 'x86', bitness: '64', uaFullVersion: '131.0.6778.86'
      },
    },
    'mac-chrome': {
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      appVersion: '5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      platform: 'MacIntel',
      vendor: 'Google Inc.',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      screen: { width: 1512, height: 982, availWidth: 1512, availHeight: 944, colorDepth: 30, pixelDepth: 30 },
      dpr: 2,
      webglVendor: 'Google Inc. (Apple)',
      webglRenderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)',
      uaData: {
        brands: [
          { brand: 'Google Chrome', version: '131' },
          { brand: 'Chromium', version: '131' },
          { brand: 'Not_A Brand', version: '24' }
        ],
        mobile: false, platform: 'macOS', platformVersion: '14.5.0',
        architecture: 'arm', bitness: '64', uaFullVersion: '131.0.6778.86'
      },
    },
    'win-edge': {
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      appVersion: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      platform: 'Win32',
      vendor: 'Google Inc.',
      hardwareConcurrency: 12,
      deviceMemory: 16,
      maxTouchPoints: 0,
      screen: { width: 2560, height: 1440, availWidth: 2560, availHeight: 1400, colorDepth: 24, pixelDepth: 24 },
      dpr: 1,
      webglVendor: 'Google Inc. (AMD)',
      webglRenderer: 'ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)',
      uaData: {
        brands: [
          { brand: 'Microsoft Edge', version: '131' },
          { brand: 'Chromium', version: '131' },
          { brand: 'Not_A Brand', version: '24' }
        ],
        mobile: false, platform: 'Windows', platformVersion: '15.0.0',
        architecture: 'x86', bitness: '64', uaFullVersion: '131.0.2903.86'
      },
    }
  };
// Intel MacBook Air (2020): Core i5 with Intel Iris Plus; Apple M-series
// devices are kept separate so architecture cannot drift from the hardware.
PRESETS['mac-intel']={...PRESETS['mac-chrome'],hardwareConcurrency:8,
  screen:{width:1440,height:900,availWidth:1440,availHeight:875,colorDepth:24,pixelDepth:24},
  webglVendor:'Google Inc. (Intel)',
  webglRenderer:'ANGLE (Intel, ANGLE Metal Renderer: Intel(R) Iris(TM) Plus Graphics, Unspecified Version)',
  uaData:{...PRESETS['mac-chrome'].uaData,architecture:'x86'}};
PRESETS['mac-chrome'].minimumPlatformMajor=12;
// One real CPU configuration per chip; these are identifier bundles, not GPU
// emulation or a claim to cover every physical Mac configuration.
for(const [chip,cores,platformVersion] of [
  ['M1',8,'14.5.0'],['M1 Pro',10,'14.5.0'],['M1 Max',10,'14.5.0'],['M1 Ultra',20,'14.5.0'],
  ['M2 Pro',12,'14.5.0'],['M2 Max',12,'14.5.0'],['M2 Ultra',24,'14.5.0'],
  ['M3',8,'14.5.0'],['M3 Pro',12,'14.5.0'],['M3 Max',16,'14.5.0'],['M3 Ultra',32,'15.4.0'],
  ['M4',10,'15.1.0'],['M4 Pro',14,'15.1.0'],['M4 Max',16,'15.1.0'],
  ['M5',10,'26.4.0'],['M5 Pro',18,'26.4.0'],['M5 Max',18,'26.4.0']]) {
  const base=PRESETS['mac-chrome'];
  PRESETS['mac-'+chip.toLowerCase().replaceAll(' ','-')]={...base,hardwareConcurrency:cores,
    deviceLabel:'Apple '+chip+' · '+cores+' 核 CPU / Apple GPU',
    minimumPlatformMajor:chip.startsWith('M1') ? 11 : chip.startsWith('M2') ? 12 : chip==='M3 Ultra' ? 15 : chip.startsWith('M3') ? 14 : chip.startsWith('M4') ? 15 : 26,
    webglRenderer:base.webglRenderer.replaceAll('Apple M2','Apple '+chip),uaData:{...base.uaData,platformVersion}};
}
function profileOptions(platform) {
  const labels={'win-chrome':'Intel x86-64 · NVIDIA RTX 3060','win-edge':'AMD x86-64 · Radeon RX 6700 XT',
    'mac-chrome':'Apple M2 · Apple GPU','mac-intel':'Intel Core i5（2020 Mac）· Iris Plus'};
  return Object.entries(PRESETS).filter(([,preset])=>!platform || preset.uaData.platform===platform)
    .map(([id,preset])=>({id,label:labels[id] || preset.deviceLabel,platform:preset.uaData.platform,architecture:preset.uaData.architecture,bitness:preset.uaData.bitness}));
}
function normalizeHost(value) {
  const host = String(value || '').trim().toLowerCase().replace(/\.$/, '');
  if (!host || /[\s/@?#]/.test(host)) throw new TypeError('无效 hostname: ' + host);
  const url = new URL('https://' + host);
  if (url.port || url.pathname !== '/') throw new TypeError('hostname 不能包含端口或路径');
  return url.hostname;
}
function domainValue(map, host) {
  // Bindings apply to subdomains; probe caches deliberately do not.
  const key = Object.keys(map || {}).filter(k => host === k || host.endsWith('.' + k))
    .sort((a,b) => b.length - a.length)[0];
  return key ? map[key] : undefined;
}
function aliasHost(host, settings) {
  return settings.hostAliases?.[host] || host;
}
function settingsWithDefaults(value = {}) {
  return {...DEFAULT_SETTINGS, ...value, fp:{...DEFAULT_SETTINGS.fp, ...value.fp}};
}
function manualLocationFor(settings,priority) {
  const s=settingsWithDefaults(settings);
  // Keep `manual` authoritative for the active priority, including legacy settings.
  return priority===s.manualPriority ? s.manual : s.manualByPriority[priority] ?? null;
}
function withManualLocation(settings,{priority,manual,activate=true}) {
  const s=settingsWithDefaults(settings);
  if(!activate) return priority===s.manualPriority ? {...s,manual}
    : {...s,manualByPriority:{...s.manualByPriority,[priority]:manual}};
  const manualByPriority={...s.manualByPriority,[s.manualPriority]:s.manual};
  delete manualByPriority[priority];
  return {...s,manualPriority:priority,manual,manualByPriority};
}
function languagesFor(locale) {
  return locale ? [...new Set([locale, locale.split('-')[0]])] : null;
}
function languageHeader(languages) {
  return languages.map((language,index)=>index ? language+';q='+(1-index*0.1).toFixed(1) : language).join(', ');
}
function resolveLocation({globalProfile,hostProfile,manual,priority,fixed}) {
  const historical=hostProfile?.probe?.stale;
  const site=hostProfile && hostProfile.source!=='global' && !historical;
  const layers=[[globalProfile,'global']];
  if(hostProfile && !site) layers.push([hostProfile,historical ? 'historical' : 'global']);
  if(priority==='fallback') layers.push([manual,'manual-default']);
  if(site) layers.push([hostProfile,'site']);
  layers.push([fixed,'identity']);
  if(priority==='override') layers.push([manual,'manual-override']);
  const geo={},sources={};
  for(const [values,source] of layers) {
    for(const key of ['timezone','locale','lat','lon']) {
      if(values?.[key]==null || values[key]==='') continue;
      geo[key]=values[key];sources[key]=source;
    }
  }
  return {geo,sources};
}
function effectiveConfig(globalProfile, settings, hostProfiles, host) {
  const s = settingsWithDefaults(settings);
  const key = aliasHost(host, s);
  const id = domainValue(s.identityByDomain, host) || s.defaultIdentity;
  const identity = s.identities[id];
  const fp = {...s.fp, ...identity?.fp};
  fp.enabled = s.enabled && s.fp.enabled && fp.enabled;
  fp.browserVersion=browserVersion();
  const base = hostProfiles?.[key] || globalProfile || {};
  const fixed = identity?.geo?.mode === 'fixed' ? identity.geo : {};
  const {geo}=resolveLocation({globalProfile,hostProfile:hostProfiles?.[key],manual:s.manual,priority:s.manualPriority,fixed});
  return {
    enabled:s.enabled, spoofTimezone:s.spoofTimezone, spoofGeolocation:s.spoofGeolocation,
    spoofLanguage:s.spoofLanguage, spoofIntlLocale:s.spoofIntlLocale,
    blockWebRTC:s.blockWebRTC, rtcFilter:s.rtcFilter, workerAutoFallback:s.workerAutoFallback,
    workerMode:s.workerModeByDomain[host] || 'auto', jitter:s.jitter, accuracy:s.accuracy,
    timezone:geo.timezone || null, locale:geo.locale || null,
    languages:languagesFor(geo.locale), lat:geo.lat ?? null, lon:geo.lon ?? null,
    country:base.country || null, city:base.city || null, ip:base.ip || null,
    host:key, source:base.source || null, fp, identity:identity ? id : null
  };
}
function validateGeo(geo) {
  if (!geo) return;
  if (typeof geo !== 'object' || Array.isArray(geo)) throw new TypeError('地理配置必须是对象');
  if (geo.timezone != null) new Intl.DateTimeFormat('en', {timeZone:geo.timezone});
  if (geo.locale != null && (typeof geo.locale !== 'string' || !Intl.getCanonicalLocales(geo.locale).length)) throw new TypeError('无效语言');
  for (const [key, limit] of [['lat',90],['lon',180]]) {
    if (geo[key] != null && (!Number.isFinite(geo[key]) || Math.abs(geo[key]) > limit)) throw new RangeError('无效坐标: ' + key);
  }
}
function validateSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('设置必须是对象');
  const s = settingsWithDefaults(input);
  if (!['standard','enhanced'].includes(s.startupMode)) throw new TypeError('无效启动模式');
  if (!['fallback','override'].includes(s.manualPriority)) throw new TypeError('无效全局位置优先级');
  for (const key of ['enabled','spoofTimezone','spoofGeolocation','spoofLanguage','spoofIntlLocale','blockWebRTC','rewriteAcceptLanguage','jitter','rtcFilter','workerAutoFallback']) {
    if (typeof s[key] !== 'boolean') throw new TypeError(key + ' 必须是布尔值');
  }
  for (const key of ['refreshMinutes','hostTtlMinutes','accuracy']) {
    if (!Number.isFinite(s[key]) || s[key] <= 0) throw new RangeError('无效数值: ' + key);
  }
  const validateFp = fp => {
    if (!fp || typeof fp !== 'object' || Array.isArray(fp)) throw new TypeError('无效指纹配置');
    if (fp.profile != null && !PRESETS[fp.profile]) throw new TypeError('未知设备档案');
    if (fp.uaCH != null && !['native','profile','custom'].includes(fp.uaCH)) throw new TypeError('无效 UA-CH 模式');
    if (fp.uaCHFields != null && (typeof fp.uaCHFields!=='object' || Array.isArray(fp.uaCHFields))) throw new TypeError('UA-CH 字段必须是对象');
    if (fp.seed != null && (typeof fp.seed !== 'string' || !fp.seed.trim())) throw new TypeError('种子不能为空');
    for (const key of Object.keys(DEFAULT_SETTINGS.fp).filter(k => typeof DEFAULT_SETTINGS.fp[k] === 'boolean')) {
      if (fp[key] != null && typeof fp[key] !== 'boolean') throw new TypeError('无效指纹开关: ' + key);
    }
  };
  const record = (value, name) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(name + ' 必须是对象');
  };
  record(s.workerModeByDomain,'Worker 站点模式');
  for(const [host,mode] of Object.entries(s.workerModeByDomain)) {
    if(normalizeHost(host)!==host || !['auto','native'].includes(mode)) throw new TypeError('无效 Worker 站点模式：'+host);
  }
  validateGeo(s.manual); validateFp(s.fp);
  record(s.manualByPriority,'独立位置配置');
  for(const [priority,manual] of Object.entries(s.manualByPriority)) {
    if(!['fallback','override'].includes(priority)) throw new TypeError('无效独立位置优先级');
    validateGeo(manual);
  }
  for (const key of ['identities','identityByDomain','hostAliases']) record(s[key],key);
  for (const identity of Object.values(s.identities)) {
    record(identity,'身份');
    if (identity.fp) validateFp(identity.fp);
    validateGeo(identity.geo);
    if (identity.geo?.mode && !['auto','fixed'].includes(identity.geo.mode)) throw new TypeError('无效地理模式');
  }
  for(const [label,fp] of configuredFingerprints(s)) {
    if(fp.uaCH==='custom') {
      try {validateUAFields(fp.uaCHFields || {},PRESETS[fp.profile]);}
      catch(error) {throw new TypeError(label+'：'+error.message);}
    }
  }
  for (const [host,id] of Object.entries(s.identityByDomain)) {
    if (normalizeHost(host) !== host || !s.identities[id]) throw new TypeError('无效身份绑定: ' + host);
  }
  if (s.defaultIdentity && !s.identities[s.defaultIdentity]) throw new TypeError('默认身份不存在');
  for (const [host,target] of Object.entries(s.hostAliases)) {
    if (normalizeHost(host) !== host || normalizeHost(target) !== target) throw new TypeError('无效域名别名');
  }
  if (!Array.isArray(s.probeTemplates) || !s.probeTemplates.length) throw new TypeError('探测模板不能为空');
  for (const template of s.probeTemplates) {
    if (typeof template !== 'string' || !template.includes('{host}')) throw new TypeError('探测模板必须包含 {host}');
    const u = new URL(template.replaceAll('{host}','probe.invalid'));
    if (u.protocol !== 'https:' || u.hostname !== 'probe.invalid' || u.username || u.password || u.port) throw new TypeError('探测模板必须是目标站的 HTTPS 地址');
  }
  return s;
}
function browserVersion(userAgent=ORIGINAL_UA) {
  const chromium=/(?:HeadlessChrome|Chrome|Chromium)\/(\d+\.\d+\.\d+\.\d+)/.exec(userAgent)?.[1];
  return chromium ? {chromium,edge:/Edg\/(\d+\.\d+\.\d+\.\d+)/.exec(userAgent)?.[1] || null} : null;
}
function validateUAFields(fields,preset) {
  if(!fields || typeof fields!=='object' || Array.isArray(fields)) throw new TypeError('UA-CH 字段必须是对象');
  const allowed=['browser','platform','platformVersion','architecture','bitness','mobile','model','wow64'];
  for(const key of Object.keys(fields)) if(!allowed.includes(key)) throw new TypeError('UA-CH 字段由关联配置生成，不能单独覆盖：'+key);
  if(fields.browser!=null && !['chrome','edge'].includes(fields.browser)) throw new TypeError('未知浏览器品牌');
  for(const key of ['platform','architecture','bitness']) {
    if(fields[key]!=null && fields[key]!==preset.uaData[key]) throw new TypeError('UA-CH '+key+' 与设备档案的系统或架构不一致');
  }
  if(fields.platformVersion!=null && (typeof fields.platformVersion!=='string' || !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(fields.platformVersion))) throw new TypeError('系统版本须为三个数字段，例如 14.5.0；Windows 使用 UA-CH 平台版本编号');
  if(fields.platformVersion!=null && preset.minimumPlatformMajor && Number(fields.platformVersion.split('.')[0])<preset.minimumPlatformMajor) throw new TypeError('该芯片的 macOS 主版本至少为 '+preset.minimumPlatformMajor+'；具体小版本支持仍需按机型核对');
  if(fields.mobile!=null && fields.mobile!==false) throw new TypeError('当前设备档案为桌面设备，mobile 必须为 false');
  if(fields.model!=null && fields.model!=='') throw new TypeError('桌面 UA-CH model 应为空，不是 CPU 型号');
  if(fields.wow64!=null && (typeof fields.wow64!=='boolean' || (fields.wow64 && (preset.uaData.platform!=='Windows' || preset.uaData.architecture!=='x86' || preset.uaData.bitness!=='64')))) throw new TypeError('WoW64 只适用于 Windows x86-64 档案');
}
function resolvePreset(id,version,presets=PRESETS,fields={}) {
  const original=presets[id];
  if(!original) throw new TypeError('未知设备档案：'+id);
  validateUAFields(fields,original);
  if(!version || !/^\d+\.\d+\.\d+\.\d+$/.test(version.chromium)) throw new Error('无法识别真实 Chromium 版本，不能生成合成 UA');
  const major=version.chromium.split('.')[0];
  const browser=fields.browser || (id==='win-edge' ? 'edge' : 'chrome');
  const product=browser==='edge' ? version.edge || version.chromium : version.chromium;
  const replace=value=>{
    let ua=value.replace(/Chrome\/[\d.]+/g,'Chrome/'+version.chromium).replace(/ Edg\/[\d.]+/g,'');
    if(fields.wow64) ua=ua.replace('Win64; x64','WOW64');
    return ua+(browser==='edge' ? ' Edg/'+product : '');
  };
  return {...original,ua:replace(original.ua),appVersion:replace(original.appVersion),
    uaData:{...original.uaData,platformVersion:fields.platformVersion ?? original.uaData.platformVersion,
      mobile:false,model:'',wow64:fields.wow64 ?? false,formFactors:['Desktop'],uaFullVersion:product,
      brands:[{brand:browser==='edge' ? 'Microsoft Edge' : 'Google Chrome',version:product.split('.')[0]},
        {brand:'Chromium',version:major},{brand:'Not_A Brand',version:'24'}],
      chromiumVersion:version.chromium}};
}
async function nativeBrowserInfo() {
  if(!ORIGINAL_UA_DATA) return {available:false,ua:ORIGINAL_UA,error:'浏览器未提供原生 UA-CH，无法核对设备档案'};
  try {
    const hints=await ORIGINAL_UA_DATA.getHighEntropyValues(['architecture','bitness','platformVersion']);
    const available=!!(hints.architecture && hints.bitness && ORIGINAL_UA_DATA.platform);
    return {available,ua:ORIGINAL_UA,...hints,brands:ORIGINAL_UA_DATA.brands,platform:ORIGINAL_UA_DATA.platform,
      ...(!available ? {error:'原生 UA-CH 未提供系统、架构或位数，无法核对档案'} : {})};
  } catch(error) {return {available:false,ua:ORIGINAL_UA,error:'原生 UA-CH 读取失败：'+error.message};}
}
function configurationIssues(settings,native) {
  const s=settingsWithDefaults(settings);if(!s.enabled || !s.fp.enabled) return [];
  return configuredFingerprints(s).flatMap(([label,fp])=>{
    if(!fp.enabled || fp.uaCH!=='native' || (!fp.navigator && !fp.webgl)) return [];
    if(!native?.available) return [label+'：'+(native?.error || '无法获取原生 UA-CH 以校验搭配')];
    const data=PRESETS[fp.profile]?.uaData;
    if(!data) return [label+'：未知设备档案'];
    const differences=['platform','architecture','bitness'].filter(key=>native[key] && native[key]!==data[key]);
    return differences.length ? [label+'与原生 UA-CH 的系统或架构不一致（'+differences.join('、')+'）；请选择匹配档案，或改为自定义 UA / UA-CH'] : [];
  });
}
function configuredFingerprints(s) {
  return [['全局设备档案',s.fp],...Object.entries(s.identities).map(([id,identity])=>['身份 '+(identity.label || id),{...s.fp,...identity.fp}])];
}
function validateBrowserProfiles(settings) {
  const s=settingsWithDefaults(settings);if(!s.enabled || !s.fp.enabled) return;
  for(const [label,fp] of configuredFingerprints(s)) {
    if(!fp.enabled || fp.uaCH==='native') continue;
    try {resolvePreset(fp.profile,browserVersion(),PRESETS,fp.uaCH==='custom' ? fp.uaCHFields : {});}
    catch(error) {throw new TypeError(label+'：'+error.message);}
  }
}
return Object.freeze({DEFAULT_SETTINGS, PRESETS, profileOptions, validateUAFields, nativeBrowserInfo, configurationIssues, validateBrowserProfiles, normalizeHost, aliasHost, domainValue, settingsWithDefaults, manualLocationFor, withManualLocation, languagesFor, languageHeader, browserVersion, resolvePreset, resolveLocation, effectiveConfig, validateSettings});
})();

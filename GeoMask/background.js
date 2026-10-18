/* GeoMask MV3: exact-host probe cache and shared configuration policy.
 * A same-host probe observes that probe request's egress; PAC paths,
 * protocols and redirects can still differ from the page request.
 */

const RULE_ID_GLOBAL = 1001;
const ALARM = 'gm-refresh';
const HOST_KEY = 'hostProfiles';

importScripts('shared/config.js','shared/ip-types.js','background/startup.js','background/probe.js');
const { DEFAULT_SETTINGS, PRESETS, normalizeHost, aliasHost, settingsWithDefaults, effectiveConfig, validateSettings } = GeoMaskConfig;
/* 国家 -> 默认语言 */
const COUNTRY_LOCALE = {
  CN:'zh-CN', HK:'zh-HK', MO:'zh-MO', TW:'zh-TW', SG:'en-SG', MY:'ms-MY',
  JP:'ja-JP', KR:'ko-KR', MN:'mn-MN',
  US:'en-US', GB:'en-GB', CA:'en-CA', AU:'en-AU', NZ:'en-NZ', IE:'en-IE', ZA:'en-ZA',
  DE:'de-DE', AT:'de-AT', CH:'de-CH', FR:'fr-FR', BE:'nl-BE', LU:'fr-LU',
  ES:'es-ES', PT:'pt-PT', IT:'it-IT', MT:'mt-MT',
  NL:'nl-NL', DK:'da-DK', SE:'sv-SE', NO:'nb-NO', FI:'fi-FI', IS:'is-IS',
  EE:'et-EE', LV:'lv-LV', LT:'lt-LT', PL:'pl-PL', CZ:'cs-CZ', SK:'sk-SK',
  HU:'hu-HU', RO:'ro-RO', BG:'bg-BG', GR:'el-GR', HR:'hr-HR', SI:'sl-SI',
  RS:'sr-RS', BA:'bs-BA', MK:'mk-MK', AL:'sq-AL', RU:'ru-RU', BY:'be-BY',
  UA:'uk-UA', MD:'ro-MD', GE:'ka-GE', AM:'hy-AM', AZ:'az-AZ', KZ:'kk-KZ',
  UZ:'uz-UZ', KG:'ky-KG', TJ:'tg-TJ', TM:'tk-TM',
  TR:'tr-TR', IL:'he-IL', SA:'ar-SA', AE:'ar-AE', QA:'ar-QA', KW:'ar-KW',
  BH:'ar-BH', OM:'ar-OM', JO:'ar-JO', LB:'ar-LB', IQ:'ar-IQ', IR:'fa-IR',
  PK:'en-PK', IN:'en-IN', BD:'bn-BD', LK:'si-LK', NP:'ne-NP',
  TH:'th-TH', VN:'vi-VN', KH:'km-KH', LA:'lo-LA', MM:'my-MM', ID:'id-ID',
  PH:'en-PH', BN:'ms-BN',
  BR:'pt-BR', AR:'es-AR', CL:'es-CL', CO:'es-CO', PE:'es-PE', VE:'es-VE',
  EC:'es-EC', BO:'es-BO', PY:'es-PY', UY:'es-UY', CR:'es-CR', PA:'es-PA',
  GT:'es-GT', HN:'es-HN', SV:'es-SV', NI:'es-NI', DO:'es-DO', CU:'es-CU',
  MX:'es-MX',
  EG:'ar-EG', MA:'ar-MA', DZ:'ar-DZ', TN:'ar-TN', LY:'ar-LY', SD:'ar-SD',
  ET:'am-ET', KE:'en-KE', NG:'en-NG', GH:'en-GH', TZ:'sw-TZ', UG:'en-UG',
  ZW:'en-ZW', ZM:'en-ZM', MZ:'pt-MZ', AO:'pt-AO', CM:'fr-CM', CI:'fr-CI',
  SN:'fr-SN', ML:'fr-ML', MG:'mg-MG', MU:'en-MU'
};

/* 国家 -> [代表时区, 纬度, 经度]，仅用于「知道国家但查不到城市」时的兜底 */
const COUNTRY_TZ = {
  CN: ['Asia/Shanghai', 31.2304, 121.4737], HK: ['Asia/Hong_Kong', 22.3193, 114.1694],
  TW: ['Asia/Taipei', 25.0330, 121.5654], MO: ['Asia/Macau', 22.1987, 113.5439],
  JP: ['Asia/Tokyo', 35.6762, 139.6503], KR: ['Asia/Seoul', 37.5665, 126.9780],
  SG: ['Asia/Singapore', 1.3521, 103.8198], MY: ['Asia/Kuala_Lumpur', 3.1390, 101.6869],
  TH: ['Asia/Bangkok', 13.7563, 100.5018], VN: ['Asia/Ho_Chi_Minh', 10.8231, 106.6297],
  ID: ['Asia/Jakarta', -6.2088, 106.8456], PH: ['Asia/Manila', 14.5995, 120.9842],
  IN: ['Asia/Kolkata', 19.0760, 72.8777], PK: ['Asia/Karachi', 24.8607, 67.0011],
  BD: ['Asia/Dhaka', 23.8103, 90.4125], LK: ['Asia/Colombo', 6.9271, 79.8612],
  AE: ['Asia/Dubai', 25.2048, 55.2708], SA: ['Asia/Riyadh', 24.7136, 46.6753],
  IL: ['Asia/Jerusalem', 31.7683, 35.2137], TR: ['Europe/Istanbul', 41.0082, 28.9784],
  RU: ['Europe/Moscow', 55.7558, 37.6173], UA: ['Europe/Kyiv', 50.4501, 30.5234],
  KZ: ['Asia/Almaty', 43.2220, 76.8512],
  US: ['America/New_York', 40.7128, -74.0060], CA: ['America/Toronto', 43.6532, -79.3832],
  MX: ['America/Mexico_City', 19.4326, -99.1332], BR: ['America/Sao_Paulo', -23.5505, -46.6333],
  AR: ['America/Argentina/Buenos_Aires', -34.6037, -58.3816], CL: ['America/Santiago', -33.4489, -70.6693],
  CO: ['America/Bogota', 4.7110, -74.0721], PE: ['America/Lima', -12.0464, -77.0428],
  GB: ['Europe/London', 51.5074, -0.1278], IE: ['Europe/Dublin', 53.3498, -6.2603],
  FR: ['Europe/Paris', 48.8566, 2.3522], DE: ['Europe/Berlin', 52.5200, 13.4050],
  NL: ['Europe/Amsterdam', 52.3676, 4.9041], BE: ['Europe/Brussels', 50.8503, 4.3517],
  CH: ['Europe/Zurich', 47.3769, 8.5417], AT: ['Europe/Vienna', 48.2082, 16.3738],
  ES: ['Europe/Madrid', 40.4168, -3.7038], PT: ['Europe/Lisbon', 38.7223, -9.1393],
  IT: ['Europe/Rome', 41.9028, 12.4964], PL: ['Europe/Warsaw', 52.2297, 21.0122],
  CZ: ['Europe/Prague', 50.0755, 14.4378], SE: ['Europe/Stockholm', 59.3293, 18.0686],
  NO: ['Europe/Oslo', 59.9139, 10.7522], DK: ['Europe/Copenhagen', 55.6761, 12.5683],
  FI: ['Europe/Helsinki', 60.1699, 24.9384], GR: ['Europe/Athens', 37.9838, 23.7275],
  RO: ['Europe/Bucharest', 44.4268, 26.1025], HU: ['Europe/Budapest', 47.4979, 19.0402],
  AU: ['Australia/Sydney', -33.8688, 151.2093], NZ: ['Pacific/Auckland', -36.8485, 174.7633],
  ZA: ['Africa/Johannesburg', -26.2041, 28.0473], EG: ['Africa/Cairo', 30.0444, 31.2357],
  NG: ['Africa/Lagos', 6.5244, 3.3792], KE: ['Africa/Nairobi', -1.2921, 36.8219]
};

function isIp(host) {
  return /^[0-9.]+$/.test(host) || host.indexOf(':') !== -1;
}

function buildLanguages(locale) {
  if (!locale) return null;
  const out = [locale];
  const base = String(locale).split('-')[0];
  if (base && base !== locale) out.push(base);
  return out;
}

function guessLocale(country) {
  if (!country) return 'en-US';
  return COUNTRY_LOCALE[String(country).toUpperCase()] || 'en-US';
}

async function fetchText(url, timeout = 5000, redirect = 'follow') {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal, cache: 'no-store', credentials: 'omit', redirect
    });
    if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status),{status:res.status});
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJSON(url, timeout = 7000) {
  const text = await fetchText(url, timeout);
  return JSON.parse(text);
}

async function getSettings() {
  const st = await chrome.storage.local.get('settings');
  return settingsWithDefaults(st.settings);
}

/* ============ 探测：目标站自己的 IP 回显 ============ */
async function probeHostTrace(host) {
  const s=await getSettings();
  const errors=[];
  for(const template of s.probeTemplates) {
    const endpoint=String(template).replaceAll('{host}',host);
    let received=false;
    try {
      const text=await fetchText(endpoint,5000,'error');
      received=true;
      const echo=GeoMaskProbe.parseEcho(text);
      return {...echo,endpoint,source:echo.format==='trace' ? 'host-trace' : 'host-echo',errors,observedAt:Date.now()};
    } catch(error) {
      const kind=received ? 'invalid-response' : error.status ? 'http' : error.name==='AbortError' ? 'timeout' : 'network';
      errors.push({endpoint,kind,...(error.status ? {status:error.status} : {}),message:String(error.message || error)});
    }
  }
  const error=new Error('本站回显不可用');
  error.diagnostics=errors;
  throw error;
}

/* ============ 按 IP 反查归属地（查库，与出口路由无关） ============ */
async function lookupGeoIP(ip) {
  const enc = encodeURIComponent(GeoMaskProbe.normalizeIP(ip));
  const attempts = [
    {
      url: 'https://ipwho.is/' + enc,
      parse: (j) => (j && j.success !== false && typeof j.latitude === 'number' ? {
        ip: j.ip, country: j.country_code, countryName: j.country, region: j.region,
        city: j.city, lat: j.latitude, lon: j.longitude,
        timezone: j.timezone && j.timezone.id, isp: j.connection && j.connection.isp
      } : null)
    },
    {
      url: 'https://ipapi.co/' + enc + '/json/',
      parse: (j) => (j && typeof j.latitude === 'number' ? {
        ip: j.ip, country: j.country_code, countryName: j.country_name, region: j.region,
        city: j.city, lat: j.latitude, lon: j.longitude, timezone: j.timezone, isp: j.org
      } : null)
    },
    {
      url: 'https://freeipapi.com/api/json/' + enc,
      parse: (j) => (j && typeof j.latitude === 'number' ? {
        ip: j.ipAddress, country: j.countryCode, countryName: j.countryName, region: j.regionName,
        city: j.cityName, lat: j.latitude, lon: j.longitude, timezone: j.timeZone, isp: null
      } : null)
    }
  ];
  const errors=[];
  for(const attempt of attempts) {
    try {
      const data=await fetchJSON(attempt.url,6000);
      const geo=GeoMaskProbe.validateGeo(attempt.parse(data));
      if(GeoMaskProbe.normalizeIP(geo.ip)!==GeoMaskProbe.normalizeIP(ip)) throw new TypeError('GeoIP 返回 IP 与查询 IP 不一致');
      const source=new URL(attempt.url).hostname;
      return {...geo,ipData:GeoMaskIP.fromResponse(source,data),geoSource:source,updatedAt:Date.now()};
    }
    catch(error) {errors.push(attempt.url+': '+error.message);}
  }
  console.warn('[GeoMask] IP 归属地查询失败:',errors.join(' | '));
  return null;
}
const geoIPCache=new Map();
const geoIPInflight=new Map();
const GEOIP_TTL_MS=24*60*60*1000;
async function geolocateIP(value) {
  const ip=GeoMaskProbe.normalizeIP(value);
  const cached=geoIPCache.get(ip);
  if(cached && Date.now()-cached.updatedAt<GEOIP_TTL_MS) return {...cached};
  if(geoIPInflight.has(ip)) return geoIPInflight.get(ip);
  const job=lookupGeoIP(ip).then(geo=>{
    const now=Date.now();
    for(const [key,entry] of geoIPCache) if(now-entry.updatedAt>=GEOIP_TTL_MS) geoIPCache.delete(key);
    if(geo) geoIPCache.set(ip,geo);
    return geo;
  }).finally(()=>geoIPInflight.delete(ip));
  geoIPInflight.set(ip,job);
  return job;
}

/* ============ 全局探测（兜底） ============ */
const GLOBAL_SOURCES = [
  {
    name: 'ipwho.is', url: 'https://ipwho.is/',
    parse: (j) => (j && j.success !== false && typeof j.latitude === 'number' ? {
      ip: j.ip, country: j.country_code, countryName: j.country, region: j.region,
      city: j.city, lat: j.latitude, lon: j.longitude,
      timezone: j.timezone && j.timezone.id, isp: j.connection && j.connection.isp
    } : null)
  },
  {
    name: 'ipapi.co', url: 'https://ipapi.co/json/',
    parse: (j) => (j && typeof j.latitude === 'number' ? {
      ip: j.ip, country: j.country_code, countryName: j.country_name, region: j.region,
      city: j.city, lat: j.latitude, lon: j.longitude, timezone: j.timezone, isp: j.org
    } : null)
  },
  {
    name: 'ifconfig.co', url: 'https://ifconfig.co/json',
    parse: (j) => (j && typeof j.latitude === 'number' ? {
      ip: j.ip, country: j.country_iso, countryName: j.country, region: j.region_name,
      city: j.city, lat: j.latitude, lon: j.longitude, timezone: j.time_zone, isp: j.asn_org
    } : null)
  },
  {
    name: 'ip.sb', url: 'https://api.ip.sb/geoip',
    parse: (j) => (j && typeof j.latitude === 'number' ? {
      ip: j.ip, country: j.country_code, countryName: j.country, region: j.region,
      city: j.city, lat: j.latitude, lon: j.longitude, timezone: j.timezone, isp: j.isp
    } : null)
  },
  {
    name: 'freeipapi', url: 'https://freeipapi.com/api/json',
    parse: (j) => (j && typeof j.latitude === 'number' ? {
      ip: j.ipAddress, country: j.countryCode, countryName: j.countryName, region: j.regionName,
      city: j.cityName, lat: j.latitude, lon: j.longitude, timezone: j.timeZone, isp: null
    } : null)
  }
];

let globalInflight = null;

async function probeGlobal() {
  const errors = [];
  for (const src of GLOBAL_SOURCES) {
    try {
      const data=await fetchJSON(src.url,7000);
      const geo = src.parse(data);
      if (geo) {
        GeoMaskProbe.validateGeo(geo);
        geo.geoSource=new URL(src.url).hostname;
        geo.ipData=GeoMaskIP.fromResponse(geo.geoSource,data);
        geo.source = src.name;
        geo.updatedAt = Date.now();
        return geo;
      }
      errors.push(src.name + ': empty');
    } catch (err) {
      errors.push(src.name + ': ' + (err && err.message ? err.message : String(err)));
    }
  }
  throw new Error('global probe failed -> ' + errors.join(' | '));
}

function buildProfile(geo) {
  const locale = guessLocale(geo.country);
  return {
    ip: geo.ip || null,
    country: geo.country || null,
    countryName: geo.countryName || null,
    region: geo.region || null,
    city: geo.city || null,
    lat: geo.lat,
    lon: geo.lon,
    timezone: geo.timezone,
    locale: locale,
    languages: buildLanguages(locale),
    isp: geo.isp || null,
    ipData: geo.ipData || null,
    geoSource: geo.geoSource || geo.source || null,
    source: geo.source || null,
    updatedAt: geo.updatedAt || Date.now()
  };
}

function profileFromCountry(country, ip) {
  const row = COUNTRY_TZ[String(country || '').toUpperCase()];
  if (!row) return null;
  return buildProfile({
    ip: ip, country: country, countryName: country,
    lat: row[1], lon: row[2], timezone: row[0],
    source: 'country-fallback'
  });
}

async function refreshGlobal(force) {
  if (globalInflight) return globalInflight;
  globalInflight = (async () => {
    try {
      const geo = await probeGlobal();
      const profile = buildProfile(geo);
      await chrome.storage.local.set({ profile });
      return profile;
    } catch (err) {
      await reportError('全局出口探测',err);
      throw err;
    } finally {
      globalInflight = null;
    }
  })();
  return globalInflight;
}

/* ============ 真实性诊断 ============ */
function localHourIn(tz) {
  if (!tz) return null;
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    const parts = fmt.formatToParts(new Date());
    let h = 0, m = 0;
    for (const p of parts) {
      if (p.type === 'hour') h = parseInt(p.value, 10) % 24;
      if (p.type === 'minute') m = parseInt(p.value, 10);
    }
    return { hour: h, minute: m, hhmm: String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') };
  } catch (e) {
    return null;
  }
}

/* ============ 按站点解析 ============ */
const hostInflight = new Map();

async function resolveHostProfile(host, force) {
  if (!host) return null;
  const s = await getSettings();
  host = normalizeHost(host);
  const key = aliasHost(host, s);

  if (hostInflight.has(key)) return hostInflight.get(key);

  const job = (async () => {
    const store = await chrome.storage.local.get(HOST_KEY);
    const map = store[HOST_KEY] || {};
    const cached = map[key];
    if (!s.enabled && !force) return cached || null;
    const ttl = Math.max(1, Number(s.hostTtlMinutes) || 30) * 60000;
    if (!force && cached && Date.now() - (cached.updatedAt || 0) < ttl) return cached;

    let profile = null;
    const probe={attemptedAt:Date.now(),observedAt:null,observedIp:null,endpoint:null,format:null,errors:[],fallbackReason:null};

    /* 1) 目标 host 回显，仅证明探测请求的出口 */
    if (!isIp(host)) {
      try {
        const trace = await probeHostTrace(key);
        Object.assign(probe,{observedAt:trace.observedAt,observedIp:trace.ip,endpoint:trace.endpoint,format:trace.format,errors:trace.errors});
        if (trace && trace.ip) {
          const info = await geolocateIP(trace.ip);
          if (info) {
            profile = buildProfile(Object.assign({}, info, {
              ip: trace.ip,
              country: trace.country || info.country,
              source: trace.source
            }));
          } else if (trace.country) {
            profile = profileFromCountry(trace.country, trace.ip);
            if (profile) profile.source = 'host-trace+country';
            probe.fallbackReason='IP 归属地查询失败，仅采用国家代表时区和坐标';
          }
          if (profile) {
            profile.ip = trace.ip;
            profile.endpoint = trace.endpoint || null;
            profile.colo = trace.colo || null;
          }
        }
      } catch (error) {probe.errors=error.diagnostics || [{endpoint:probe.endpoint,message:error.message}];}
    }

    /* 2) 全局兜底 */
    if (!profile) {
      const st = await chrome.storage.local.get('profile');
      if (st.profile) {
        profile = Object.assign({}, st.profile, {source:'global',geoUpdatedAt:st.profile.updatedAt});
        probe.fallbackReason=probe.observedIp ? '本站 IP 已回显，但归属地查询失败，采用全局结果' : '本站回显失败，采用全局结果';
      }
    }

    if (!profile) {
      if (!cached) {
        const details=probe.errors.map(error=>error.endpoint+'：'+error.message).join('；');
        throw new Error((probe.observedIp ? '本站 IP 已回显（'+probe.observedIp+'），但归属地查询失败' : '本站回显失败')+'，且没有可用的地理配置。'+details);
      }
      const stale={...cached,probe:{...probe,stale:true,fallbackReason:'本次未取得地理结果，保留旧配置；旧 IP 不代表本次出口'}};
      await updateHostProfiles(latest=>({...latest,[key]:stale}));
      return stale;
    }

    profile.probe=probe;
    profile.host = key;
    profile.updatedAt = Date.now();

    await updateHostProfiles(latest => {
      latest[key] = profile;
      const now = Date.now();
      for (const k of Object.keys(latest)) {
        if (now - (latest[k].updatedAt || 0) > 24 * 3600 * 1000) delete latest[k];
      }
      return latest;
    });
    return profile;
  })().finally(() => hostInflight.delete(key));

  hostInflight.set(key, job);
  return job;
}

/* ============ 请求头 / WebRTC ============ */
let hostWriteQueue = Promise.resolve();
function updateHostProfiles(update) {
  const job = hostWriteQueue.then(async () => {
    const st = await chrome.storage.local.get(HOST_KEY);
    await chrome.storage.local.set({[HOST_KEY]:update({...st[HOST_KEY]})});
  });
  // The caller receives the rejection; the queue remains usable for later work.
  hostWriteQueue = job.catch(() => {});
  return job;
}

let privacyQueue = Promise.resolve();
function applyWebRTC() {
  const job = privacyQueue.then(updateWebRTC);
  privacyQueue = job.catch(() => {});
  return job;
}
async function updateWebRTC() {
  const s = await getSettings();
  const policy = chrome.privacy.network.webRTCIPHandlingPolicy;
  if (!s.enabled || !s.blockWebRTC) { await policy.clear({}); return; }
  const current = await policy.get({});
  if (['not_controllable','controlled_by_other_extensions'].includes(current.levelOfControl)) {
    throw new Error('WebRTC 策略被浏览器或其他扩展控制');
  }
  await policy.set({value:'disable_non_proxied_udp'});
}

const RESOURCE_TYPES = ['main_frame','sub_frame','xmlhttprequest','script','stylesheet','image','font','media','websocket','ping','other'];
function headersFor(cfg, settings) {
  const headers = [];
  if (settings.rewriteAcceptLanguage && cfg.spoofLanguage && cfg.languages?.length) {
    headers.push({header:'accept-language',operation:'set',value:GeoMaskConfig.languageHeader(cfg.languages)});
  }
  if (cfg.fp.enabled && cfg.fp.uaCH!=='native') {
    const p = GeoMaskConfig.resolvePreset(cfg.fp.profile,cfg.fp.browserVersion,PRESETS,cfg.fp.uaCH==='custom' ? cfg.fp.uaCHFields : {});
    const ua = p.uaData;
    const values = {};
    values['user-agent']=p.ua;
    Object.assign(values,{
      'sec-ch-ua':ua.brands.map(b => '"'+b.brand+'";v="'+b.version+'"').join(', '),
      'sec-ch-ua-mobile':ua.mobile ? '?1' : '?0', 'sec-ch-ua-platform':'"'+ua.platform+'"',
      'sec-ch-ua-platform-version':'"'+ua.platformVersion+'"', 'sec-ch-ua-arch':'"'+ua.architecture+'"',
      'sec-ch-ua-bitness':'"'+ua.bitness+'"', 'sec-ch-ua-full-version':'"'+ua.uaFullVersion+'"',
      'sec-ch-ua-full-version-list':ua.brands.map(b => '"'+b.brand+'";v="'+(b.brand === 'Not_A Brand' ? b.version+'.0.0.0' : b.brand==='Chromium' ? ua.chromiumVersion : ua.uaFullVersion)+'"').join(', '),
      'sec-ch-ua-wow64':ua.wow64 ? '?1' : '?0','sec-ch-ua-model':'""','sec-ch-ua-form-factors':'"Desktop"'
    });
    for (const [header,value] of Object.entries(values)) headers.push({header,operation:'set',value});
  }
  return headers;
}
let headerQueue = Promise.resolve();
function applyHeaders() {
  const job = headerQueue.then(async () => {
    const s = await getSettings();
    const st = await chrome.storage.local.get(['profile',HOST_KEY]);
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const addRules = [];
    const bindings = Object.keys(s.identityByDomain);
    const add = (cfg,priority,condition) => {
      const requestHeaders = headersFor(cfg,s);
      if (!requestHeaders.length) return;
      addRules.push({id:RULE_ID_GLOBAL+addRules.length,priority,
        action:{type:'modifyHeaders',requestHeaders},condition:{resourceTypes:RESOURCE_TYPES,...condition}});
    };
    if (s.enabled) {
      // Exclusion is needed even when a child identity emits no headers:
      // omission cannot cancel a lower-priority global set operation.
      add(effectiveConfig(st.profile,s,{},''),1,
        bindings.length ? {excludedRequestDomains:bindings} : {});
      for (const domain of bindings) {
        const children=bindings.filter(child=>child!==domain && child.endsWith('.'+domain));
        add(effectiveConfig(st.profile,s,{},domain),2+domain.split('.').length,
          {requestDomains:[domain],...(children.length ? {excludedRequestDomains:children} : {})});
      }
      const hosts=new Set([...Object.keys(st[HOST_KEY]||{}),...Object.keys(s.hostAliases)]);
      for (const host of hosts) {
        // Unlike identity bindings, probe caches must match the exact hostname.
        add(effectiveConfig(st.profile,s,st[HOST_KEY],host),100+host.split('.').length,
          {urlFilter:'|http*://'+host+'^'});
      }
    }
    await chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds:existing.map(r=>r.id),addRules});
  });
  headerQueue = job.catch(() => {});
  return job;
}

async function reportError(scope, error) {
  console.error('[GeoMask] ' + scope + ':',error);
  await chrome.storage.local.set({lastError:{scope,message:String(error.message || error),at:Date.now()}});
}
function observe(scope, job) {
  job.catch(error => reportError(scope,error).catch(storageError => console.error('[GeoMask] error persistence failed:',storageError)));
}

async function ensureAlarm() {
  const s = await getSettings();
  const mins = Math.max(5, Number(s.refreshMinutes) || 30);
  if (!s.enabled) {await chrome.alarms.clear(ALARM);return;}
  const existing = await chrome.alarms.get(ALARM);
  if (!existing || existing.periodInMinutes !== mins) {
    await chrome.alarms.clear(ALARM);
    await chrome.alarms.create(ALARM, { periodInMinutes: mins });
  }
}

async function bootstrap() {
  await GeoMaskStartup.sync();
  await applyWebRTC();
  await ensureAlarm();
  await applyHeaders();
  if ((await getSettings()).enabled) await refreshGlobal(true);
}

chrome.runtime.onInstalled.addListener(() => observe('初始化',bootstrap()));
chrome.runtime.onStartup.addListener(() => observe('启动',bootstrap()));

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM || !(await getSettings()).enabled) return;
  await refreshGlobal(true);
  const st = await chrome.storage.local.get(HOST_KEY);
  const map = st[HOST_KEY] || {};
  const now = Date.now();
  for (const key of Object.keys(map)) {
    if (now - (map[key].updatedAt || 0) > 15 * 60000) {
      observe('定时站点探测',resolveHostProfile(key,true).then(applyHeaders));
    }
  }
});

/* 导航开始时预取；网络探测不会阻塞页面脚本 */
if (chrome.webNavigation) {
  chrome.webNavigation.onBeforeNavigate.addListener((d) => {

    try {
      const u = new URL(d.url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
      observe('导航站点探测',resolveHostProfile(u.hostname,false).then(applyHeaders));
    } catch (e) {}
  }, { url: [{ schemes: ['http', 'https'] }] });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (!msg || !msg.type) { sendResponse({ ok: false }); return; }

      if (msg.type === 'syncStartup') {
        await GeoMaskStartup.sync();
        sendResponse({ok:true,startupStatus:(await chrome.storage.local.get('startupStatus')).startupStatus});
        return;
      }

      if (msg.type === 'getState') {
        const st = await chrome.storage.local.get(['profile', 'settings', 'lastError', 'startupStatus']);
        const settings = settingsWithDefaults(st.settings);
        let hostProfile = null;
        if (msg.host) {
          hostProfile = await resolveHostProfile(msg.host,false);
        }
        const nativeInfo=await GeoMaskConfig.nativeBrowserInfo();
        sendResponse({ profile: st.profile || null, hostProfile, settings, nativeInfo,
          consistencyIssues:GeoMaskConfig.configurationIssues(settings,nativeInfo),lastError:st.lastError || null, startupStatus:st.startupStatus || null });
        return;
      }

      if (msg.type === 'resolveHost') {
        const hp = await resolveHostProfile(msg.host, msg.force === true);
        await applyHeaders();
        sendResponse({ hostProfile: hp });
        return;
      }

      if (msg.type === 'refresh') {
        const profile = await refreshGlobal(true);
        await applyHeaders();
        sendResponse({ profile });
        return;
      }

      if (msg.type === 'saveSettings') {
        const merged = validateSettings(msg.settings);
        GeoMaskConfig.validateBrowserProfiles(merged);
        const issues=GeoMaskConfig.configurationIssues(merged,await GeoMaskConfig.nativeBrowserInfo());
        if(issues.length) throw new TypeError(issues.join('\n'));
        await GeoMaskStartup.checkMode(merged);
        await chrome.storage.local.set({ settings: merged });
        await applyWebRTC();
        await ensureAlarm();
        await applyHeaders();
        await GeoMaskStartup.sync();
        await chrome.storage.local.remove('lastError');
        sendResponse({ ok: true, settings: merged });
        return;
      }

      if (msg.type === 'diagnose') {
        const st = await chrome.storage.local.get(['profile', 'settings', HOST_KEY]);
        const settings = settingsWithDefaults(st.settings);
        let hp = null;
        if (msg.host) {
          hp = await resolveHostProfile(msg.host,false);
        }
        if (!hp) hp = st.profile || null;

        const network=GeoMaskIP.describe({host:msg.host || '',hostProfile:hp,profile:st.profile});
        const cfg = effectiveConfig(st.profile,settings,st[HOST_KEY],msg.host || '');
        const local = localHourIn(cfg.timezone);

        const warnings = [];
        if (hp && hp.source === 'global') warnings.push('本站用的是全局兜底结果，可能与该站真实出口不符');
        if (!cfg.fp.enabled) warnings.push('指纹扰动关闭：页面读取本机设备信息');
        if (!hp || !hp.ip) warnings.push('还没探测到出口 IP');

        sendResponse({ profile: hp, network, isp:network.isp, localTime: local, warnings, settings });
        return;
      }

      if (msg.type === 'listHosts') {
        const st = await chrome.storage.local.get(HOST_KEY);
        sendResponse({ hosts: st[HOST_KEY] || {} });
        return;
      }

      if (msg.type === 'forgetHost') {
        await updateHostProfiles(map => { delete map[normalizeHost(msg.host)]; return map; });
        await applyHeaders();
        sendResponse({ ok: true });
        return;
      }

      sendResponse({ ok: false, error: 'unknown message' });
    } catch (err) {
      try { await reportError('操作 '+(msg?.type || 'unknown'),err); }
      catch (storageError) { console.error('[GeoMask] error persistence failed:',storageError); }
      sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
    }
  })();
  return true;
});

chrome.storage.onChanged.addListener((changes,area) => {
  if (area !== 'local') return;
  if (changes.settings) {
    observe('WebRTC 策略更新',applyWebRTC());
    observe('刷新定时器更新',ensureAlarm());
  }
  if (changes.settings || changes.profile || changes[HOST_KEY]) {
    observe('请求头更新',applyHeaders());
    observe('启动配置同步',GeoMaskStartup.sync());
  }
});

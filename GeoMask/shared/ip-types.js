/* Network attribution from the existing GeoIP result; no classification service. */
globalThis.GeoMaskIP=(()=>{
  'use strict';
  const text=value=>typeof value==='string' ? value.trim() : '';
  function normalizeIP(value) {
    if(typeof value!=='string') throw new TypeError('回显缺少 IP 字符串');
    const ip=value.trim();
    if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) {
      if(ip.split('.').some(part=>Number(part)>255 || (part.length>1 && part[0]==='0'))) throw new TypeError('无效 IP: '+ip);
      return ip;
    }
    if(ip.includes(':') && /^[0-9a-f:.]+$/i.test(ip)) {
      try {const host=new URL('https://['+ip+']/').hostname;return host.slice(1,-1);}
      catch(error) {throw new TypeError('无效 IPv6: '+ip);}
    }
    throw new TypeError('无效 IP: '+ip);
  }
  function asnOf(value) {
    const valueText=String(value ?? '');
    return /^(?:AS)?\d+$/i.test(valueText) ? 'AS'+valueText.replace(/^AS/i,'') : '';
  }
  function fromResponse(source,data) {
    const connection=data.connection || {};
    return {source,asn:asnOf(connection.asn ?? data.asn),
      organization:text(connection.org || data.organization || data.asn_org || data.asn_organization || data.asnOrganization || data.org)};
  }
  function describe({host='',hostProfile=null,profile=null}={}) {
    const observed=hostProfile?.probe ? hostProfile.probe.observedIp : (hostProfile?.source?.startsWith('host-') ? hostProfile.ip : null);
    const record=hostProfile || profile || {};
    const ip=observed ? normalizeIP(observed) : record.ip ? normalizeIP(record.ip) : null;
    // A global geographic fallback may describe a different IP from the echo.
    const matches=!!ip && !!record.ip && normalizeIP(record.ip)===ip;
    const data=matches ? record.ipData : null;
    return {ip,scope:observed ? '本站探测请求' : hostProfile?.probe?.stale ? '历史参考，本次出口未确认' : host ? '全局参考，本站出口未确认' : '全局探测参考',observed:!!observed,
      source:matches ? data?.source || record.geoSource || '' : '',asn:data?.asn || '',organization:data?.organization || '',
      isp:matches ? record.isp || '' : '',updatedAt:matches ? record.updatedAt || null : null};
  }
  return Object.freeze({normalizeIP,fromResponse,describe});
})();

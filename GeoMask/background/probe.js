/* Parsing and boundary validation for untrusted probe/GeoIP responses. */
globalThis.GeoMaskProbe=(()=>{
  const MAX_ECHO_CHARS=8192;
  const normalizeIP=GeoMaskIP.normalizeIP;
  function parseEcho(text) {
    // The old parser truncated at this boundary, potentially accepting a prefix.
    if(text.length>MAX_ECHO_CHARS) throw new RangeError('IP 回显响应超过 '+MAX_ECHO_CHARS+' 字符');
    const body=text.trim();
    if(body.startsWith('{') || body.startsWith('"')) {
      const payload=JSON.parse(body);
      const ip=normalizeIP(typeof payload==='string' ? payload : payload.ip ?? payload.ipAddress ?? payload.query ?? payload.origin);
      const country=payload.country_code ?? payload.countryCode ?? payload.country;
      return {ip,country:typeof country==='string' && /^[A-Z]{2}$/i.test(country) ? country.toUpperCase() : null,format:'json'};
    }
    const match=/^ip=(.*?)\s*$/m.exec(body);
    if(match) {
      return {ip:normalizeIP(match[1]),country:/^loc=([A-Z]{2})\s*$/m.exec(body)?.[1] || null,
        colo:/^colo=([A-Z0-9]+)\s*$/m.exec(body)?.[1] || null,format:'trace'};
    }
    return {ip:normalizeIP(body),country:null,format:'ip'};
  }
  function validateGeo(geo) {
    if(!geo || !Number.isFinite(geo.lat) || Math.abs(geo.lat)>90 || !Number.isFinite(geo.lon) || Math.abs(geo.lon)>180 || typeof geo.timezone!=='string') throw new TypeError('GeoIP 返回无效坐标或时区');
    new Intl.DateTimeFormat('en',{timeZone:geo.timezone});
    return geo;
  }
  return Object.freeze({normalizeIP,parseEcho,validateGeo});
})();

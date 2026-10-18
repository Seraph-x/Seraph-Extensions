/* Presentation only: use the runtime's merge rules, then explain each source. */
globalThis.GeoMaskPanel=(()=>{
  const PROFILE_NAMES=Object.fromEntries(GeoMaskConfig.profileOptions().map(item=>[item.id,item.platform+' · '+item.label]));
  function bindingFor(host,s) {
    const domain=Object.keys(s.identityByDomain).filter(key=>host===key || host.endsWith('.'+key)).sort((a,b)=>b.length-a.length)[0];
    const id=(domain && s.identityByDomain[domain]) || s.defaultIdentity || null;
    return {id,label:id ? s.identities[id]?.label || id : '全局基础设置',exact:domain===host,
      source:domain ? (domain===host ? '本站绑定' : '继承父域 '+domain) : (id ? '默认身份' : '全局基础设置')};
  }
  function identityUsage(s,id) {
    if(!Object.hasOwn(s.identities,id)) throw new Error('身份不存在，请重新选择');
    return {id,label:s.identities[id].label || id,isDefault:s.defaultIdentity===id,
      domains:Object.entries(s.identityByDomain).filter(([,value])=>value===id).map(([domain])=>domain).sort()};
  }
  function withoutIdentity(s,id) {
    identityUsage(s,id);
    const identities={...s.identities};delete identities[id];
    return {...s,identities,defaultIdentity:s.defaultIdentity===id ? null : s.defaultIdentity,
      identityByDomain:Object.fromEntries(Object.entries(s.identityByDomain).filter(([,value])=>value!==id))};
  }
  function withoutDomainBinding(s,domain) {
    if(!Object.hasOwn(s.identityByDomain,domain)) throw new Error('域名绑定不存在，请重新读取');
    const identityByDomain={...s.identityByDomain};delete identityByDomain[domain];
    return {...s,identityByDomain};
  }
  function directoryView(s,query='') {
    const domains=new Map(Object.keys(s.identities).map(id=>[id,[]]));
    const allBindings=Object.entries(s.identityByDomain).map(([domain,id])=>{
      domains.get(id)?.push(domain);return {domain,id,label:s.identities[id]?.label || id};
    }).sort((a,b)=>a.domain.localeCompare(b.domain));
    const allIdentities=Object.entries(s.identities).map(([id,item])=>({id,label:item.label || id,isDefault:s.defaultIdentity===id,
      domains:domains.get(id).sort()})).sort((a,b)=>a.label.localeCompare(b.label,'zh-CN') || a.id.localeCompare(b.id));
    const term=query.trim().toLocaleLowerCase();
    const matches=values=>values.some(value=>value.toLocaleLowerCase().includes(term));
    return {identities:allIdentities.filter(item=>matches([item.id,item.label,...item.domains])),
      bindings:allBindings.filter(item=>matches([item.domain,item.id,item.label])),identityTotal:allIdentities.length,bindingTotal:allBindings.length};
  }
  function nextIdentityLabel(s) {
    const labels=new Set(Object.values(s.identities).map(item=>item.label));
    let number=1;while(labels.has('身份 '+number)) number++;
    return '身份 '+number;
  }
  function locationOf(p) {
    return [...new Set([p?.countryName || p?.country,p?.region,p?.city].filter(Boolean))].join(' / ') || '暂无位置数据';
  }
  function formChanged(current,baseline,prefix) {
    const normalize=form=>Object.fromEntries(Object.keys(form).sort().filter(key=>{
      if(key.startsWith(prefix+'-ch-') && form[prefix+'-ua-ch']!=='custom') return false;
      if(prefix==='id' && key.startsWith('id-geo-') && key!=='id-geo-mode' && form['id-geo-mode']!=='fixed') return false;
      return true;
    }).map(key=>[key,form[key]]));
    return JSON.stringify(normalize(current))!==JSON.stringify(normalize(baseline));
  }
  function deviceTransition({previousSystem,nextSystem,platformVersion,previousDefaultVersion,defaultVersion,wow64}) {
    const changedSystem=previousSystem!==nextSystem;
    return {changedSystem,platformVersion:changedSystem || !platformVersion || platformVersion===previousDefaultVersion ? defaultVersion : platformVersion,
      wow64:nextSystem==='Windows' ? wow64 : 'false'};
  }
  function fingerprintSummary(fp) {
    const mode={native:'原生标识',custom:'自定义标识',profile:'档案默认标识'}[fp.uaCH] || '继承标识设置';
    const browser=fp.uaCH==='native' ? '' : ' · '+browserName(fp);
    return (PROFILE_NAMES[fp.profile] || '待选择设备')+' · '+mode+browser;
  }
  function browserName(fp) {return (fp.uaCH==='custom' && fp.uaCHFields?.browser ? fp.uaCHFields.browser==='edge' : fp.profile==='win-edge') ? 'Edge' : 'Chrome';}
  function probeOutcome(hostProfile,siteIP) {
    if(siteIP) return {confirmed:true,message:hostProfile.source==='global' || hostProfile.probe?.stale
      ? '已取得回显 IP，但本次未取得归属地；地理配置见上方来源。' : '已取得本站探测请求的回显 IP；不保证其他请求使用相同出口。'};
    const errors=hostProfile?.probe?.errors || [];
    const reasons=errors.map(error=>{
      const status=error.status || Number(/^HTTP (\d{3})$/.exec(error.message)?.[1]);
      if(status===404) return 'HTTP 404：该路径未提供回显接口';
      if(status===401 || status===403) return 'HTTP '+status+'：回显请求被站点拒绝';
      if(status) return '回显请求返回 HTTP '+status;
      if(error.kind==='timeout') return '回显请求超时';
      if(error.kind==='invalid-response') return '接口响应不是有效的 IP 回显';
      return '请求失败：'+error.message;
    });
    return {confirmed:false,message:reasons.length ? [...new Set(reasons)].join('；')+'。本站出口仍未确认。'
      : hostProfile?.probe ? '本次未取得 IP 回显，本站出口仍未确认。' : '尚无本站回显证据。'};
  }
  function describeSite({host='',settings={},profile=null,hostProfile=null}) {
    const s=GeoMaskConfig.settingsWithDefaults(settings);
    const binding=bindingFor(host,s);
    const identity=s.identities[binding.id];
    const cfg=GeoMaskConfig.effectiveConfig(profile,s,hostProfile ? {[hostProfile.host || GeoMaskConfig.aliasHost(host,s)]:hostProfile} : {},host);
    const geoSource=hostProfile?.probe?.stale ? '本站历史配置（本次未取得地理结果）'
      : hostProfile && hostProfile.source!=='global' ? '本站探测' : '全局探测（本站未取得地理结果）';
    const fieldSource=key=>{
      if(s.manual?.[key]!=null && s.manual[key]!=='') return '全局手动覆盖';
      if(identity?.geo?.mode==='fixed' && identity.geo[key]!=null && identity.geo[key]!=='') return '身份固定配置';
      return geoSource;
    };
    const field=(key,enabled)=>({active:!!(cfg.enabled && enabled && cfg[key]!=null),
      value:cfg.enabled && enabled && cfg[key]!=null ? cfg[key] : '浏览器原始值',
      source:cfg.enabled && enabled && cfg[key]!=null ? fieldSource(key) : (!cfg.enabled ? '扩展已暂停' : enabled ? '没有可用配置' : '此项未开启')});
    const fp=cfg.fp;
    const syntheticClient=fp.enabled && fp.uaCH!=='native';
    const clientBrowser=browserName(fp);
    const client={value:syntheticClient ? GeoMaskConfig.PRESETS[fp.profile]?.uaData.platform+' · '+clientBrowser+' · Chromium '+(fp.browserVersion?.chromium || '版本待读取') : '浏览器原始标识',
      source:syntheticClient ? (identity?.fp?.uaCH ? '身份 UA / UA-CH 设置' : '继承全局 UA / UA-CH 设置') : 'UA 与 UA-CH 均保留原生'};
    const deviceActive=!!(fp.enabled && fp.navigator);
    const siteIP=hostProfile?.probe ? hostProfile.probe.observedIp : (hostProfile?.source?.startsWith('host-') ? hostProfile.ip : null);
    const coordinatesAvailable=typeof cfg.lat==='number' && typeof cfg.lon==='number';
    const coordinate=key=>cfg.enabled && cfg.spoofGeolocation && !coordinatesAvailable
      ? {active:false,value:'浏览器原始值',source:'坐标不完整，使用浏览器定位'} : field(key,cfg.spoofGeolocation);
    const probeSource=hostProfile?.probe?.stale ? '本次未取得地理结果 · 保留旧配置'
      : hostProfile?.source==='global' ? (siteIP ? '本站 IP 已回显 · 地理配置使用全局结果' : '本站未回显 · 地理配置使用全局结果')
      : {'host-trace':'本站回显（仅代表探测请求）','host-echo':'本站回显（仅代表探测请求）','host-trace+country':'本站回显 · 国家代表位置'}[hostProfile?.source] || '尚未探测';
    return {cfg,binding,client,fonts:{value:fp.enabled && fp.fonts ? '文字测量扰动' : '保留原生测量',source:'不替换字体库，不按 IP 切换字体'},timezone:field('timezone',cfg.spoofTimezone),language:field('locale',cfg.spoofLanguage),
      intlLocale:field('locale',cfg.spoofIntlLocale),latitude:coordinate('lat'),
      longitude:coordinate('lon'),fingerprintEnabled:!!fp.enabled,probeSource,probeOutcome:probeOutcome(hostProfile,siteIP),
      device:{active:deviceActive,value:deviceActive ? PROFILE_NAMES[fp.profile] : '浏览器原始设备信息',
        source:deviceActive ? (identity?.fp?.profile ? '身份设备档案' : '全局设备档案') : (!cfg.enabled ? '扩展已暂停' : !fp.enabled ? '设备与指纹总开关关闭' : '设备参数覆盖关闭')},
      seedSource:identity?.fp?.seed ? '身份独立种子' : '继承全局种子',
      headerLanguage:cfg.enabled && cfg.spoofLanguage && s.rewriteAcceptLanguage && cfg.languages?.length ? GeoMaskConfig.languageHeader(cfg.languages) : '浏览器原始请求头',
      headerUA:fp.enabled && fp.uaCH!=='native' ? '与 UA-CH 联动 · Chromium '+(fp.browserVersion?.chromium || '版本不可识别') : '浏览器原始请求头',
      uaCH:fp.enabled && fp.uaCH!=='native' ? (fp.uaCH==='custom' ? '自定义字段 · UA 联动' : '跟随设备档案 · 版本跟随浏览器') : '浏览器原始 UA-CH',
      siteIP:siteIP || '本站出口未确认',
      siteLocation:siteIP && hostProfile.ip===siteIP ? locationOf(hostProfile) : '本站 IP 归属地未确定'};
  }
  return Object.freeze({describeSite,bindingFor,identityUsage,withoutIdentity,withoutDomainBinding,directoryView,nextIdentityLabel,locationOf,formChanged,deviceTransition,fingerprintSummary,PROFILE_NAMES});
})();

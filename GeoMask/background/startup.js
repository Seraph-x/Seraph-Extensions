/* Browser-managed startup snapshots. Only the extension worker loads this file. */
globalThis.GeoMaskStartup=(()=>{
  const STANDARD_ID='gm-standard';
  const PREFIX='gm-preload-';
  const WEB=['http://*/*','https://*/*'];
  let queue=Promise.resolve();
  let template;
  async function checkMode(settings) {
    if (settings.startupMode!=='enhanced' || !settings.enabled) return;
    try {
      if (!chrome.userScripts) throw new Error('userScripts API 不可用');
      await chrome.userScripts.getScripts();
    } catch(error) {
      throw new Error('增强启动需要在扩展详情中允许用户脚本（Chrome 135–137 开启开发者模式，138+ 开启“允许用户脚本”）：'+error.message);
    }
  }
  function patterns(node) {
    return node.type==='binding' ? [`*://${node.host}/*`,`*://*.${node.host}/*`] : [`*://${node.host}/*`];
  }
  function within(host,parent) {return host===parent || host.endsWith('.'+parent);}
  function specifications(state) {
    const s=GeoMaskConfig.settingsWithDefaults(state.settings);
    const nodes=[{type:'default',host:''},
      ...Object.keys(s.identityByDomain).map(host=>({type:'binding',host})),
      ...new Set([...Object.keys(state.hostProfiles||{}),...Object.keys(s.hostAliases)])].map(node=>typeof node==='string' ? {type:'exact',host:node} : node);
    return nodes.map(node=>{
      const excludes=nodes.filter(other=>{
        if(other===node || other.type==='default' || node.type==='exact') return false;
        return node.type==='default' || (within(other.host,node.host) && (other.type==='exact' || other.host!==node.host));
      }).flatMap(patterns);
      const cfg=GeoMaskConfig.effectiveConfig(state.profile,s,node.type==='exact' ? state.hostProfiles : {},node.host);
      return {id:PREFIX+node.type+(node.host ? '-'+node.host : ''),
        matches:node.type==='default' ? WEB : patterns(node),excludeMatches:[...new Set(excludes)],
        runAt:'document_start',world:'MAIN',allFrames:true,cfg};
    });
  }
  async function source() {
    if (!template) {
      const response=await fetch(chrome.runtime.getURL('content/main.js'));
      if(!response.ok) throw new Error('启动运行时读取失败: HTTP '+response.status);
      const text=await response.text();
      if(!text.includes('/* INITIAL_CONFIG */null')) throw new Error('启动运行时缺少配置占位符，请重新构建');
      template=text;
    }
    return template;
  }
  async function status(value) {await chrome.storage.local.set({startupStatus:{...value,updatedAt:Date.now()}});}
  async function enhanced(state,standard) {
    await checkMode(GeoMaskConfig.settingsWithDefaults(state.settings));
    if(!chrome.userScripts) throw new Error('userScripts API 不可用，无法同步增强启动');
    const api=chrome.userScripts;
    const before=(await api.getScripts()).filter(script=>script.id.startsWith(PREFIX));
    const text=await source();
    const desired=specifications(state).map(({cfg,...spec})=>({...spec,js:[{code:text.replace('/* INITIAL_CONFIG */null',()=>JSON.stringify(cfg))}]}));
    const currentIds=new Set(before.map(script=>script.id));
    const wantedIds=new Set(desired.map(script=>script.id));
    // New scripts are initially inactive; one batch then changes all partitions.
    const additions=desired.filter(script=>!currentIds.has(script.id)).map(script=>({...script,excludeMatches:WEB}));
    // Keep cleanup evidence separate from requested-mode/error status. API
    // permission can disappear between calls or across worker restarts.
    await chrome.storage.local.set({startupRegistration:{enhancedPresent:true}});
    if(additions.length) await api.register(additions);
    const obsolete=before.filter(script=>!wantedIds.has(script.id));
    if(standard.length) await chrome.scripting.unregisterContentScripts({ids:standard.map(script=>script.id)});
    try {
      await api.update([...desired,...obsolete.map(script=>({...script,excludeMatches:WEB}))]);
    } catch(error) {
      if(standard.length) {
        try {await chrome.scripting.registerContentScripts(standard);}
        catch(restoreError) {throw new Error(error.message+'；普通启动注册恢复失败：'+restoreError.message);}
        throw new Error(error.message+'；已恢复此前的普通启动注册，增强模式未启用');
      }
      throw error;
    }
    if(obsolete.length) await api.unregister({ids:obsolete.map(script=>script.id)});
    await status({mode:'enhanced',active:true,scriptCount:desired.length,error:null});
  }
  async function standard(existing) {
    const state=await chrome.storage.local.get(['startupStatus','startupRegistration']);
    const cleanup=state.startupRegistration?.enhancedPresent || (state.startupStatus?.mode==='enhanced' && state.startupStatus.active);
    if(cleanup) {
      try {
        if(!chrome.userScripts) throw new Error('userScripts API 不可用');
        const scripts=(await chrome.userScripts.getScripts()).filter(script=>script.id.startsWith(PREFIX));
        if(scripts.length) await chrome.userScripts.unregister({ids:scripts.map(script=>script.id)});
      } catch(error) {throw new Error('请先允许用户脚本，以清理旧的增强启动注册，再切换普通模式：'+error.message);}
    }
    if(!existing.length) await chrome.scripting.registerContentScripts([{
      id:STANDARD_ID,js:['content/main.js'],matches:WEB,allFrames:true,
      matchOriginAsFallback:false,runAt:'document_start',world:'MAIN',persistAcrossSessions:true
    }]);
    await chrome.storage.local.set({startupRegistration:{enhancedPresent:false}});
    await status({mode:'standard',active:true,scriptCount:1,error:null});
  }
  function sync() {
    const job=queue.then(async()=>{
      const state=await chrome.storage.local.get(['settings','profile','hostProfiles']);
      const s=GeoMaskConfig.settingsWithDefaults(state.settings);
      try {
        const existing=(await chrome.scripting.getRegisteredContentScripts()).filter(script=>script.id===STANDARD_ID);
        if(s.startupMode==='enhanced') await enhanced(state,existing);
        else await standard(existing);
      } catch(error) {
        await status({mode:s.startupMode,active:false,error:error.message});
        throw error;
      }
    });
    queue=job.catch(()=>{});
    return job;
  }
  return Object.freeze({checkMode,sync,specifications});
})();

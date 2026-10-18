'use strict';
const $=id=>document.getElementById(id);
let settings=null,profile=null,hostProfile=null,hostKey='',startupStatus=null;
let nativeInfo=null,consistencyIssues=[];
let currentTabId=null,workerStatus=null,pageConnection=null;
let activeView='site';
const viewScroll=new Map();
let busy=false,fpDirty=false,manualDirty=false,siteSelectionDirty=false;
const TOGGLES=['spoofTimezone','spoofGeolocation','spoofLanguage','spoofIntlLocale','blockWebRTC','rewriteAcceptLanguage','jitter','rtcFilter','workerAutoFallback'];
async function request(message) {
  const response=await chrome.runtime.sendMessage(message);
  if(!response || response.ok===false) throw new Error(response?.error || '后台没有返回有效结果');
  return response;
}
function msg(text,tone=true) {
  const color=typeof tone==='boolean' ? (tone ? 'green' : 'danger') : ({success:'green',error:'danger',warning:'warning',neutral:'muted'}[tone] || 'muted');
  $('msg').textContent=text;$('msg').style.color='var(--'+color+')';
}
function showError(error) {
  $('status-error').hidden=false;$('status-error').textContent=String(error.message || error);msg('操作未完成，请查看上方错误。',false);
  $('status-error').focus?.({preventScroll:true});$('status-error').scrollIntoView?.({block:'center'});
}
window.addEventListener('unhandledrejection',event=>{event.preventDefault();showError(event.reason);});
function setBusy(value) {
  busy=value;$('controls').disabled=value || !settings;$('enabled').disabled=value || !settings;
  document.body.setAttribute('aria-busy',String(value));
  if(settings) updateDraftSummary();
  if(!value) applyPendingIdentityFocus();
}
async function readState() {
  const [state,cache]=await Promise.all([request({type:'getState'}),chrome.storage.local.get('hostProfiles')]);
  settings=GeoMaskConfig.settingsWithDefaults(state.settings);profile=state.profile;startupStatus=state.startupStatus;
  nativeInfo=state.nativeInfo;consistencyIssues=state.consistencyIssues || [];
  hostProfile=cache.hostProfiles?.[GeoMaskConfig.aliasHost(hostKey,settings)] || null;
  renderBackgroundHistory(state.lastError);
  return state;
}
async function perform(action) {
  if(busy) {showError(new Error('上一项操作仍在处理，请等待完成。'));return;}
  setBusy(true);$('status-error').hidden=true;msg('正在处理…','neutral');
  try {await action();}
  catch(error) {
    try {await readState();render();}
    catch(readError) {error=new Error(error.message+'；读取实际保存状态失败：'+readError.message);}
    showError(error);
  } finally {setBusy(false);}
}
async function commitSettings(next,message,{resetFP=false,resetManual=false,onSaved}={}) {
  GeoMaskConfig.validateSettings(next);
  const response=await request({type:'saveSettings',settings:next});
  settings=response.settings;
  if(resetFP) fpDirty=false;if(resetManual) manualDrafts.delete(manualEditorPriority);
  onSaved?.();
  await readState();await readWorkerStatus();render();$('refresh-note').hidden=false;msg(message);
}
function fmtTime(ts) {return ts ? new Date(ts).toLocaleString('zh-CN',{hour12:false}) : '暂无记录';}
function renderBackgroundHistory(error) {
  $('background-history').hidden=!error;
  if(!error) return;
  $('background-history-title').textContent='上次后台任务失败 · '+fmtTime(error.at);
  $('background-history-detail').textContent=error.scope+'：'+error.message;
}
function coordOf(p) {return typeof p?.lat==='number' && typeof p?.lon==='number' ? p.lat.toFixed(4)+', '+p.lon.toFixed(4) : '暂无坐标';}
function renderStartupStatus(status) {
  const badge=$('startup-badge');badge.className='badge';
  if(!settings?.enabled) {badge.textContent='扩展已暂停';}
  else if(status?.active) {badge.textContent=status.mode==='enhanced' ? '增强启动已注册' : '普通启动';badge.classList.add('good');}
  else {badge.textContent=status?.error ? '启动配置异常' : '启动状态未知';if(status?.error) badge.classList.add('bad');}
  $('startup-status').textContent=status ? status.active ? (status.mode==='enhanced' ? '增强启动已注册' : '普通启动已注册')+'；刷新网页后使用。' : '启动配置未生效：'+status.error : '尚无启动注册回执，请点击检查 / 应用。';
}
function renderSite() {
  const view=GeoMaskPanel.describeSite({host:hostKey,settings,profile,hostProfile});
  $('h-host').textContent=hostKey || '当前标签页不是网页';
  $('site-config').hidden=!hostKey;
  $('site-note').textContent=hostKey ? '配置值与页面回执分别显示；不代表网站已采集的结果。' : '请在 HTTP/S 网页中打开面板。全局设置与身份管理仍可使用。';
  renderWorkerStatus();
  $('e-identity').textContent=view.binding.label;$('e-identity-source').textContent=view.binding.source;
  $('e-client').textContent=view.client.value;$('e-client-source').textContent=view.client.source;
  $('e-fonts').textContent=view.fonts.value;$('e-fonts-source').textContent=view.fonts.source;
  for(const [id,field] of [['timezone',view.timezone],['language',view.language],['device',view.device]]) {
    $('e-'+id).textContent=field.value;$('e-'+id+'-source').textContent=field.source;
  }
  $('e-coordinates').textContent=view.latitude.active ? Number(view.latitude.value).toFixed(4)+', '+Number(view.longitude.value).toFixed(4) : view.latitude.value==='定位不可用' ? '定位不可用' : '浏览器原始定位';
  $('e-coordinates-source').textContent=view.latitude.active ? '纬度：'+view.latitude.source+' · 经度：'+view.longitude.source+(settings.jitter ? ' · 轻微抖动' : '') : view.latitude.source;
  $('e-geolocation-note').textContent=view.geolocationNote;
  const features=[['canvas','Canvas像素'],['webgl','显卡标识'],['audio','音频频谱']].filter(([key])=>view.cfg.fp[key]).map(([,label])=>label);
  $('e-fingerprint').textContent=view.fingerprintEnabled ? (features.length ? features.join(' / ') : '这三项未开启') : '已关闭';
  $('e-seed-source').textContent=view.fingerprintEnabled ? view.seedSource : '独立于时区、语言与定位开关';
  $('e-intl').textContent=view.intlLocale.value+' · '+view.intlLocale.source;
  $('e-header-language').textContent=view.headerLanguage;$('e-header-ua').textContent=view.headerUA;
  $('e-ua-ch').textContent=view.uaCH;
  $('h-ip').textContent=hostKey ? view.siteIP : '—';$('h-loc').textContent=hostKey ? view.siteLocation : '—';
  $('h-src').textContent=view.probeSource;$('h-tz').textContent=hostProfile?.timezone || '暂无记录';
  $('h-probe-status').textContent=view.probeOutcome.message;
  $('probe-badge').textContent=view.probeOutcome.confirmed ? '已回显' : '未确认';
  $('probe-badge').className='badge '+(view.probeOutcome.confirmed ? 'good' : 'pending');
  renderRuntimeSummary(view.probeOutcome);
  renderNetwork(GeoMaskIP.describe({host:hostKey,hostProfile,profile}));
  const probe=hostProfile?.probe;
  $('h-probe').textContent=probe ? [probe.attemptedAt ? '尝试时间：'+fmtTime(probe.attemptedAt) : '',probe.endpoint,probe.observedAt ? '观测时间：'+fmtTime(probe.observedAt) : '',probe.fallbackReason,...(probe.errors || []).map(error=>[error.endpoint,error.message].filter(Boolean).join('：'))].filter(Boolean).join('\n') : '暂无探测证据，点击重新探测本站获取。';
  $('refreshHost').disabled=!hostKey;
  renderSiteBinding(view.binding);
}
function renderSettings() {
  $('enabled').checked=settings.enabled;$('master-status').textContent=settings.enabled ? '已启用 · 查看本站配置与来源' : '已暂停 · 使用浏览器原始值';
  for(const key of TOGGLES) $(key).checked=settings[key];
  renderGlobalForms();
  $('device-issues').hidden=!consistencyIssues.length;$('device-issues').textContent=consistencyIssues.join('\n');
  $('startup-mode').value=settings.startupMode;renderStartupStatus(startupStatus);
  for(const [id,value] of Object.entries({'s-ip':profile?.ip || '暂无结果','s-loc':GeoMaskPanel.locationOf(profile),'s-tz':profile?.timezone || '暂无结果','s-coord':coordOf(profile),'s-isp':profile?.isp || '未知','s-time':fmtTime(profile?.updatedAt),'s-src':profile?.source || '暂无结果'})) $(id).textContent=value;
}
function render() {if(!settings) return;renderSettings();renderSite();renderIdentities();updateDraftSummary();}
function renderNetwork(result) {
  $('d-target').textContent=(result.ip || '无可用 IP')+' · '+result.scope;
  $('d-source').textContent=result.source || '未提供';
  $('d-isp').textContent=result.isp || '未提供';
  $('d-network').textContent=[result.asn,result.organization].filter(Boolean).join(' · ') || '未提供';
  $('d-time').textContent=fmtTime(result.updatedAt);
}
async function currentHost() {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  currentTabId=tab?.id ?? null;
  if(!tab?.url) return '';const url=new URL(tab.url);return /^https?:$/.test(url.protocol) ? url.hostname : '';
}
async function load() {
  hostKey=await currentHost();const state=await readState();await readWorkerStatus();render();
  msg(pageConnection ? pageConnection.message : '已读取保存配置',pageConnection?.state==='error' ? 'error' : pageConnection && pageConnection.state!=='ready' ? 'warning' : 'success');
}
function showView(view) {
  const main=document.querySelector('main');
  viewScroll.set(activeView,main.scrollTop);activeView=view;
  for(const name of ['site','identities','settings']) {
    $('view-'+name).hidden=name!==view;$('tab-'+name).setAttribute('aria-selected',String(name===view));$('tab-'+name).tabIndex=name===view ? 0 : -1;
  }
  main.scrollTo(0,viewScroll.get(view) || 0);
}
function collectFP() {
  return {...collectDeviceConfiguration('fp',settings.fp),enabled:$('fp-enabled').checked,seed:$('fp-seed').value.trim(),
    ...Object.fromEntries(['canvas','webgl','audio','fonts'].map(key=>[key,$('fp-'+key).checked]))};
}
function collectManual() {
  const manual={};
  for(const [key,id] of MANUAL_INPUTS) {
    const value=$(id).value.trim();
    if($(id).validity.badInput) throw new Error('请输入有效的'+(key==='lat' ? '纬度' : '经度'));
    if(value) manual[key]=['lat','lon'].includes(key) ? Number(value) : value;
  }
  return Object.keys(manual).length ? manual : null;
}
document.addEventListener('DOMContentLoaded',()=>{
  $('version').textContent=chrome.runtime.getManifest().version;
  for(const view of ['site','identities','settings']) {
    $('tab-'+view).addEventListener('click',()=>showView(view));
    $('tab-'+view).addEventListener('keydown',event=>{
      const names=['site','identities','settings'];const delta={ArrowRight:1,ArrowLeft:-1}[event.key];
      if(!delta) return;event.preventDefault();const next=names[(names.indexOf(view)+delta+3)%3];showView(next);$('tab-'+next).focus();
    });
  }
  const action=(id,fn,event='click')=>$(id).addEventListener(event,()=>perform(fn));
  action('worker-check',async()=>{await readWorkerStatus();renderWorkerStatus();msg(pageConnection?.message || '当前页面状态不可用',pageConnection?.state==='error' ? 'error' : pageConnection?.state==='ready' ? 'success' : 'warning');});
  action('page-reload',reloadCurrentPage);
  action('worker-save',saveWorkerMode);
  $('worker-mode').addEventListener('change',updateWorkerDraft);
  $('worker-discard').addEventListener('click',discardWorkerDraft);
  action('enabled',()=>commitSettings({...settings,enabled:$('enabled').checked},$('enabled').checked ? '扩展已启用，请刷新网页' : '扩展已暂停，请刷新网页以统一状态'),'change');
  for(const key of TOGGLES) action(key,()=>commitSettings({...settings,[key]:$(key).checked},'全局开关已保存'),'change');
  setupDeviceControls('fp',updateFPDraft);
  for(const id of ['fp-enabled','fp-seed','fp-canvas','fp-webgl','fp-audio','fp-fonts']) $(id).addEventListener('input',updateFPDraft);
  for(const id of MANUAL_FIELDS) $(id).addEventListener('input',updateManualDraft);
  $('m-priority').addEventListener('change',switchManualPriority);
  action('fp-save',()=>commitSettings({...settings,fp:collectFP()},'全局设备与指纹已保存',{resetFP:true}));
  action('save',()=>commitSettings(GeoMaskConfig.withManualLocation(settings,{priority:manualEditorPriority,manual:collectManual()}),'此组位置已保存并启用，请刷新网页',{resetManual:true}));
  action('reset',()=>commitSettings(GeoMaskConfig.withManualLocation(settings,{priority:manualEditorPriority,manual:null,activate:false}),'此组位置已清除，另一组与启用优先级保留',{resetManual:true}));
  action('startup-mode',()=>commitSettings({...settings,startupMode:$('startup-mode').value},'启动模式已保存，请刷新网页'),'change');
  action('startup-check',async()=>{const result=await request({type:'syncStartup'});startupStatus=result.startupStatus;renderStartupStatus(startupStatus);msg('启动注册状态已更新');});
  action('refresh',async()=>{
    const result=await request({type:'refresh'});if(!result.profile) throw new Error('没有可用的全局探测结果');
    await request({type:'syncStartup'});await readState();render();msg('全局探测已更新；本站结果可在概览中单独刷新');
  });
  action('refreshHost',async()=>{
    const result=await request({type:'resolveHost',host:hostKey,force:true});if(!result.hostProfile) throw new Error('没有可用的本站探测结果');
    await request({type:'syncStartup'});await readState();render();
    const view=GeoMaskPanel.describeSite({host:hostKey,settings,profile,hostProfile});
    msg(view.probeOutcome.message+(view.probeOutcome.confirmed ? ' 请刷新原网页' : ''),view.probeOutcome.confirmed);
    if(view.probeOutcome.confirmed) $('refresh-note').hidden=false;
  });
  setupIdentityControls();setupIdentityDirectory();setupDraftControls();perform(load);
});

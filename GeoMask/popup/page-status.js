'use strict';
const workerDrafts=new Map();

function renderWorkerForm() {
  for(const [host,mode] of workerDrafts) if(mode===(settings.workerModeByDomain[host] || 'auto')) workerDrafts.delete(host);
  const dirty=workerDrafts.has(hostKey);
  $('worker-mode').value=workerDrafts.get(hostKey) ?? settings.workerModeByDomain[hostKey] ?? 'auto';
  $('worker-state').textContent=dirty ? '未保存' : '已保存';
  $('worker-state').className='badge'+(dirty ? ' pending' : '');
  $('worker-save').disabled=!hostKey || !dirty || pageConnection?.state==='restricted';
  $('worker-discard').disabled=!dirty;
  updateDraftSummary();
}
function updateWorkerDraft() {
  if(!hostKey) return;
  const mode=$('worker-mode').value;
  if(mode===(settings.workerModeByDomain[hostKey] || 'auto')) workerDrafts.delete(hostKey);
  else workerDrafts.set(hostKey,mode);
  renderWorkerForm();
}
function discardWorkerDraft() {
  workerDrafts.delete(hostKey);renderWorkerForm();msg('本站 Worker 修改已撤销，恢复已保存模式');
}
async function saveWorkerMode() {
  if(!hostKey || !workerDrafts.has(hostKey)) throw new Error('本站没有待保存的 Worker 修改');
  const host=hostKey,mode=workerDrafts.get(host);
  const workerModeByDomain={...settings.workerModeByDomain};
  if(mode==='auto') delete workerModeByDomain[host];else workerModeByDomain[host]=mode;
  await commitSettings({...settings,workerModeByDomain},mode==='native'
    ? '本站原生模式已保存；Worker 内保留原生值，请刷新此页' : '本站已恢复自动处理，请刷新此页',
    {onSaved:()=>workerDrafts.delete(host)});
}
function renderRuntimeSummary(probe=GeoMaskPanel.describeSite({host:hostKey,settings,profile,hostProfile}).probeOutcome) {
  const summary=GeoMaskPanel.runtimeSummary({enabled:settings.enabled,connection:pageConnection,worker:workerStatus,
    workerMode:settings.workerModeByDomain[hostKey] || 'auto',probe});
  for(const [key,state] of Object.entries(summary)) {
    $('runtime-'+key).textContent=state.label;$('runtime-'+key).className='state-chip '+state.tone;
  }
}
async function readWorkerStatus(documentId) {
  pageConnection=null;
  if(!hostKey || currentTabId==null) {workerStatus={mode:'unavailable',reason:'当前标签页不是可查询的网页。'};return;}
  if(hostKey==='chromewebstore.google.com') {
    pageConnection=GeoMaskPanel.connectionStatus({restricted:true});
    workerStatus={mode:'unavailable',reason:'浏览器保护页面不允许注入。'};return;
  }
  try {
    const response=await chrome.tabs.sendMessage(currentTabId,{type:'getPageStatus'},{frameId:0,...(documentId ? {documentId} : {})});
    if(!response?.ok || typeof response.page?.connected!=='boolean' || typeof response.page?.applied!=='boolean') throw new Error('页面没有返回有效的连接回执，请刷新网页。');
    pageConnection=GeoMaskPanel.connectionStatus({page:response.page,version:chrome.runtime.getManifest().version});
    workerStatus=response.status;
  } catch(error) {
    pageConnection=GeoMaskPanel.connectionStatus({error:error.message});
    workerStatus={mode:'unavailable',reason:error.message};
  }
}
function renderWorkerStatus() {
  $('page-connection').hidden=!hostKey;
  $('page-status').textContent=pageConnection?.message || '尚未读取当前页面连接状态';
  $('page-note').textContent=pageConnection?.detail || '脚本注册状态与页面连接状态分别检查。';
  $('page-reload').disabled=!hostKey || pageConnection?.state==='restricted';
  renderWorkerForm();
  const nativeSelected=settings.workerModeByDomain[hostKey]==='native';
  const switched=workerStatus?.mode==='native';
  $('worker-status').textContent=switched ? (workerStatus.reason==='site-setting' ? '已按本站设置使用原生 Worker 入口' : '已因 CSP 切换原生 Worker 入口')+'（'+workerStatus.count+' 个）' :
    workerStatus?.mode==='unavailable' ? '当前页面状态不可用：'+workerStatus.reason : nativeSelected ? '本站原生模式已配置；当前页面尚未报告 Worker 创建' : '当前页面尚未报告自动切换';
  $('worker-note').textContent=switched ? '这些 Worker 内时区、语言和部分指纹保持原生值；页面与请求头继续按配置处理。切换入口不代表启动成功，原生错误仍会报告。此处仅显示顶层页面报告，子 frame / 子 Worker 请查看其控制台。' :
    nativeSelected ? '本站已保存原生模式：新建 Worker 跳过 Blob 包装，其内部保留原生值。刷新此页后从启动时应用。' :
    '只在确认 CSP 禁止 blob Worker 时切换，不会修改网站 CSP。'+(settings.workerAutoFallback ? '自动切换已开启；首次拦截日志仍可能产生，可为本站保存原生模式。' : '自动切换已关闭；已有原生 Worker 不会恢复伪装，需刷新网页。');
  $('worker-check').disabled=!hostKey;
  renderRuntimeSummary();
}
async function reloadCurrentPage() {
  if(currentTabId==null || !hostKey) throw new Error('当前没有可刷新的网页');
  const tab=await chrome.tabs.get(currentTabId);
  if(new URL(tab.url).hostname!==hostKey) throw new Error('标签页已跳转，请重新打开面板检查当前站点');
  const before=await chrome.webNavigation.getFrame({tabId:currentTabId,frameId:0});
  if(!before?.documentId) throw new Error('无法取得当前文档标识，未刷新；请重新打开面板');
  await chrome.tabs.reload(currentTabId);
  pageConnection={state:'pending',message:'等待刷新后的新文档',detail:'收到新文档的配置应用回执后才会确认恢复。'};
  renderWorkerStatus();
  const deadline=Date.now()+8000;
  do {
    await new Promise(resolve=>setTimeout(resolve,150));
    const frame=await chrome.webNavigation.getFrame({tabId:currentTabId,frameId:0});
    if(frame?.url && new URL(frame.url).hostname!==hostKey) throw new Error('刷新后页面跳转到其他站点，请重新打开面板检查');
    if(!frame?.documentId || frame.documentId===before.documentId) continue;
    await readWorkerStatus(frame.documentId);
    const current=await chrome.webNavigation.getFrame({tabId:currentTabId,frameId:0});
    if(current?.documentId!==frame.documentId) continue;
    renderWorkerStatus();
    if(pageConnection?.state==='ready') {$('refresh-note').hidden=true;msg('页面已刷新，已收到配置应用回执');return;}
    if(pageConnection?.state==='error') throw new Error(pageConnection.detail);
  } while(Date.now()<deadline);
  throw new Error('刷新后 8 秒内未取得页面配置回执。'+(pageConnection?.detail || '请检查站点访问权限和页面控制台。'));
}

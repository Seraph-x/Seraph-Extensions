'use strict';
const FP_FIELDS=['fp-enabled','fp-seed','fp-canvas','fp-webgl','fp-audio','fp-fonts',...DEVICE_INPUTS.map(name=>'fp-'+name)];
const MANUAL_INPUTS=[['timezone','m-tz'],['locale','m-locale'],['lat','m-lat'],['lon','m-lon']];
const MANUAL_FIELDS=MANUAL_INPUTS.map(([,id])=>id);
let fpBaseline={},manualEditorPriority=null;
const manualDrafts=new Map();
const identityBaselines=new Map();
function snapshotFields(ids) {
  return Object.fromEntries(ids.map(id=>[id,$(id).type==='checkbox' ? $(id).checked : $(id).value]));
}
function restoreFields(values) {
  for(const [id,value] of Object.entries(values)) {
    if(typeof value==='boolean') $(id).checked=value;else $(id).value=value;
  }
}
function renderGlobalForms() {
  const fpDraft=fpDirty ? snapshotFields(FP_FIELDS) : null;
  $('fp-enabled').checked=settings.fp.enabled;$('fp-seed').value=settings.fp.seed;
  for(const key of ['canvas','webgl','audio','fonts']) $('fp-'+key).checked=settings.fp[key];
  renderDeviceEditor('fp',settings.fp);fpBaseline=snapshotFields(FP_FIELDS);
  $('fp-saved-summary').textContent='已保存：'+GeoMaskPanel.fingerprintSummary(settings.fp);
  if(fpDraft) {renderDeviceEditor('fp',settings.fp,fpDraft);restoreFields(fpDraft);}
  renderManualForm();updateFPDraft();
}
function updateFPDraft() {
  refreshDeviceEditor('fp');
  fpDirty=GeoMaskPanel.formChanged(snapshotFields(FP_FIELDS),fpBaseline,'fp');
  $('fp-dirty').hidden=!fpDirty;
  $('fp-state').textContent=fpDirty ? '编辑中 · 未保存' : '已保存';
  $('fp-state').className=fpDirty ? 'badge pending' : 'badge';
  $('fp-device-summary').hidden=!fpDirty;
  updateDraftSummary();
}
function manualPriorityLabel(priority) {return priority==='override' ? '最高' : '最低';}
function manualBaselineFor(priority) {
  const manual=GeoMaskConfig.manualLocationFor(settings,priority);
  return Object.fromEntries(MANUAL_INPUTS.map(([key,id])=>[id,String(manual?.[key] ?? '')]));
}
function renderManualForm() {
  manualEditorPriority ??= settings.manualPriority;
  for(const [priority,draft] of manualDrafts) {
    if(!GeoMaskPanel.formChanged(draft,manualBaselineFor(priority),'m')) manualDrafts.delete(priority);
  }
  $('m-priority').value=manualEditorPriority;
  restoreFields(manualDrafts.get(manualEditorPriority) || manualBaselineFor(manualEditorPriority));
  const saved=GeoMaskConfig.manualLocationFor(settings,manualEditorPriority);
  const fields=MANUAL_INPUTS.filter(([key])=>saved?.[key]!=null && saved[key]!=='').map(([key])=>({timezone:'时区',locale:'语言',lat:'纬度',lon:'经度'}[key]));
  $('manual-status').textContent='当前启用：'+manualPriorityLabel(settings.manualPriority)+'。正在编辑：'+manualPriorityLabel(manualEditorPriority)+'。'+
    (fields.length ? '此组已保存：'+fields.join('、') : '此组尚未保存位置，输入框提示不是配置值。');
  updateManualDraft();
}
function rememberManualDraft() {
  const draft=snapshotFields(MANUAL_FIELDS);
  if(GeoMaskPanel.formChanged(draft,manualBaselineFor(manualEditorPriority),'m')) manualDrafts.set(manualEditorPriority,draft);
  else manualDrafts.delete(manualEditorPriority);
}
function switchManualPriority() {
  rememberManualDraft();manualEditorPriority=$('m-priority').value;renderManualForm();
}
function updateManualDraft() {
  rememberManualDraft();
  manualDirty=manualDrafts.size>0 || manualEditorPriority!==settings.manualPriority;
  $('m-priority-note').textContent=$('m-priority').value==='override'
    ? '最高：全局位置 → 身份固定位置 → 本站地理结果 → 全局探测结果。'
    : '最低：身份固定位置 → 本站地理结果 → 全局位置 → 全局探测结果。本站只有 IP、没有地理结果时，也使用这里的默认位置。';
  $('manual-dirty').textContent=(manualDrafts.size ? '未保存位置：'+[...manualDrafts.keys()].map(manualPriorityLabel).join('、')+'。' : '')+
    (manualEditorPriority!==settings.manualPriority ? '当前仅查看 / 编辑，保存后才启用此组。' : '保存只影响当前组，其他组草稿保留。');
  $('manual-dirty').hidden=!manualDirty;updateDraftSummary();
}
function updateDraftSummary() {
  const settingsCount=Number(fpDirty)+Number(manualDirty);
  const identityCount=identityDrafts.size;
  for(const [id,count] of [['pending-settings',settingsCount],['pending-identities',identityCount],['pending-site',Number(siteSelectionDirty)+workerDrafts.size]]) {
    $(id).hidden=!count;$(id).textContent=String(count);
  }
  const groups=[fpDirty && '设备设置',manualDirty && '全局位置',identityCount && identityCount+' 个身份',siteSelectionDirty && '本站绑定',workerDrafts.size && workerDrafts.size+' 个站点 Worker'].filter(Boolean);
  $('pending-summary').hidden=!groups.length;
  $('pending-text').textContent=groups.length ? '未保存：'+groups.join('、') : '';
  $('jump-drafts').disabled=busy;
  $('fp-save').disabled=!fpDirty;$('fp-discard').disabled=!fpDirty;
  const currentManualDirty=manualDrafts.has(manualEditorPriority) || manualEditorPriority!==settings.manualPriority;
  $('save').disabled=!currentManualDirty;$('manual-discard').disabled=!currentManualDirty;
  $('save').textContent=manualEditorPriority===settings.manualPriority ? '保存此组位置' : '保存并启用此组';
  $('reset').disabled=!Object.keys(GeoMaskConfig.manualLocationFor(settings,manualEditorPriority) || {}).length;
}
function setupDraftControls() {
  $('fp-discard').addEventListener('click',()=>{fpDirty=false;renderSettings();msg('设备草稿已撤销，恢复已保存配置');});
  $('manual-discard').addEventListener('click',()=>{manualDrafts.delete(manualEditorPriority);manualEditorPriority=settings.manualPriority;renderManualForm();msg('此组位置草稿已撤销，其他组草稿保留');});
  $('id-discard').addEventListener('click',()=>{identityDrafts.delete(identityEditorId);renderIdentityEditor();msg('此身份草稿已撤销');});
  $('jump-drafts').addEventListener('click',()=>{
    if(fpDirty || manualDirty) {
      if(!fpDirty && manualDrafts.size && !manualDrafts.has(manualEditorPriority)) {manualEditorPriority=manualDrafts.keys().next().value;renderManualForm();}
      showView('settings');$(fpDirty ? 'fp-card' : 'manual-card').scrollIntoView({block:'start'});
    }
    else if(identityDrafts.size) {identityEditorId=identityDrafts.has(identityEditorId) ? identityEditorId : identityDrafts.keys().next().value;renderIdentities();showView('identities');$('id-editor').scrollIntoView({block:'start'});}
    else if(workerDrafts.size) {
      showView('site');$('worker-details').open=true;$('worker-details').scrollIntoView({block:'start'});
      if(workerDrafts.has(hostKey)) $('worker-mode').focus();
      else msg('其他站点仍有 Worker 草稿：'+[...workerDrafts.keys()].join('、'),'warning');
    }
    else if(siteSelectionDirty) {showView('site');$('site-binding').scrollIntoView({block:'start'});}
  });
}

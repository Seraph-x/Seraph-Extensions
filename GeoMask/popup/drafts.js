'use strict';
const FP_FIELDS=['fp-enabled','fp-seed','fp-canvas','fp-webgl','fp-audio','fp-fonts',...DEVICE_INPUTS.map(name=>'fp-'+name)];
const MANUAL_FIELDS=['m-priority','m-tz','m-locale','m-lat','m-lon'];
let fpBaseline={},manualBaseline={};
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
  const manualDraft=manualDirty ? snapshotFields(MANUAL_FIELDS) : null;
  $('fp-enabled').checked=settings.fp.enabled;$('fp-seed').value=settings.fp.seed;
  for(const key of ['canvas','webgl','audio','fonts']) $('fp-'+key).checked=settings.fp[key];
  renderDeviceEditor('fp',settings.fp);fpBaseline=snapshotFields(FP_FIELDS);
  $('fp-saved-summary').textContent='已保存：'+GeoMaskPanel.fingerprintSummary(settings.fp);
  if(fpDraft) {renderDeviceEditor('fp',settings.fp,fpDraft);restoreFields(fpDraft);}
  for(const [key,id] of [['timezone','m-tz'],['locale','m-locale'],['lat','m-lat'],['lon','m-lon']]) $(id).value=settings.manual?.[key] ?? '';
  $('m-priority').value=settings.manualPriority;
  manualBaseline=snapshotFields(MANUAL_FIELDS);
  if(manualDraft) restoreFields(manualDraft);
  updateFPDraft();updateManualDraft();
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
function updateManualDraft() {
  manualDirty=GeoMaskPanel.formChanged(snapshotFields(MANUAL_FIELDS),manualBaseline,'m');
  $('m-priority-note').textContent=$('m-priority').value==='override'
    ? '最高：全局位置 → 身份固定位置 → 本站地理结果 → 全局探测结果。'
    : '最低：身份固定位置 → 本站地理结果 → 全局位置 → 全局探测结果。本站只有 IP、没有地理结果时，也使用这里的默认位置。';
  $('manual-dirty').hidden=!manualDirty;updateDraftSummary();
}
function updateDraftSummary() {
  const settingsCount=Number(fpDirty)+Number(manualDirty);
  const identityCount=identityDrafts.size;
  for(const [id,count] of [['pending-settings',settingsCount],['pending-identities',identityCount],['pending-site',Number(siteSelectionDirty)]]) {
    $(id).hidden=!count;$(id).textContent=String(count);
  }
  const groups=[fpDirty && '设备设置',manualDirty && '全局位置',identityCount && identityCount+' 个身份',siteSelectionDirty && '本站绑定'].filter(Boolean);
  $('pending-summary').hidden=!groups.length;
  $('pending-text').textContent=groups.length ? '未保存：'+groups.join('、') : '';
  $('jump-drafts').disabled=busy;
  $('fp-save').disabled=!fpDirty;$('fp-discard').disabled=!fpDirty;
  $('save').disabled=!manualDirty;$('manual-discard').disabled=!manualDirty;
  $('reset').disabled=!Object.keys(settings?.manual || {}).length;
}
function setupDraftControls() {
  $('fp-discard').addEventListener('click',()=>{fpDirty=false;renderSettings();msg('设备草稿已撤销，恢复已保存配置');});
  $('manual-discard').addEventListener('click',()=>{manualDirty=false;renderSettings();msg('位置草稿已撤销，恢复已保存配置');});
  $('id-discard').addEventListener('click',()=>{identityDrafts.delete(identityEditorId);renderIdentityEditor();msg('此身份草稿已撤销');});
  $('jump-drafts').addEventListener('click',()=>{
    if(fpDirty || manualDirty) {showView('settings');$(fpDirty ? 'fp-card' : 'manual-card').scrollIntoView({block:'start'});}
    else if(identityDrafts.size) {identityEditorId=identityDrafts.has(identityEditorId) ? identityEditorId : identityDrafts.keys().next().value;renderIdentities();showView('identities');$('id-editor').scrollIntoView({block:'start'});}
    else if(siteSelectionDirty) {showView('site');$('site-binding').scrollIntoView({block:'start'});}
  });
}

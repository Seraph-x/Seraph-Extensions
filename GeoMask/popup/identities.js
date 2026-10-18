'use strict';
let identityEditorId=null;
const identityDrafts=new Map();
const ID_FIELDS=['id-label','id-seed','id-fp-mode','id-system','id-profile','id-ua-ch','id-ch-browser','id-ch-platform-version','id-ch-wow64','id-geo-mode','id-geo-tz','id-geo-locale','id-geo-lat','id-geo-lon'];
function collectIdentityDefinition(existing) {
  const fp=collectDeviceConfiguration('id',existing.fp);const seed=$('id-seed').value.trim();
  const enabled=$('id-fp-mode').value;
  if(enabled==='') delete fp.enabled;else fp.enabled=enabled==='on';
  if(seed) fp.seed=seed;else delete fp.seed;
  const geo={mode:$('id-geo-mode').value};
  if(geo.mode==='fixed') {
    for(const [key,id] of [['timezone','id-geo-tz'],['locale','id-geo-locale'],['lat','id-geo-lat'],['lon','id-geo-lon']]) {
      const value=$(id).value.trim();
      if($(id).validity?.badInput) throw new Error('请输入有效的定位坐标');
      if(value) geo[key]=['lat','lon'].includes(key) ? Number(value) : value;
    }
  }
  return {...existing,label:$('id-label').value.trim(),fp,geo};
}
function identityOptions(select,emptyLabel,selected) {
  select.replaceChildren();
  for(const [id,label] of [['',emptyLabel],...Object.entries(settings.identities).map(([id,item])=>[id,item.label || id])]) {
    const option=document.createElement('option');option.value=id;option.textContent=label;select.append(option);
  }
  select.value=selected || '';
}
function renderSiteBinding(binding) {
  const saved=binding.exact ? binding.id : '';
  const selected=siteSelectionDirty ? $('site-identity').value : saved;
  const chosen=selected && !Object.hasOwn(settings.identities,selected) ? saved : selected;
  identityOptions($('site-identity'),'不单独绑定 · 自动继承',chosen);
  siteSelectionDirty=!!hostKey && chosen!==saved;
  $('site-binding-source').textContent='已保存：'+binding.label+' · '+binding.source+(siteSelectionDirty ? '。当前选择尚未保存。' : '。');
  $('site-bind').disabled=!hostKey || !siteSelectionDirty;$('site-identity').disabled=!hostKey;
  $('id-unbind').disabled=!hostKey || !binding.exact;
  updateDraftSummary();
}
function renderIdentityEditor() {
  const definition=settings.identities[identityEditorId];
  $('id-del').disabled=!definition;
  $('id-editor').hidden=!definition;$('id-empty').hidden=!!definition;
  if(!definition) {$('id-state').textContent='未选择';$('id-state').className='badge';return;}
  const values={'id-label':definition.label || '','id-seed':definition.fp?.seed || '',
    'id-fp-mode':definition.fp?.enabled==null ? '' : definition.fp.enabled ? 'on' : 'off',
    'id-profile':definition.fp?.profile || '','id-ua-ch':definition.fp?.uaCH || '','id-geo-mode':definition.geo?.mode || 'auto',
    ...Object.fromEntries([['timezone','id-geo-tz'],['locale','id-geo-locale'],['lat','id-geo-lat'],['lon','id-geo-lon']].map(([key,id])=>[id,definition.geo?.[key] ?? '']))};
  renderDeviceEditor('id',definition.fp || {});
  const simpleValues=Object.fromEntries(Object.entries(values).filter(([id])=>!['id-profile','id-ua-ch'].includes(id)));
  restoreFields(simpleValues);identityBaselines.set(identityEditorId,snapshotFields(ID_FIELDS));
  const draft=identityDrafts.get(identityEditorId);
  if(draft) {renderDeviceEditor('id',definition.fp || {},draft);restoreFields(draft);}
  refreshDeviceEditor('id');
  $('id-saved-summary').textContent='已保存：'+GeoMaskPanel.fingerprintSummary({...settings.fp,...definition.fp})+(definition.fp?.enabled===false ? ' · 此身份处理已关闭' : '');
  $('id-fixed-fields').hidden=$('id-geo-mode').value!=='fixed';
  $('id-seed').placeholder='留空继承全局种子';
  rememberIdentityDraft();
}
function updateIdentityDraftStatus() {
  const dirty=identityDrafts.has(identityEditorId);
  $('id-dirty').hidden=!dirty;$('id-apply').disabled=!dirty;
  $('id-discard').disabled=!dirty;$('id-state').textContent=dirty ? '编辑中 · 未保存' : '已保存';$('id-state').className=dirty ? 'badge pending' : 'badge';
  $('id-device-summary').hidden=!dirty;
  $('id-default').disabled=settings.defaultIdentity===identityEditorId;
  $('id-default').textContent=settings.defaultIdentity===identityEditorId ? '此身份已是默认身份' : '将已保存的此身份设为默认';
  const bound=Object.values(settings.identityByDomain).filter(id=>id===identityEditorId).length;
  $('id-impact').textContent='保存修改会影响绑定此身份的 '+bound+' 个域名及其子域'+(settings.defaultIdentity===identityEditorId ? '，以及没有域名绑定的站点。' : '。');
  $('id-inheritance').textContent=($('id-profile').value ? '设备档案：身份单独指定。' : '设备档案：继承全局。')+($('id-seed').value.trim() ? ' 种子：身份单独指定。' : ' 种子：继承全局。')+' 指纹处理开关继承全局与已保存的身份差异项。';
  updateDraftSummary();
}
function renderIdentities() {
  for(const drafts of [identityDrafts,identityBaselines]) {
    for(const id of drafts.keys()) if(!Object.hasOwn(settings.identities,id)) drafts.delete(id);
  }
  if(identityEditorId===null) identityEditorId=GeoMaskPanel.bindingFor(hostKey,settings).id || '';
  if(!settings.identities[identityEditorId]) identityEditorId='';
  identityOptions($('id-current'),'选择身份进行编辑',identityEditorId);
  const defaultID=settings.defaultIdentity;
  $('default-identity').textContent=defaultID ? settings.identities[defaultID]?.label || defaultID : '未设置 · 使用全局基础设置';
  $('id-default-clear').disabled=!defaultID;
  renderIdentityEditor();renderIdentityDirectory();
}
function rememberIdentityDraft() {
  if(!settings.identities[identityEditorId]) return;
  const current=snapshotFields(ID_FIELDS);
  if(GeoMaskPanel.formChanged(current,identityBaselines.get(identityEditorId) || {},'id')) identityDrafts.set(identityEditorId,current);
  else identityDrafts.delete(identityEditorId);
  $('id-fixed-fields').hidden=$('id-geo-mode').value!=='fixed';updateIdentityDraftStatus();
}
function setupIdentityControls() {
  const action=(id,callback)=>$(id).addEventListener('click',()=>perform(callback));
  setupDeviceControls('id',()=>{});
  $('id-current').addEventListener('change',()=>{identityEditorId=$('id-current').value;renderIdentities();msg('仅切换编辑对象；本站绑定未改变，草稿会保留');});
  for(const id of ID_FIELDS) $(id).addEventListener('input',rememberIdentityDraft);
  $('site-identity').addEventListener('change',()=>{siteSelectionDirty=true;renderSiteBinding(GeoMaskPanel.bindingFor(hostKey,settings));});
  action('site-bind',async()=>{
    const map={...settings.identityByDomain};const id=$('site-identity').value;
    if(id) map[hostKey]=id;else delete map[hostKey];
    await commitSettings({...settings,identityByDomain:map},'本站身份绑定已保存，请刷新原网页',{onSaved:()=>{siteSelectionDirty=false;}});
  });
  action('id-unbind',()=>{
    const map={...settings.identityByDomain};delete map[hostKey];
    return commitSettings({...settings,identityByDomain:map},'本站绑定已解除，现继承父域 / 默认身份',{onSaved:()=>{siteSelectionDirty=false;}});
  });
  action('id-new',async()=>{
    const id='id-'+crypto.randomUUID();
    const definition={label:'身份 '+(Object.keys(settings.identities).length+1),fp:{seed:crypto.randomUUID()},geo:{mode:'auto'}};
    await commitSettings({...settings,identities:{...settings.identities,[id]:definition}},'身份已创建；需要使用时，请在本站概览绑定它',{onSaved:()=>{identityEditorId=id;}});
  });
  action('id-apply',()=>{
    const id=identityEditorId;
    const definition=collectIdentityDefinition(settings.identities[id]);
    return commitSettings({...settings,identities:{...settings.identities,[id]:definition}},'身份配置已保存，请刷新使用此身份的网页',{onSaved:()=>identityDrafts.delete(id)});
  });
  action('id-default',()=>commitSettings({...settings,defaultIdentity:identityEditorId},'默认身份已更新；编辑框中的未保存修改不会自动应用'));
  action('id-default-clear',()=>commitSettings({...settings,defaultIdentity:null},'默认身份已清除，未绑定站点使用全局基础设置'));
  $('id-random-seed').addEventListener('click',()=>{$('id-seed').value=crypto.randomUUID();rememberIdentityDraft();msg('新种子仅在编辑框中，保存身份修改后应用');});
  $('id-sync').addEventListener('click',()=>{$('id-system').value='';populateDeviceProfiles('id');refreshDeviceEditor('id');rememberIdentityDraft();msg('设备档案已改为继承，保存身份修改后应用；UA-CH 独立配置仍需匹配');});
  $('id-del').addEventListener('click',()=>openIdentityDeletion(identityEditorId));
}

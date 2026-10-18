'use strict';
let pendingIdentityDeletion=null;
let deletionReturnFocus=null,deletionReturnScroll=0;
let pendingIdentityFocus=null;
function directoryNode(tag,text,className='') {
  const node=document.createElement(tag);node.textContent=text;node.className=className;return node;
}
function directoryButton(label,action,className='mini') {
  const button=directoryNode('button',label,className);button.type='button';button.addEventListener('click',action);return button;
}
function editDirectoryIdentity(id) {
  identityEditorId=id;renderIdentities();
  focusIdentityEditor();
  msg('正在编辑已选择的身份；域名绑定未改变。');
}
function focusIdentityEditor(selectName=false) {
  if(busy) {pendingIdentityFocus=selectName;return;}
  $('identity-editor-card').scrollIntoView({block:'start'});
  const field=$(selectName ? 'id-label' : 'id-current');field.focus({preventScroll:true});
  if(selectName) {field.scrollIntoView({block:'center'});field.select();}
}
function applyPendingIdentityFocus() {
  if(pendingIdentityFocus===null) return;
  const selectName=pendingIdentityFocus;pendingIdentityFocus=null;focusIdentityEditor(selectName);
}
function renderIdentityDirectory() {
  const query=$('identity-directory-filter').value;
  const view=GeoMaskPanel.directoryView(settings,query);
  const {identities:entries,bindings}=view;
  const current=hostKey ? GeoMaskPanel.bindingFor(hostKey,settings).id : null;
  $('identity-directory-summary').textContent=(query.trim() ? '显示 '+entries.length+'/'+view.identityTotal+' 个身份 · '+bindings.length+'/'+view.bindingTotal+' 个域名绑定' : view.identityTotal+' 个身份 · '+view.bindingTotal+' 个显式域名绑定');
  $('binding-count').textContent=(query.trim() ? bindings.length+'/'+view.bindingTotal : view.bindingTotal)+' 个';
  $('identity-directory-jump').title=view.identityTotal+' 个身份，'+view.bindingTotal+' 个显式域名绑定';
  $('identity-list').replaceChildren();$('domain-binding-list').replaceChildren();
  if(!entries.length) $('identity-list').append(directoryNode('li',view.identityTotal ? '没有匹配的身份；清空筛选可查看全部。' : '还没有身份，点击页面顶部“新建身份”开始。','hint'));
  for(const usage of entries) {
    const id=usage.id,row=directoryNode('li','','directory-entry');row.dataset.identity=id;
    const heading=directoryNode('div','','directory-heading');heading.append(directoryNode('strong',usage.label));
    if(usage.isDefault) heading.append(directoryNode('span','默认','badge'));
    if(current===id) heading.append(directoryNode('span','本站配置','badge good'));
    if(identityEditorId===id) heading.append(directoryNode('span','正在编辑','badge'));
    row.append(heading,directoryNode('p',usage.domains.length ? '显式绑定 '+usage.domains.length+' 个：'+usage.domains.join(' · ') : '没有显式域名绑定','directory-domains'));
    if(usage.isDefault) row.append(directoryNode('p','无匹配域名绑定的网站会使用此默认身份。','hint'));
    const actions=directoryNode('div','','btns');
    actions.append(directoryButton('编辑',()=>editDirectoryIdentity(id)),directoryButton('删除身份',event=>openIdentityDeletion(id,event.currentTarget),'mini danger'));
    row.append(actions);$('identity-list').append(row);
  }
  if(!bindings.length) $('domain-binding-list').append(directoryNode('li',view.bindingTotal ? '没有匹配的域名绑定；清空筛选可查看全部。' : '尚无显式域名绑定；网站使用默认身份或全局基础设置。','hint'));
  for(const {domain,id,label} of bindings) {
    const row=directoryNode('li','','directory-entry');row.dataset.domain=domain;
    row.append(directoryNode('strong',domain),directoryNode('p','→ '+label,'directory-domains'));
    const next=GeoMaskPanel.bindingFor(domain,GeoMaskPanel.withoutDomainBinding(settings,domain));
    row.append(directoryNode('p','解除后：'+next.label+' · '+next.source,'hint'));
    const actions=directoryNode('div','','btns');
    actions.append(directoryButton('查看身份',()=>editDirectoryIdentity(id)),directoryButton('解除绑定',()=>perform(()=>removeDirectoryBinding(domain))));
    row.append(actions);$('domain-binding-list').append(row);
  }
  if(pendingIdentityDeletion && !Object.hasOwn(settings.identities,pendingIdentityDeletion)) pendingIdentityDeletion=null;
  renderIdentityDeletion();
}
function openIdentityDeletion(id,trigger=null) {
  GeoMaskPanel.identityUsage(settings,id);
  deletionReturnFocus=trigger;deletionReturnScroll=document.querySelector('main').scrollTop;
  pendingIdentityDeletion=id;renderIdentityDeletion();
  $('identity-delete-panel').scrollIntoView({block:'start'});$('identity-delete-cancel').focus({preventScroll:true});
  msg('请核对删除范围；尚未更改配置。');
}
function renderIdentityDeletion() {
  $('identity-delete-panel').hidden=!pendingIdentityDeletion;
  if(!pendingIdentityDeletion) return;
  const usage=GeoMaskPanel.identityUsage(settings,pendingIdentityDeletion);
  $('identity-delete-name').textContent='删除身份：'+usage.label;
  $('identity-delete-impact').textContent='将删除此身份配置及其 '+usage.domains.length+' 个显式域名绑定。'+
    (usage.isDefault ? '同时清除默认身份；没有其他域名绑定的网站将使用全局基础设置。' : '受影响网站将继承剩余父域绑定或默认身份。')+
    (identityDrafts.has(usage.id) ? ' 此身份的未保存草稿也会删除。' : '')+
    (siteSelectionDirty && $('site-identity').value===usage.id ? ' 指向此身份的本站绑定草稿也会清除。' : '')+' 不会删除 Cookie 或退出网站账号。';
  $('identity-delete-domains').replaceChildren();
  for(const domain of usage.domains) $('identity-delete-domains').append(directoryNode('li',domain));
}
async function removeDirectoryBinding(domain) {
  const next=GeoMaskPanel.withoutDomainBinding(settings,domain);
  const inherited=GeoMaskPanel.bindingFor(domain,next);
  await commitSettings(next,'已解除 '+domain+'；现使用 '+inherited.label+'（'+inherited.source+'）',{onSaved:()=>{if(hostKey===domain) siteSelectionDirty=false;}});
}
async function confirmIdentityDeletion() {
  const id=pendingIdentityDeletion;
  if(!id) throw new Error('请先选择要删除的身份');
  const next=GeoMaskPanel.withoutIdentity(settings,id);
  const removedDraft=siteSelectionDirty && $('site-identity').value===id;
  await commitSettings(next,'身份及其域名绑定已删除'+(removedDraft ? '；该身份的本站绑定草稿已清除' : ''),{onSaved:()=>{
    identityDrafts.delete(id);identityBaselines.delete(id);pendingIdentityDeletion=null;deletionReturnFocus=null;
    if(identityEditorId===id) identityEditorId='';
    if(removedDraft) siteSelectionDirty=false;
  }});
}
function setupIdentityDirectory() {
  $('identity-directory-filter').addEventListener('input',renderIdentityDirectory);
  $('identity-directory-jump').addEventListener('click',()=>{$('identity-directory').scrollIntoView({block:'start'});$('identity-directory-filter').focus({preventScroll:true});});
  $('identity-editor-jump').addEventListener('click',()=>focusIdentityEditor());
  $('identity-delete-confirm').addEventListener('click',()=>perform(confirmIdentityDeletion));
  $('identity-delete-cancel').addEventListener('click',()=>{
    pendingIdentityDeletion=null;renderIdentityDeletion();
    document.querySelector('main').scrollTo(0,deletionReturnScroll);
    (deletionReturnFocus?.isConnected ? deletionReturnFocus : $('id-current')).focus({preventScroll:true});
    deletionReturnFocus=null;msg('已取消删除，配置未改变。');
  });
}

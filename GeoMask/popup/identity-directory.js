'use strict';
let pendingIdentityDeletion=null;
function directoryNode(tag,text,className='') {
  const node=document.createElement(tag);node.textContent=text;node.className=className;return node;
}
function directoryButton(label,action,className='mini') {
  const button=directoryNode('button',label,className);button.type='button';button.addEventListener('click',action);return button;
}
function editDirectoryIdentity(id) {
  identityEditorId=id;renderIdentities();
  $('identity-editor-card').scrollIntoView({block:'start'});$('id-current').focus({preventScroll:true});
  msg('正在编辑已选择的身份；域名绑定未改变。');
}
function renderIdentityDirectory() {
  const entries=Object.entries(settings.identities).sort(([a,left],[b,right])=>(left.label || a).localeCompare(right.label || b,'zh-CN') || a.localeCompare(b));
  const bindings=Object.entries(settings.identityByDomain).sort(([a],[b])=>a.localeCompare(b));
  const current=hostKey ? GeoMaskPanel.bindingFor(hostKey,settings).id : null;
  $('identity-directory-summary').textContent=entries.length+' 个身份 · '+bindings.length+' 个显式域名绑定';
  $('binding-count').textContent=bindings.length+' 个';
  $('identity-list').replaceChildren();$('domain-binding-list').replaceChildren();
  if(!entries.length) $('identity-list').append(directoryNode('li','还没有身份，点击“新建身份”开始。','hint'));
  for(const [id] of entries) {
    const usage=GeoMaskPanel.identityUsage(settings,id),row=directoryNode('li','','directory-entry');row.dataset.identity=id;
    const heading=directoryNode('div','','directory-heading');heading.append(directoryNode('strong',usage.label));
    if(usage.isDefault) heading.append(directoryNode('span','默认','badge'));
    if(current===id) heading.append(directoryNode('span','本站生效','badge good'));
    if(identityEditorId===id) heading.append(directoryNode('span','正在编辑','badge'));
    row.append(heading,directoryNode('p',usage.domains.length ? '显式绑定 '+usage.domains.length+' 个：'+usage.domains.join(' · ') : '没有显式域名绑定','directory-domains'));
    if(usage.isDefault) row.append(directoryNode('p','无匹配域名绑定的网站会使用此默认身份。','hint'));
    const actions=directoryNode('div','','btns');
    actions.append(directoryButton('编辑',()=>editDirectoryIdentity(id)),directoryButton('删除身份',()=>openIdentityDeletion(id),'mini danger'));
    row.append(actions);$('identity-list').append(row);
  }
  if(!bindings.length) $('domain-binding-list').append(directoryNode('li','尚无显式域名绑定；网站使用默认身份或全局基础设置。','hint'));
  for(const [domain,id] of bindings) {
    const row=directoryNode('li','','directory-entry');row.dataset.domain=domain;
    row.append(directoryNode('strong',domain),directoryNode('p','→ '+(settings.identities[id]?.label || id),'directory-domains'));
    const next=GeoMaskPanel.bindingFor(domain,GeoMaskPanel.withoutDomainBinding(settings,domain));
    row.append(directoryNode('p','解除后：'+next.label+' · '+next.source,'hint'));
    const actions=directoryNode('div','','btns');
    actions.append(directoryButton('查看身份',()=>editDirectoryIdentity(id)),directoryButton('解除绑定',()=>perform(()=>removeDirectoryBinding(domain))));
    row.append(actions);$('domain-binding-list').append(row);
  }
  if(pendingIdentityDeletion && !Object.hasOwn(settings.identities,pendingIdentityDeletion)) pendingIdentityDeletion=null;
  renderIdentityDeletion();
}
function openIdentityDeletion(id) {
  GeoMaskPanel.identityUsage(settings,id);
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
    identityDrafts.delete(id);identityBaselines.delete(id);pendingIdentityDeletion=null;
    if(identityEditorId===id) identityEditorId='';
    if(removedDraft) siteSelectionDirty=false;
  }});
}
function setupIdentityDirectory() {
  $('identity-delete-confirm').addEventListener('click',()=>perform(confirmIdentityDeletion));
  $('identity-delete-cancel').addEventListener('click',()=>{
    pendingIdentityDeletion=null;renderIdentityDeletion();$('id-current').focus({preventScroll:true});msg('已取消删除，配置未改变。');
  });
}

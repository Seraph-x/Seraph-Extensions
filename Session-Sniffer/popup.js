// popup.js
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let snapshot = { url: '', origin: '', cookies: [], localStorage: {}, sessionStorage: {}, documentCookie: '' };
let allCookies = null;   // 全库扫描结果；null = 只看当前页

function setStatus(t) { $('#status').textContent = t; }

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// ---- 渲染 -----------------------------------------------------------------
function renderCookies(cookies) {
  const tbody = $('#cookie-table tbody');
  tbody.innerHTML = '';
  $('#c-count').textContent = cookies.length;
  const empty = $('#cookie-empty');
  if (!cookies.length) { empty.classList.add('show'); return; }
  empty.classList.remove('show');

  for (const c of cookies) {
    const flags = [
      c.httpOnly ? 'HttpOnly' : null,
      c.secure ? 'Secure' : null,
      c.sameSite && c.sameSite !== 'unspecified' ? 'SameSite=' + c.sameSite : null,
      c.partitionKey ? 'Partitioned(' + JSON.stringify(c.partitionKey) + ')' : null,
      c.session ? 'Session'
        : (c.expirationDate
            ? 'Exp=' + new Date(c.expirationDate * 1000).toISOString().slice(5, 16).replace('T', ' ')
            : null)
    ].filter(Boolean).join(' ');
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + esc(c.name) + '</td>' +
      '<td class="v">' + esc(c.value) + '</td>' +
      '<td class="dm">' + esc(c.domain) + (c.path && c.path !== '/' ? ' ' + esc(c.path) : '') + '</td>' +
      '<td>' + esc(flags) + '</td>';
    tbody.appendChild(tr);
  }
}

function renderKv(paneSel, obj) {
  const pane = $(paneSel);
  const tbody = pane.querySelector('tbody');
  const empty = pane.querySelector('.empty');
  tbody.innerHTML = '';
  const keys = Object.keys(obj || {});
  if (!keys.length) { empty.classList.add('show'); return; }
  empty.classList.remove('show');
  for (const k of keys) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + esc(k) + '</td><td class="v">' + esc(obj[k]) + '</td>';
    tbody.appendChild(tr);
  }
}

function visibleCookies() {
  const src = allCookies || snapshot.cookies;
  const q = ($('#filter').value || '').trim().toLowerCase();
  const onlyPart = $('#onlypartition').checked;
  const list = src.filter(c => {
    if (onlyPart && !c.partitionKey) return false;
    if (!q) return true;
    return (c.name + ' ' + c.domain + ' ' + c.path + ' ' + c.value).toLowerCase().includes(q);
  });
  return applySort(list);
}

function renderAll() {
  $('#origin').textContent = (allCookies ? '[全库 ' + allCookies.length + ' 条] ' : '') +
    (snapshot.origin || snapshot.url || '—');
  renderCookies(visibleCookies());
  renderKv('#pane-local', snapshot.localStorage);
  renderKv('#pane-session', snapshot.sessionStorage);
  $('#l-count').textContent = Object.keys(snapshot.localStorage || {}).length;
  $('#s-count').textContent = Object.keys(snapshot.sessionStorage || {}).length;
  $('#raw-out').textContent = JSON.stringify({
    url: snapshot.url,
    origin: snapshot.origin,
    cookies: snapshot.cookies,
    localStorage: snapshot.localStorage,
    sessionStorage: snapshot.sessionStorage,
    documentCookie: snapshot.documentCookie
  }, null, 2);
}

// ---- 采集 -----------------------------------------------------------------
async function collect() {
  setStatus('采集中…');
  const tab = await activeTab();
  if (!tab || !tab.url) { setStatus('无法获取当前标签页'); return; }

  snapshot = {
    url: tab.url,
    origin: (() => { try { return new URL(tab.url).origin; } catch { return ''; } })(),
    cookies: [],
    localStorage: {},
    sessionStorage: {},
    documentCookie: ''
  };

  const cRes = await chrome.runtime.sendMessage({ type: 'GET_COOKIES', url: tab.url });
  if (cRes && cRes.ok) snapshot.cookies = cRes.cookies;
  else setStatus('Cookie 读取失败: ' + (cRes && cRes.error));

  try {
    const sRes = await chrome.runtime.sendMessage({ type: 'GET_STORAGE', tabId: tab.id });
    if (sRes && sRes.ok && sRes.data) {
      snapshot.localStorage = sRes.data.localStorage || {};
      snapshot.sessionStorage = sRes.data.sessionStorage || {};
      snapshot.documentCookie = sRes.data.documentCookie || '';
    }
  } catch (e) {
    setStatus('Storage 注入失败（可能是 chrome:// 或受限页面）');
  }

  renderAll();
  setStatus('完成 · ' + snapshot.cookies.length + ' cookies, ' +
    Object.keys(snapshot.localStorage).length + ' local, ' +
    Object.keys(snapshot.sessionStorage).length + ' session');
}

// ---- 导出 -----------------------------------------------------------------
function payload() {
  return {
    capturedAt: new Date().toISOString(),
    url: snapshot.url,
    origin: snapshot.origin,
    cookies: snapshot.cookies,
    localStorage: snapshot.localStorage,
    sessionStorage: snapshot.sessionStorage,
    documentCookie: snapshot.documentCookie
  };
}

function fileName() {
  let host = 'page';
  try { host = new URL(snapshot.url).hostname; } catch {}
  return 'session_' + host + '_' + Date.now() + '.json';
}

// ---- 事件 -----------------------------------------------------------------
$$('.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tabs button').forEach(b => b.classList.remove('active'));
    $$('.pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('#pane-' + btn.dataset.tab).classList.add('active');
  });
});

$('#refresh').addEventListener('click', () => { allCookies = null; collect(); });

$('#filter').addEventListener('input', () => renderAll());
$('#onlypartition').addEventListener('change', () => renderAll());
$('#sortmode').addEventListener('change', () => renderAll());
['#targeturl', '#topsite', '#method', '#topnav'].forEach(sel => {
  const el = $(sel);
  el.addEventListener('input', () => renderAll());
  el.addEventListener('change', () => renderAll());
});

$('#scanall').addEventListener('click', async () => {
  setStatus('全库枚举中…');
  const res = await chrome.runtime.sendMessage({ type: 'GET_ALL_COOKIES', filter: {} });
  if (!res || !res.ok) { setStatus('全库枚举失败: ' + (res && res.error)); return; }
  allCookies = res.cookies.sort((a, b) =>
    (a.domain + a.path + a.name).localeCompare(b.domain + b.path + b.name));
  renderAll();
  const part = allCookies.filter(c => c.partitionKey).length;
  setStatus('全库 ' + allCookies.length + ' 条，其中 Partitioned ' + part + ' 条');
});

// ---- RFC 6265 发送过滤：算出「浏览器这次真的会发出去的 cookie」 ---------------
// DevTools 复制的是这一步的【输出】，扩展默认 dump 的是这一步的【输入】。
// 差别就在下面这几个 if 上。

function pathMatch(requestPath, cookiePath) {
  if (!cookiePath) cookiePath = '/';
  if (requestPath === cookiePath) return true;
  if (requestPath.startsWith(cookiePath)) {
    if (cookiePath.endsWith('/')) return true;
    if (requestPath[cookiePath.length] === '/') return true;
  }
  return false;
}

function domainMatch(host, cookieDomain) {
  if (!cookieDomain) return false;
  const d = cookieDomain.replace(/^\./, '');
  if (host === d) return true;                       // host-only cookie
  return host.endsWith('.' + d);                     // domain cookie
}

// ---- 可注册域（eTLD+1）近似：判断两个 URL 是否 same-site -------------------
// 完整实现要 Public Suffix List，这里用常用多段后缀表覆盖绝大多数情况。
const MULTI_SUFFIX = new Set([
  'co.uk','org.uk','ac.uk','gov.uk','me.uk','net.uk','sch.uk',
  'com.cn','net.cn','org.cn','gov.cn','edu.cn','ac.cn','bj.cn','sh.cn',
  'co.jp','ne.jp','or.jp','ac.jp','go.jp','com.au','net.au','org.au','edu.au','gov.au',
  'com.br','com.tw','com.hk','com.sg','com.mx','com.ar','com.tr','com.my','com.ph',
  'co.kr','or.kr','co.in','net.in','org.in','co.nz','co.za','co.il',
  'github.io','gitlab.io','vercel.app','netlify.app','pages.dev','herokuapp.com',
  'appspot.com','blogspot.com','firebaseapp.com','web.app','azurewebsites.net',
  'workers.dev','onrender.com','glitch.me','repl.co','now.sh','surge.sh','fly.dev',
  's3.amazonaws.com','cloudfront.net','elasticbeanstalk.com','wordpress.com','tumblr.com'
]);

function registrableDomain(host) {
  if (!host) return '';
  const h = String(host).toLowerCase().replace(/^\[|\]$/g, '').replace(/:\d+$/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return h;          // IPv4
  if (h.includes(':')) return h;                                // IPv6
  const parts = h.split('.');
  if (parts.length <= 2) return h;
  const last2 = parts.slice(-2).join('.');
  if (MULTI_SUFFIX.has(last2)) return parts.slice(-3).join('.');
  return last2;
}

function isSameSite(urlA, urlB) {
  try {
    const a = registrableDomain(new URL(urlA).hostname);
    const b = registrableDomain(new URL(urlB).hostname);
    return !!a && a === b;
  } catch { return false; }
}

// Chrome 对未声明 SameSite 的 cookie 默认按 Lax 处理
function effectiveSameSite(c) {
  const ss = c.sameSite && c.sameSite !== 'unspecified' ? c.sameSite : 'Lax';
  return ss;
}

// SameSite 是否放行
//  None   : 总是放行（但必须 Secure，前面已校验）
//  Lax    : 同站放行；跨站仅「顶层导航 + 安全方法(GET/HEAD)」放行
//  Strict : 仅同站放行
function sameSiteAllows(c, targetUrl, topLevelSite, method, isTopLevelNav) {
  const ss = effectiveSameSite(c);
  if (ss === 'None') return true;
  if (isSameSite(targetUrl, topLevelSite)) return true;
  if (ss === 'Lax') {
    const safe = method === 'GET' || method === 'HEAD';
    return !!isTopLevelNav && safe;
  }
  return false;   // Strict 跨站一律不发
}

// ---- 只做过滤，不改顺序 -----------------------------------------------------
// opts = { url, topLevelSite, method, isTopLevelNav }
// url          目标请求的 URL（决定 domain / path / secure）
// topLevelSite 发起请求的顶层页面 URL（决定 same-site 与 partition key）
// method       HTTP 方法（SameSite=Lax 只对 GET/HEAD 放行）
// isTopLevelNav 是否为顶层导航（地址栏跳转 / 表单提交）
function filterSent(cookies, url, topLevelSite, method, isTopLevelNav) {
  let u;
  try { u = new URL(url); } catch { return cookies.slice(); }
  const isHttps = u.protocol === 'https:';
  const now = Date.now() / 1000;
  const m = (method || 'GET').toUpperCase();

  return cookies.filter(c => {
    // 1) Secure：非 HTTPS 不发
    if (c.secure && !isHttps) return false;

    // 2) 过期不发
    if (c.expirationDate && c.expirationDate < now) return false;

    // 3) Domain 作用域
    if (!domainMatch(u.hostname, c.domain)) return false;

    // 4) Path 作用域
    if (!pathMatch(u.pathname || '/', c.path)) return false;

    // 5) SameSite
    if (topLevelSite && !sameSiteAllows(c, url, topLevelSite, m, isTopLevelNav)) return false;

    // 6) Partition key（CHIPS）：顶层站点对不上就不发
    if (c.partitionKey && c.partitionKey.topLevelSite) {
      if (topLevelSite) {
        const top = registrableDomain(new URL(topLevelSite).hostname);
        const key = registrableDomain(new URL(c.partitionKey.topLevelSite).hostname);
        if (top !== key) return false;
      } else {
        return false;
      }
    }

    // 7) __Host- / __Secure- 前缀约束
    if (c.name.startsWith('__Host-')) {
      if (!c.secure || c.path !== '/' || c.domain.startsWith('.')) return false;
    }
    if (c.name.startsWith('__Secure-') && !c.secure) return false;

    return true;
  });
}

// ---- 排序策略：这三套顺序出来的结果完全不同 --------------------------------
// rfc  : RFC 6265 §5.4 发送顺序 —— path 长的在前，同长按 domain 长的在前
//        浏览器和 DevTools 复制的就是这一套
// name : 按 domain + name 字典序 —— 人类阅读友好，但和浏览器发的顺序不一样
// raw  : 保持 chrome.cookies 返回的原始顺序
function sortRfc6265(list) {
  return list.slice().sort((a, b) => {
    const pa = (a.path || '/').length, pb = (b.path || '/').length;
    if (pa !== pb) return pb - pa;
    return (b.domain || '').length - (a.domain || '').length;
  });
}

function sortByName(list) {
  return list.slice().sort((a, b) =>
    (a.domain + '|' + a.name).localeCompare(b.domain + '|' + b.name));
}

function applySort(list) {
  const mode = ($('#sortmode') && $('#sortmode').value) || 'rfc';
  if (mode === 'name') return sortByName(list);
  if (mode === 'raw') return list.slice();
  return sortRfc6265(list);
}

// 从 UI 读取目标上下文；targeturl 留空则用当前标签页
function requestContext() {
  const target = ($('#targeturl').value || '').trim() || snapshot.url;
  const top = ($('#topsite').value || '').trim() ||
              (snapshot.url ? (() => { try { return new URL(snapshot.url).origin; } catch { return ''; } })() : '');
  return {
    url: target,
    topLevelSite: top,
    method: ($('#method').value || 'GET'),
    isTopLevelNav: $('#topnav').checked
  };
}

// 兼容旧调用
function sentCookies(cookies, url, topLevelSite) {
  return sortRfc6265(filterSent(cookies, url, topLevelSite, 'GET', true));
}

// ---- 序列化：拼成浏览器/DevTools 里那种单行 Cookie 头 ----------------------
// 关键：chrome.cookies 返回的是结构化数组，DevTools 复制的是 HTTP 头字符串。
// 同一份数据，两种形态。转换规则就是 `name=value; ` 依次拼接。
function cookieHeader(cookies) {
  return cookies
    .map(c => c.name + '=' + c.value)
    .join('; ');
}

// Netscape cookie.txt 格式（curl --cookie-jar / wget / python http.cookiejar 通用）
function netscapeJar(cookies) {
  const lines = ['# Netscape HTTP Cookie File', '# Generated by Session Sniffer', ''];
  for (const c of cookies) {
    const domain = c.domain;
    const includeSub = domain.startsWith('.') ? 'TRUE' : 'FALSE';
    const secure = c.secure ? 'TRUE' : 'FALSE';
    const expires = c.expirationDate ? Math.floor(c.expirationDate) : 0;
    lines.push([domain, includeSub, c.path, secure, expires, c.name, c.value].join('\t'));
  }
  return lines.join('\n') + '\n';
}

// SAPISIDHASH —— Google 系内部 API 用 cookie 直接换 Authorization 头
// Authorization: SAPISIDHASH <ts>_<sha1(ts + " " + SAPISID + " " + origin)>
async function sapisidHash(cookies, origin) {
  const sapisid = (cookies.find(c => c.name === 'SAPISID') ||
                   cookies.find(c => c.name === '__Secure-1PAPISID') ||
                   cookies.find(c => c.name === '__Secure-3PAPISID') || {}).value;
  if (!sapisid) return null;
  const ts = Math.floor(Date.now() / 1000);
  const buf = await crypto.subtle.digest('SHA-1',
    new TextEncoder().encode(ts + ' ' + sapisid + ' ' + origin));
  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return 'SAPISIDHASH ' + ts + '_' + hex;
}

$('#copyheader').addEventListener('click', async () => {
  const src = allCookies || snapshot.cookies;
  const useFiltered = $('#onlysent').checked;
  const ctx = requestContext();
  const set = applySort(useFiltered ? filterSent(src, ctx.url, ctx.topLevelSite, ctx.method, ctx.isTopLevelNav) : src);
  await navigator.clipboard.writeText(cookieHeader(set));
  setStatus('已复制 ' + set.length + '/' + src.length + ' 条 · 目标=' +
    (() => { try { return new URL(ctx.url).host + new URL(ctx.url).pathname; } catch { return '—'; } })() +
    ' · ' + ctx.method + (ctx.isTopLevelNav ? ' 顶层导航' : ' 子请求') +
    (useFiltered ? ' · 已过滤' : ' · 全量'));
});

$('#copynetscape').addEventListener('click', async () => {
  await navigator.clipboard.writeText(netscapeJar(snapshot.cookies));
  setStatus('已复制 Netscape cookie.txt');
});

$('#copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(JSON.stringify(payload(), null, 2));
  setStatus('已复制到剪贴板');
});

$('#export').addEventListener('click', async () => {
  const blob = new Blob([JSON.stringify(payload(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({ url, filename: fileName(), saveAs: true });
  setStatus('已导出 ' + fileName());
});

$('#save').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'SAVE_SNAPSHOT', data: payload() });
  setStatus('快照已保存到扩展本地存储');
});

// ---- 主题：跟随系统 / 浅色 / 深色 -----------------------------------------
const THEME_KEY = 'sniffer.theme';
const THEME_CYCLE = ['auto', 'light', 'dark'];
const THEME_ICON = { auto: '◐', light: '☀', dark: '☾' };
const THEME_TITLE = { auto: '主题：跟随系统', light: '主题：浅色', dark: '主题：深色' };

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'auto';
}

function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  const btn = $('#theme');
  if (btn) {
    btn.textContent = THEME_ICON[mode] || THEME_ICON.auto;
    btn.title = THEME_TITLE[mode] || THEME_TITLE.auto;
  }
}

async function initTheme() {
  let mode = 'auto';
  try {
    const res = await chrome.storage.local.get(THEME_KEY);
    const saved = res && res[THEME_KEY];
    if (THEME_CYCLE.indexOf(saved) >= 0) mode = saved;
  } catch (e) { /* storage 不可用时退回跟随系统 */ }
  applyTheme(mode);

  const btn = $('#theme');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(currentTheme()) + 1) % THEME_CYCLE.length];
    applyTheme(next);
    try { await chrome.storage.local.set({ [THEME_KEY]: next }); } catch (e) {}
  });
}

initTheme();

document.addEventListener('DOMContentLoaded', collect);
collect();

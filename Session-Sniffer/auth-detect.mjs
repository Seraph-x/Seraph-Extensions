// auth-detect.mjs — 从采集结果里挑出「登录态 cookie」
//
// CLI:
//   node auth-detect.mjs list      dump.json          # 按打分列出最可能是登录态的 cookie
//   node auth-detect.mjs curl      dump.json [url]    # 输出可直接跑的 curl 命令
//   node auth-detect.mjs header    dump.json          # 输出单行 Cookie 头
//   node auth-detect.mjs puppeteer dump.json          # 输出 page.setCookie() 能吃的 JSON
//   node auth-detect.mjs diff      before.json after.json
//
// 库用法（ESM）:
//   import { pickAuthCookies, toCurl, diff } from './auth-detect.mjs'

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// 常见登录态 cookie 名称特征
const AUTH_PATTERNS = [
  /^session/i, /^sess/i, /^sid$/i, /^jsessionid$/i, /^phpsessid$/i, /^asp\.net_sessionid$/i,
  /^connect\.sid$/i, /^laravel_session$/i, /^ci_session$/i, /^rack\.session$/i,
  /token/i, /^auth/i, /^access_token$/i, /^refresh_token$/i, /^id_token$/i,
  /^jwt$/i, /^bearer/i, /^remember/i, /^login/i, /^uid$/i, /^user_?id$/i,
  /^csrftoken$/i, /^xsrf/i, /^_gh_sess$/i, /^c_user$/i, /^xs$/i,   // GitHub / Facebook
  /^SID$/i, /^HSID$/i, /^SSID$/i, /^APISID$/i, /^SAPISID$/i,        // Google
  /^wp-settings/i, /^wordpress_/i, /^comment_author/i,
];

// 明确不是登录态的
const NOISE = /^(_ga|_gid|_gat|_fbp|_gcl|__utm|_hj|amplitude|mp_|intercom|optimizely|_pk_)/i;

export function pickAuthCookies(cookies) {
  const hits = [];
  for (const c of cookies) {
    if (NOISE.test(c.name)) continue;
    let score = 0;
    const reasons = [];

    if (AUTH_PATTERNS.some(re => re.test(c.name))) { score += 3; reasons.push('名称匹配'); }
    if (c.httpOnly) { score += 4; reasons.push('HttpOnly'); }        // 登录态几乎必 HttpOnly
    if (c.secure) { score += 1; reasons.push('Secure'); }
    if (c.value && c.value.length >= 20) { score += 2; reasons.push('值较长(' + c.value.length + ')'); }
    if (c.value && /^[A-Za-z0-9_\-\.]{20,}$/.test(c.value)) { score += 2; reasons.push('形似 token'); }
    if (c.session) { score += 1; reasons.push('会话级'); }
    if (!c.expirationDate) { score += 1; reasons.push('无过期'); }

    if (score >= 4) hits.push({ ...c, _score: score, _reasons: reasons });
  }
  return hits.sort((a, b) => b._score - a._score);
}

// 生成 curl 重放命令 —— 验证「拿着这串 cookie 是否等于已登录」
export function toCurl(authCookies, url) {
  const jar = authCookies.map(c => c.name + '=' + c.value).join('; ');
  return 'curl -s -i ' + JSON.stringify(url) + ' \\\n' +
         '  -H ' + JSON.stringify('Cookie: ' + jar) + ' \\\n' +
         '  -H ' + JSON.stringify('User-Agent: Mozilla/5.0') + ' \\\n' +
         '  -H ' + JSON.stringify('Accept: text/html,application/json');
}

// 单行 Cookie 头
export function toHeader(cookies) {
  return cookies.map(c => c.name + '=' + c.value).join('; ');
}

// 生成 Cookie-Editor / Puppeteer 回灌用的 JSON
export function toPuppeteerSetCookie(cookies) {
  return cookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    secure: !!c.secure,
    httpOnly: !!c.httpOnly,
    sameSite: c.sameSite === 'unspecified' ? 'Lax' : c.sameSite,
    ...(c.expirationDate ? { expires: c.expirationDate } : {})
  }));
}

// 差分法：登出采一份 before、登录采一份 after，新增/变化的就是登录态
export function diff(before, after) {
  const b = new Map(before.map(c => [c.domain + c.path + c.name, c.value]));
  return after.filter(c => {
    const k = c.domain + c.path + c.name;
    return !b.has(k) || b.get(k) !== c.value;
  });
}

// ---- CLI ------------------------------------------------------------------
function load(p) {
  const j = JSON.parse(readFileSync(p, 'utf8'));
  return { meta: j, cookies: j.cookies || j };
}

const trunc = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : (s || ''));
const pad = (s, n) => String(s).padEnd(n);

function cmdList(file) {
  const { cookies } = load(file);
  const hits = pickAuthCookies(cookies);
  if (!hits.length) return console.log('没有评分 ≥ 4 的 cookie（共 ' + cookies.length + ' 条）');
  console.log('共 ' + cookies.length + ' 条，候选 ' + hits.length + ' 条（评分 ≥ 4，按分数降序）\n');
  console.log(pad('score', 6) + pad('name', 26) + pad('domain', 24) + 'reasons');
  console.log('-'.repeat(96));
  for (const c of hits) {
    console.log(pad(c._score, 6) + pad(trunc(c.name, 25), 26) + pad(trunc(c.domain, 23), 24) +
      c._reasons.join(' + ') + '   value=' + trunc(c.value, 18));
  }
}

function cmdCurl(file, url) {
  const { meta, cookies } = load(file);
  const hits = pickAuthCookies(cookies);
  const target = url || meta.url || 'https://example.com/';
  console.log(toCurl(hits.length ? hits : cookies, target));
  console.log('\n# 候选 ' + hits.length + ' 条 / 全部 ' + cookies.length + ' 条');
}

function cmdHeader(file) {
  const { cookies } = load(file);
  const hits = pickAuthCookies(cookies);
  console.log(toHeader(hits.length ? hits : cookies));
}

function cmdPuppeteer(file) {
  const { cookies } = load(file);
  console.log(JSON.stringify(toPuppeteerSetCookie(cookies), null, 2));
}

function cmdDiff(a, b) {
  const before = load(a).cookies;
  const after = load(b).cookies;
  const changed = diff(before, after);
  const gone = diff(after, before);
  console.log('before ' + before.length + ' 条 → after ' + after.length + ' 条\n');
  console.log('新增 / 值变化（' + changed.length + ' 条）:');
  for (const c of changed) {
    console.log('  + ' + pad(trunc(c.name, 28), 30) + pad(c.domain, 22) + 'value=' + trunc(c.value, 24));
  }
  if (gone.length) {
    console.log('\n只在 before 里出现（' + gone.length + ' 条）:');
    for (const c of gone) console.log('  - ' + pad(trunc(c.name, 28), 30) + c.domain);
  }
  if (changed.length) {
    console.log('\n最可能是登录钥匙: ' + changed
      .sort((x, y) => (y.httpOnly ? 1 : 0) - (x.httpOnly ? 1 : 0))
      .slice(0, 3).map(c => c.name).join(', '));
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [cmd, ...rest] = process.argv.slice(2);
  const usage = `用法:
  node auth-detect.mjs list      dump.json
  node auth-detect.mjs curl      dump.json [url]
  node auth-detect.mjs header    dump.json
  node auth-detect.mjs puppeteer dump.json
  node auth-detect.mjs diff      before.json after.json`;
  try {
    if (cmd === 'list') cmdList(rest[0]);
    else if (cmd === 'curl') cmdCurl(rest[0], rest[1]);
    else if (cmd === 'header') cmdHeader(rest[0]);
    else if (cmd === 'puppeteer') cmdPuppeteer(rest[0]);
    else if (cmd === 'diff') cmdDiff(rest[0], rest[1]);
    else console.log(usage);
  } catch (e) {
    console.error('出错: ' + e.message);
    process.exit(1);
  }
}

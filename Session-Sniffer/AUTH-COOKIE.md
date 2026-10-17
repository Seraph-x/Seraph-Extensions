# 怎么确认「哪个 cookie 是登录态」

最可靠的办法不是猜名字，而是**差分**：

1. 退出登录（或开无痕），打开目标站，用 Session Sniffer 采集 → 导出 `before.json`
2. 正常登录，再采集一次 → 导出 `after.json`
3. 跑差分：

```bash
node -e "
const b=require('./before.json'), a=require('./after.json');
const m=new Map(b.cookies.map(c=>[c.domain+c.path+c.name,c.value]));
console.log(a.cookies.filter(c=>{const k=c.domain+c.path+c.name;return !m.has(k)||m.get(k)!==c.value;})
  .map(c=>c.name+' = '+c.value).join('\\n'));
"
```

输出的就是登录态 cookie。之后任何携带这串 `Cookie:` 头的请求，服务端都会认作已登录。

## 复刻登录态

```bash
# curl 直接带
curl -s -b "sessionid=XXXX; csrftoken=YYYY" https://TARGET/api/me

# Puppeteer 回灌
await page.setCookie(...require('./auth.json').map(c=>({
  name:c.name, value:c.value, domain:c.domain, path:c.path,
  secure:c.secure, httpOnly:c.httpOnly, sameSite:c.sameSite||'Lax'
})));
await page.goto('https://TARGET/dashboard');
```

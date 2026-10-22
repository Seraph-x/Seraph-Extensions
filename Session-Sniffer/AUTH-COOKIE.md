# How to confirm which cookie is the login state

The most reliable way is not guessing at names but **diffing**:

1. Log out (or open an incognito window), open the target site, and collect with Session Sniffer → export `before.json`
2. Log in normally and collect again → export `after.json`
3. Run the diff:

```bash
node -e "
const b=require('./before.json'), a=require('./after.json');
const m=new Map(b.cookies.map(c=>[c.domain+c.path+c.name,c.value]));
console.log(a.cookies.filter(c=>{const k=c.domain+c.path+c.name;return !m.has(k)||m.get(k)!==c.value;})
  .map(c=>c.name+' = '+c.value).join('\\n'));
"
```

Whatever it prints is the login-state cookie. From then on, any request carrying that `Cookie:` header is treated by the server as logged in.

## Reproducing the login state

```bash
# straight from curl
curl -s -b "sessionid=XXXX; csrftoken=YYYY" https://TARGET/api/me

# replaying it into Puppeteer
await page.setCookie(...require('./auth.json').map(c=>({
  name:c.name, value:c.value, domain:c.domain, path:c.path,
  secure:c.secure, httpOnly:c.httpOnly, sameSite:c.sameSite||'Lax'
})));
await page.goto('https://TARGET/dashboard');
```

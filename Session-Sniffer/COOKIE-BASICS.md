# What a cookie is, and what it is for

## 1. Why cookies exist

HTTP is a **stateless** protocol. Every request stands alone; once the server has handled one request it "forgets" everything. It does not remember:

- whether the previous request was yours
- that you logged in a moment ago
- what is in your shopping cart

But websites need to remember these things. Hence the cookie — **a small piece of state the browser holds on the server's behalf and attaches to every request automatically**.

In one sentence: **a cookie is the string that turns stateless HTTP into something stateful.**

## 2. One complete round trip

```
① You submit the login form
   POST /login  body: user=alice&pass=***

② The server validates it and sends back a Set-Cookie
   HTTP/1.1 200 OK
   Set-Cookie: sessionid=abc123; Domain=.example.com; Path=/; Max-Age=86400;
               Secure; HttpOnly; SameSite=Lax

③ The browser stores it in the cookie store (in the domain=.example.com slot)

④ From then on, every request you make to example.com gets it attached automatically
   GET /dashboard
   Cookie: sessionid=abc123

⑤ The server sees sessionid=abc123, looks it up in the session store, and finds "this is alice"
   → returns alice's page
```

**The key point**: step ④ is **done by the browser automatically**; no JavaScript is involved. That is the fundamental difference between cookies and other kinds of storage.

## 3. The seven attributes of a cookie

A cookie is more than name=value; it carries a pile of constraints:

| Attribute | Effect | Example |
|---|---|---|
| **Domain** | Which domains can see it. `.example.com` covers all subdomains; `www.example.com` is limited to itself | `Domain=.example.com` |
| **Path** | Which paths can see it. `/api` is only sent to `/api/*` | `Path=/` |
| **Expires / Max-Age** | Expiry time. Omitted = session cookie, deleted when the browser closes | `Max-Age=86400` |
| **Secure** | Sent over HTTPS only | `Secure` |
| **HttpOnly** | Invisible to `document.cookie` in JS, prevents XSS theft | `HttpOnly` |
| **SameSite** | Whether to attach it on cross-site requests. `Strict` / `Lax` / `None` | `SameSite=Lax` |
| **Partitioned** | CHIPS, isolated per top-level site | `Partitioned` |

Two name prefixes are also **hard constraints**:

- `__Secure-` prefix → must carry `Secure`
- `__Host-` prefix → must have `Secure` + `Path=/` + **no Domain** (strictest, prevents subdomain poisoning)

## 4. What cookies are actually used for

### 1. Session management (the dominant use, ~90%)
`sessionid` / `JSESSIONID` / `PHPSESSID` / `connect.sid` — a random ID pointing at a server-side session record. **This is the physical form of "being logged in".**

### 2. Personalization
Language preference, time zone, theme (dark/light), rows per page, collapsed state.

### 3. Tracking and advertising
Third-party cookies are the foundation of the ad industry: you look at a product on site A, and it shows up in an ad slot on site B. `_ga` (Google Analytics client id), `_fbp` (Facebook Pixel), `IDE` (DoubleClick).

> This is also why third-party cookies are being phased out by Chrome/Safari/Firefox.

### 4. Consent state
The choice made in a GDPR / privacy compliance dialog: `cookie_consent=analytics:1,ads:0`. The Google `COMPASS` cookie you asked about earlier belongs to this category.

### 5. A/B testing and experiment bucketing
`exp_bucket=37` — a cookie pins you to one experiment group so the same user always sees the same version.

### 6. CSRF protection
`csrftoken` — double-submit pattern: the server requires the token in the request body to match the token in the cookie, which stops other sites from forging your requests.

### 7. Shopping carts (traditional sites)
Storing the cart in a cookie while the user is not logged in.

### 8. Load-balancer stickiness
`SERVERID=web03` — pins one user's requests to one backend, avoiding session desync.

### 9. Anti-abuse and risk control
`AEC`, `__Secure-ENID`, `SIDCC` — device fingerprinting, request-rate checks, and consistency validation of the cookie set.

### 10. Attribution and referral
`aff_id=partner42` — records which promotional link you arrived from.

## 5. Cookies vs. other storage

| | Sent automatically with requests | Capacity | Visible to the server | Readable by JS | Lifetime |
|---|---|---|---|---|---|
| **Cookie** | ✅ attached every time | 4KB each | ✅ | Partial (not when HttpOnly) | Expiry can be set |
| **localStorage** | ❌ must be put into the header by hand | 5–10MB | ❌ | ✅ | Permanent |
| **sessionStorage** | ❌ | 5–10MB | ❌ | ✅ | Cleared when the tab closes |
| **IndexedDB** | ❌ | Hundreds of MB | ❌ | ✅ | Permanent |
| **Service Worker cache** | ❌ | Large | ❌ | ✅ | Permanent |

**"Sent automatically" is the one capability of cookies that cannot be replaced**, and it is also their biggest burden — it rides along on every request, wastes bandwidth, and is inherently exploitable by CSRF.

Modern SPAs often switch to `localStorage` + `Authorization: Bearer` precisely to dodge those two points. The price is losing the protection of `HttpOnly`.

## 6. Count and size limits

| Limit | Value |
|---|---|
| Single cookie (name+value+attributes) | ~4KB |
| Cookies per domain | ~180 (Chrome) |
| Total size per domain | ~4KB × 180 |

Going over evicts the oldest by LRU. That is why Google **packs** several logical cookies into one (`gwus-pd=...:gwus-pd-hl=...`) — the quota under `.google.com` has long been exhausted.

## 7. Security issues

| Attack | Mechanism | Defense |
|---|---|---|
| **XSS theft** | Inject JS that reads `document.cookie` | `HttpOnly` |
| **CSRF** | Another site lures you into a request; the browser attaches the cookie automatically | `SameSite` + CSRF token |
| **Session hijacking** | Capture the cookie and impersonate you | `Secure` + `__Host-` + IP/fingerprint binding |
| **Cookie poisoning / tossing** | Write a same-named cookie from a subdomain to override the main domain's | `__Host-` prefix |
| **Session fixation** | The attacker hands you a sessionid they already know | A new one must be issued after login |
| **Man in the middle** | Sniffing plaintext HTTP | `Secure` + HSTS |
| **Partition bypass** | Reading first-party cookies from a third-party context | `Partitioned` (CHIPS) |

**The core fact**: a cookie is a **possession-is-proof** credential. Whoever holds that string is that user — the server performs no second check. That is why "extracting the login cookie" is equivalent to "taking over the account" in a security test.

## 8. How this relates to the tool

Once the attribute table above makes sense, all the earlier oddities explain themselves:

- Why the extension can read `HttpOnly` login cookies → it works at the browser engine layer, not through JS
- Why "only what this page can see" filters a batch out → five gates: Domain / Path / Secure / SameSite / Partitioned
- Why a cross-site POST carries fewer cookies → `SameSite=Lax` only lets GET/HEAD through
- Why the sort order changes → RFC 6265 §5.4 puts longer paths first
- Why `COMPASS` is not a login state → it is a consent state, not a session credential

**In one sentence**: a cookie is a little note the browser keeps for the server, handed up automatically on every request. Login depends on it, tracking depends on it, and risk control depends on it too.

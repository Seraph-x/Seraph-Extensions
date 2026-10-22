# How Cookie and Session relate, and how they differ

## 1. First, clear up a common misunderstanding

**They are not alternatives; they are two different layers.**

| | Cookie | Session |
|---|---|---|
| Essence | Client-side storage + **automatic transport mechanism** | A server-side state record |
| Location | In the browser | Server memory / Redis / DB / file |
| Belongs to | The transport layer | Application-layer state |

They solve **two halves of the same problem**: HTTP is stateless.
Cookie is responsible for "carrying the identity over"; Session is responsible for "keeping the identity stored".

## 2. The classic combination (the vast majority of sites)

```
① Login succeeds
   Server: create session { id:"abc123", user:"alice", roles:[...], expires:... }
           store it in Redis / memory / DB
   Response: Set-Cookie: sessionid=abc123; HttpOnly; Secure; SameSite=Lax

② Subsequent requests
   Browser attaches automatically:  Cookie: sessionid=abc123
   Server:                          takes abc123 to the session store → alice
```

**The cookie is the key; the session is the file inside the safe.**
Only the number is engraved on the key; the real information lives on the server side.

- Upside: the server can change/delete the session at any time → **revocable**
- Cost: the server has to store state → **multi-machine deployments must share a session store**

## 3. Point-by-point comparison

| Dimension | Cookie | Session |
|---|---|---|
| Storage location | The browser's cookie store | Server memory / Redis / DB / file |
| Who writes it | Server `Set-Cookie`, browser stores it | Fully controlled by the server |
| Contents | Usually just an ID, sometimes the data itself | Identity, permissions, cart, CSRF token |
| Size limit | **4KB each**, ~180 per domain | No hard limit (depends on the backend) |
| Transport | **Attached automatically on every request** | Not transported; only the ID travels |
| Lifetime | `Expires`/`Max-Age`, or session-scoped | Server TTL + periodic GC |
| Revocable | Delete it in the browser, the server's copy remains | ✅ Delete it server-side and it dies immediately |
| Scalability | Stateless, scales horizontally by nature | Needs shared storage (a Redis cluster) |
| Bandwidth cost | Carried on every request | Only an ID travels |

## 4. They do not have to be paired

### A session can live without cookies

- **URL rewriting**: `/page;jsessionid=abc123` (Java Servlet's answer for browsers with cookies disabled)
- **Hidden form fields**: `<input type="hidden" name="sessionid" value="abc123">`
- **Custom headers**: `Authorization: Bearer <token>`
- **localStorage + manually setting the header**

### A cookie can live without a session

That is a **stateless architecture**:

**① Signed cookie (client-side session)** — the Rails / Flask default

```
Set-Cookie: session=eyJ1c2VyIjoiYWxpY2UifQ--a3f9b2c1d4e5...
                    └──── base64 data ────┘ └─ HMAC sign ─┘
```

The entire session payload is serialized, signed (or encrypted), and **stuffed into the cookie itself**; the server stores nothing and just verifies the signature to read it.

- Pros: fully stateless, add machines freely
- Cons: **cannot be revoked** (unless you rotate the key so every signature becomes invalid), and bounded by 4KB

**② JWT** — the modern version of the same idea

**③ Pure front-end cookie** — theme, language, `_ga`, with no server-side session at all

## 5. Three architectures side by side

| Architecture | Where the session lives | What goes in the cookie | Typical implementations |
|---|---|---|---|
| **Stateful** | Redis / DB / memory | A random session id | PHP, Java, Django, Express-session |
| **Stateless** | Nowhere | The full signed/encrypted payload | Rails, Flask, JWT |
| **Hybrid** | A small amount of critical state | Signed payload + a version number | Most modern applications |

How to tell them apart: look at the cookie's **value**.

- A short random string (`abc123`, 32 hex chars) → **stateful**, the id points at a server-side record
- Long, containing `.` or `--` separators, base64-shaped (`eyJ...`) → **stateless**, the data is inside

The Google `SID` you captured earlier belongs to the first kind; `session=eyJ1c2Vy...--a3f9...` belongs to the second.

## 6. Division of labor on security

| Who is responsible | What it prevents | By what means |
|---|---|---|
| **Cookie** | Being stolen | `HttpOnly` (against XSS), `Secure` (against MITM), `__Host-` (against subdomain poisoning), `SameSite` (against CSRF) |
| **Session** | What to do once it has been stolen | The server deletes the session immediately → the id in the attacker's hands becomes scrap paper |

**This is exactly the famous pain point of stateless architecture: logout never finishes cleanly.**
You delete the browser cookie, but the token in the attacker's hands stays valid until it expires. Fixing that means adding a blacklist — and a blacklist makes it stateful again.

## 7. Back to this tool

- The `sessionid=abc123` the extension captures is only the **key**; the real content is on the server
- But **holding the key is enough** — the server only checks the key and performs no second verification
- So "extracting the cookie" in practice ≈ "extracting the session"
- `chrome.cookies` can read the `HttpOnly` sessionid → that is why it can obtain the login state

**What the diff method is for**: the cookie that is added or changes between before and after login is the key to the session.
See `AUTH-COOKIE.md` for details.

## 8. Summary in one sentence

> **A cookie is the envelope; a session is the letter.**
> The envelope can be empty (pure front-end cookie), and the letter can travel outside an envelope (Bearer token).
> But when they appear as a pair, the number written on the envelope is the key that opens the letter.

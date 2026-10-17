# Cookie 是什么，干什么用

## 一、为什么会有 cookie

HTTP 是**无状态**协议。每个请求都是独立的，服务器处理完一个请求就"失忆"了。它不会记得：

- 上一次请求是不是你发的
- 你刚才登录过
- 你的购物车里有什么

但网站需要记住这些。于是有了 cookie —— **浏览器帮服务器保管的一小块状态，每次请求自动附上**。

一句话：**cookie 是让无状态的 HTTP 有状态的那根绳子。**

## 二、一次完整的往返

```
① 你提交登录表单
   POST /login  body: user=alice&pass=***

② 服务器验证通过，回一个 Set-Cookie
   HTTP/1.1 200 OK
   Set-Cookie: sessionid=abc123; Domain=.example.com; Path=/; Max-Age=86400;
               Secure; HttpOnly; SameSite=Lax

③ 浏览器把这条存进 cookie store（domain=.example.com 那格）

④ 之后你对 example.com 的每一次请求，浏览器自动加上
   GET /dashboard
   Cookie: sessionid=abc123

⑤ 服务器看到 sessionid=abc123，去 session store 里查出「这是 alice」
   → 返回 alice 的页面
```

**关键点**：第 ④ 步是**浏览器自动做的**，不需要 JS 参与。这就是 cookie 和其他存储的根本区别。

## 三、Cookie 的七个属性

一条 cookie 不只是 name=value，它带着一堆约束：

| 属性 | 作用 | 例子 |
|---|---|---|
| **Domain** | 哪些域名可见。`.example.com` 含所有子域；`www.example.com` 只限本身 | `Domain=.example.com` |
| **Path** | 哪些路径可见。`/api` 只发给 `/api/*` | `Path=/` |
| **Expires / Max-Age** | 过期时间。不写 = 会话 cookie，关浏览器就删 | `Max-Age=86400` |
| **Secure** | 只在 HTTPS 上发送 | `Secure` |
| **HttpOnly** | JS 的 `document.cookie` **看不到**，防 XSS 偷取 | `HttpOnly` |
| **SameSite** | 跨站请求要不要带。`Strict` / `Lax` / `None` | `SameSite=Lax` |
| **Partitioned** | CHIPS，按顶层站点分区隔离 | `Partitioned` |

还有两个名字前缀是**硬约束**：

- `__Secure-` 开头 → 必须带 `Secure`
- `__Host-` 开头 → 必须 `Secure` + `Path=/` + **不能有 Domain**（最严格，防子域投毒）

## 四、Cookie 到底用来干什么

### 1. 会话管理（最主要的用途，占 90%）
`sessionid` / `JSESSIONID` / `PHPSESSID` / `connect.sid` —— 一个随机 ID，指向服务器端的 session 记录。**这就是"登录态"的物理形态。**

### 2. 个性化
语言偏好、时区、主题（深色/浅色）、每页条数、折叠状态。

### 3. 跟踪与广告
第三方 cookie 是广告业的地基：你在 A 站看过某商品，B 站的广告位上就出现它。`_ga`（Google Analytics 的 client id）、`_fbp`（Facebook Pixel）、`IDE`（DoubleClick）。

> 这也是第三方 cookie 正在被 Chrome/Safari/Firefox 逐步淘汰的原因。

### 4. 同意状态
GDPR / 隐私合规弹窗的选择：`cookie_consent=analytics:1,ads:0`。你之前问的 Google `COMPASS` 就属于这一类。

### 5. A/B 测试与实验分组
`exp_bucket=37` —— 用 cookie 固定你落在哪个实验组，保证同一用户始终看到同一个版本。

### 6. CSRF 防护
`csrftoken` —— 双提交模式：服务器要求请求体里的 token 和 cookie 里的 token 一致，防止别的站伪造你的请求。

### 7. 购物车（传统站点）
未登录状态下把购物车存在 cookie 里。

### 8. 负载均衡粘性
`SERVERID=web03` —— 让同一用户的请求都落到同一台后端，避免 session 不同步。

### 9. 反滥用与风控
`AEC`、`__Secure-ENID`、`SIDCC` —— 设备指纹、请求频率、cookie 集合一致性校验。

### 10. 归因与分销
`aff_id=partner42` —— 记录你是从哪个推广链接进来的。

## 五、Cookie 和其他存储的区别

| | 自动随请求发送 | 容量 | 服务端可见 | JS 可读 | 生命周期 |
|---|---|---|---|---|---|
| **Cookie** | ✅ 每次自动带 | 4KB/条 | ✅ | 部分（HttpOnly 不可） | 可设过期 |
| **localStorage** | ❌ 要手动塞进 header | 5–10MB | ❌ | ✅ | 永久 |
| **sessionStorage** | ❌ | 5–10MB | ❌ | ✅ | 关标签页清空 |
| **IndexedDB** | ❌ | 数百 MB | ❌ | ✅ | 永久 |
| **Service Worker cache** | ❌ | 大 | ❌ | ✅ | 永久 |

**"自动发送"是 cookie 唯一不可替代的能力**，也是它最大的负担——每次请求都带着，浪费带宽，且天然可被 CSRF 利用。

现代 SPA 常改用 `localStorage` + `Authorization: Bearer`，正是为了躲开这两点。代价是失去了 `HttpOnly` 的保护。

## 六、数量与大小限制

| 限制 | 值 |
|---|---|
| 单条 cookie（name+value+属性） | ~4KB |
| 单域名 cookie 数 | ~180（Chrome） |
| 单域名总大小 | ~4KB × 180 |

超了会按 LRU 淘汰旧的。这就是为什么 Google 把多个逻辑 cookie **打包**进一条（`gwus-pd=...:gwus-pd-hl=...`）——`.google.com` 域下的配额早就用满了。

## 七、安全问题

| 攻击 | 原理 | 防御 |
|---|---|---|
| **XSS 窃取** | 注入 JS 读 `document.cookie` | `HttpOnly` |
| **CSRF** | 别的站诱导你发请求，浏览器自动带上 cookie | `SameSite` + CSRF token |
| **会话劫持** | 抓到 cookie 就能冒充你 | `Secure` + `__Host-` + 绑定 IP/指纹 |
| **Cookie 投毒 / Tossing** | 从子域写一条同名 cookie 覆盖主域的 | `__Host-` 前缀 |
| **会话固定** | 攻击者先给你一个已知的 sessionid | 登录成功后必须重新签发 |
| **中间人** | 明文 HTTP 上抓包 | `Secure` + HSTS |
| **分区绕过** | 第三方上下文读第一方 cookie | `Partitioned`（CHIPS） |

**核心事实**：cookie 是**持有即证明**的凭证。谁拿到那串值，谁就是那个用户——服务器不做二次验证。这就是为什么"提取登录 cookie"这件事在安全测试里等价于"接管账号"。

## 八、和本工具的关系

理解了上面的属性表，前面那些现象就都能解释了：

- 为什么扩展能读到 `HttpOnly` 的登录 cookie → 它走浏览器内核层，不是 JS
- 为什么"只发本页可见"会过滤掉一批 → Domain / Path / Secure / SameSite / Partitioned 五道闸门
- 为什么跨站 POST 会少几条 → `SameSite=Lax` 只放行 GET/HEAD
- 为什么排序会变 → RFC 6265 §5.4 规定 path 长的在前
- 为什么 `COMPASS` 不是登录态 → 它是同意状态，不是会话凭证

**一句话**：cookie 是浏览器替服务器记住你的一张小纸条，每次请求自动递上去。登录靠它，跟踪靠它，风控也靠它。

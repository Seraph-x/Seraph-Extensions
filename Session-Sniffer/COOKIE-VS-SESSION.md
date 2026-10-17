# Cookie 与 Session 的联系和区别

## 一、先破一个常见误解

**它们不是二选一，是两个层次的东西。**

| | Cookie | Session |
|---|---|---|
| 本质 | 客户端存储 + **自动传输机制** | 服务端的状态记录 |
| 位置 | 浏览器里 | 服务器内存 / Redis / DB / 文件 |
| 属于 | 传输层 | 应用层状态 |

它们解决的是**同一个问题的两半**：HTTP 无状态。
Cookie 负责"把身份带过去"，Session 负责"把身份存下来"。

## 二、经典组合（绝大多数站点）

```
① 登录成功
   服务器: 创建 session { id:"abc123", user:"alice", roles:[...], expires:... }
           存进 Redis / 内存 / DB
   响应:   Set-Cookie: sessionid=abc123; HttpOnly; Secure; SameSite=Lax

② 后续请求
   浏览器自动带:  Cookie: sessionid=abc123
   服务器:        拿 abc123 去 session store 查 → alice
```

**Cookie 是钥匙，Session 是保险箱里的档案。**
钥匙上只刻了编号；真正的信息在服务器那边。

- 好处：服务器可以随时改/删 session → **可撤销**
- 代价：服务器要存状态 → **多机部署必须共享 session store**

## 三、逐项对照

| 维度 | Cookie | Session |
|---|---|---|
| 存储位置 | 浏览器 cookie store | 服务器内存 / Redis / DB / 文件 |
| 谁来写 | 服务器 `Set-Cookie`，浏览器存 | 服务器完全控制 |
| 内容 | 通常只是一个 ID，也可能直接是数据 | 身份、权限、购物车、CSRF token |
| 大小上限 | **4KB/条**，~180 条/域 | 无硬限制（取决于后端） |
| 传输方式 | **每次请求自动附上** | 不传输，只传 ID |
| 生命周期 | `Expires`/`Max-Age`，或会话级 | 服务端 TTL + 定期 GC |
| 能否撤销 | 删浏览器端，服务器那份还在 | ✅ 服务器删掉即刻失效 |
| 扩展性 | 无状态，天然可水平扩展 | 需要共享存储（Redis 集群） |
| 带宽开销 | 每次请求都带 | 只带一个 ID |

## 四、它们并不是必须配对

### Session 不用 cookie 也能活

- **URL 重写**：`/page;jsessionid=abc123`（Java Servlet 为禁用 cookie 的浏览器准备）
- **隐藏表单字段**：`<input type="hidden" name="sessionid" value="abc123">`
- **自定义头**：`Authorization: Bearer <token>`
- **localStorage + 手动塞 header**

### Cookie 不用 session 也能活

这就是**无状态架构**：

**① 签名 Cookie（client-side session）** —— Rails / Flask 的默认做法

```
Set-Cookie: session=eyJ1c2VyIjoiYWxpY2UifQ--a3f9b2c1d4e5...
                    └──── base64 数据 ────┘ └─ HMAC 签名 ─┘
```

整个 session 数据序列化后签名（或加密）**塞进 cookie 本身**，服务器不存任何东西，验签即可读。

- 优点：完全无状态，随便加机器
- 缺点：**无法撤销**（除非轮换密钥让所有签名失效）、受 4KB 限制

**② JWT** —— 同一思路的现代版本

**③ 纯前端 cookie** —— 主题、语言、`_ga`，根本没有服务端 session

## 五、三种架构对照

| 架构 | session 在哪 | cookie 里放什么 | 典型实现 |
|---|---|---|---|
| **有状态** | Redis / DB / 内存 | 一个随机 session id | PHP、Java、Django、Express-session |
| **无状态** | 不存在 | 签名/加密的完整数据 | Rails、Flask、JWT |
| **混合** | 存少量关键状态 | 签名数据 + 版本号 | 多数现代应用 |

识别方法：看 cookie 的**值**。

- 值是一串短随机串（`abc123`、32 位 hex）→ **有状态**，id 指向服务器记录
- 值很长、含 `.` 或 `--` 分隔、base64 形态（`eyJ...`）→ **无状态**，数据就在里面

你之前抓的 Google `SID` 属于第一类；`session=eyJ1c2Vy...--a3f9...` 属于第二类。

## 六、安全上的分工

| 谁负责 | 防什么 | 手段 |
|---|---|---|
| **Cookie** | 不被偷 | `HttpOnly`（防 XSS）、`Secure`（防中间人）、`__Host-`（防子域投毒）、`SameSite`（防 CSRF） |
| **Session** | 被偷了怎么办 | 服务器立即删除 session → 攻击者手里的 id 变成废纸 |

**这正是无状态架构的著名痛点：登出做不干净。**
你删了浏览器 cookie，但攻击者手里的 token 在过期前依然有效。要修就得加黑名单——一加黑名单，又变回有状态了。

## 七、回到本工具

- 扩展抓到的 `sessionid=abc123` 只是**钥匙**，真正内容在服务器
- 但**拿着钥匙就够了** —— 服务器只认钥匙，不做二次验证
- 所以"提取 cookie" 在实践中 ≈ "提取 session"
- `chrome.cookies` 能读到 `HttpOnly` 的 sessionid → 这就是它能拿到登录态的原因

**差分法的意义**：登录前后新增/变化的那个 cookie，就是 session 的钥匙。
详见 `AUTH-COOKIE.md`。

## 八、一句话总结

> **Cookie 是信封，Session 是信。**
> 信封可以空着（纯前端 cookie），信也可以不装在信封里（Bearer token）。
> 但只要它们配对出现，信封上写的那个编号，就是打开信的钥匙。

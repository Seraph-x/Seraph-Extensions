# 主题与字体规范（Claude 视觉系统）

本扩展的 popup 界面按 **Claude 的视觉语言**重建：奶油底色、黏土橘强调色、Anthropic 自有字体族、极细描边、克制的阴影。本文档记录取色、取字与实现方式，方便后续统一改动。

> 参考样本：`~/Downloads/Claude`（Claude Web 的离线存档），字体与色值均从其 `css/*.css` 与 `assets/*.woff2` 中实测提取，不是凭印象调的。

---

## 1. 字体

### 1.1 三个字族

| 字族 | 文件 | 用途 | 字重 |
|---|---|---|---|
| **Anthropic Sans** | `fonts/anthropic-sans.woff2`（+ italic） | 界面正文、按钮、标签、表头 | 变量 **300–800** |
| **Anthropic Serif** | `fonts/anthropic-serif.woff2` | 品牌标题（`h1`） | 变量 **300–800** |
| **Anthropic Mono** | `fonts/anthropic-mono.woff2` | cookie 名/值、URL、状态栏、JSON | 400 |

三者都是 **variable font**（`wght` 轴 300–800），一个文件覆盖全字重——实测字宽随字重线性变化，说明轴生效：

```
Sans 400 = 505.2px   Sans 600 = 519.6px   Sans 800 = 540.3px   (同字符串 40px 测量)
```

### 1.2 回退栈

中文不在 Anthropic 字库内，回退到系统字体。栈按「先拉丁自有字体 → 再系统 UI → 最后 CJK」排列：

```css
--font-ui:    "Anthropic Sans", ui-sans-serif, system-ui, -apple-system,
              "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB",
              "Microsoft YaHei", sans-serif;

--font-serif: "Anthropic Serif", Georgia, "Songti SC", "PingFang SC",
              "Noto Serif SC", serif;

--font-mono:  "Anthropic Mono", ui-monospace, SFMono-Regular, Menlo, Consolas,
              "PingFang SC", monospace;
```

### 1.3 用法约定

| 元素 | 字族 | 字号 | 说明 |
|---|---|---|---|
| `h1` 品牌名 | Serif | 15px / 600 | 前置 `✳` 星芒，黏土橘 |
| 按钮 / 标签 / 复选框文字 | Sans | 11px | `font-weight: 500` |
| 输入框占位符 | Sans | 11.5px | 实际输入内容用 Mono |
| 表头 `th` | Sans | 9.5px / 600 | 大写 + `.03em` 字距 |
| cookie 名 / 值 | Mono | 10.5px | `font-variant-numeric: tabular-nums` |
| domain | Mono | 10px | 弱化色 |
| flags | Sans | 9.5px | 最弱色，行高 1.45 |
| 状态栏 / URL | Mono | 10–10.5px | — |

> **为什么 cookie 名/值用等宽**：这些是机器生成的不可读串，等宽字体让 `__Secure-1PSID`、`g.a000xQ9z…` 这类名字对齐、易扫读，也让相似前缀的差异更明显。**为什么品牌名用衬线**：这是 Claude 的识别特征，一眼区分「工具界面」和「随便套的暗色主题」。

---

## 2. 色板

取自 Claude CSS 的 HSL 三元组，原样换算成 hex。**浅色是 Claude 的招牌奶油底，深色是 Claude 的深灰暖底**——注意不是纯中性灰，都带一点点暖（色相 30–60）。

### 2.1 浅色（默认）

| 令牌 | hex | HSL | 用在哪 |
|---|---|---|---|
| `--bg-page` | `#FAF9F5` | 48 33% 97% | 页面底、表头底 |
| `--bg-surface` | `#FFFFFF` | 0 0% 100% | 按钮、输入框、激活的 tab |
| `--bg-sunken` | `#F0EFE9` | 45 12% 93% | 分段控件容器、`pre` 底 |
| `--bg-inset` | `#F6F5F0` | — | 行 hover |
| `--fg-strong` | `#121212` | 0 0% 7% | 主文字、cookie 名 |
| `--fg` | `#373734` | 60 3% 21% | 正文、按钮文字 |
| `--fg-muted` | `#7B7974` | 43 3% 47% | 次要信息、domain |
| `--fg-faint` | `#A9A79E` | — | 表头、flags、占位符 |
| `--line` | `#E2E1DA` | 53 12% 87% | 常规描边 |
| `--line-strong` | `#D2D1C6` | 55 11% 80% | hover 描边、表头下缘 |
| `--accent` | `#D97757` | **14.8 63% 60%** | Claude 黏土橘：主按钮、星芒 |
| `--accent-hover` | `#C4643F` | — | 主按钮 hover |
| `--value` | `#AD5733` | — | cookie 值专用（加深保对比度） |

### 2.2 深色

| 令牌 | hex | HSL |
|---|---|---|
| `--bg-page` | `#262624` | 60 2.7% 14.5% |
| `--bg-surface` | `#303030` | 0 0% 19% |
| `--bg-sunken` | `#1F1E1D` | 30 3.3% 11.8% |
| `--fg-strong` | `#FAF9F5` | 48 33% 97% |
| `--fg` | `#C2C0B6` | 50 9% 74% |
| `--fg-muted` | `#9C9A92` | 48 5% 59% |
| `--fg-faint` | `#6E6C68` | — |
| `--line` | `#3A3936` | 60 2% 17% |
| `--line-strong` | `#4C4B47` | — |
| `--value` | `#E29B7F` | — |

### 2.3 关于 `--value`

原色 `#D97757` 在奶油底上对比度只有 **≈2.9:1**，做 10.5px 小字不合格。所以单独拆了一个 `--value` 令牌：浅色加深到 `#AD5733`（≈4.7:1），深色提亮到 `#E29B7F`（≈6.5:1）。**强调色和可读文字色分开管**，是这套主题唯一一处偏离原站配色的地方。

---

## 3. 主题三态

```
auto（默认）── 跟随系统 prefers-color-scheme
  ├─ light  强制浅色（即使系统是深色）
  └─ dark   强制深色（即使系统是浅色）
```

实现是三层 CSS + 一个属性：

```css
:root, :root[data-theme="light"] { /* 浅色令牌 */ }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* 深色令牌 */ }   /* auto 且系统深色 */
}

:root[data-theme="dark"] { /* 深色令牌 */ }            /* 手动锁深色，优先级最高 */
```

- `auto` 时**移除** `data-theme` 属性 → 让媒体查询接管
- 手动锁定写 `data-theme="light|dark"` → 媒体查询被 `:not([data-theme="light"])` 挡掉
- 选择存 `chrome.storage.local` 的 `sniffer.theme` 键，下次打开 popup 直接生效

交互入口：顶栏右上角圆形按钮，点击循环 `auto → light → dark → auto`，图标 `◐ / ☀ / ☾`，`title` 同步说明当前状态。

另加 `color-scheme: light dark`（`:root` 与 `<meta name="color-scheme">` 各一处），让原生控件——下拉箭头、复选框、滚动条——自动跟随主题，避免深色底下蹦出白下拉框。

---

## 4. 布局

固定 **560 × 460**（Chrome popup 上限 800 宽，这里取紧凑尺寸）。

```
┌──────────────────────────────────────────┐  header    ~48px
│ ✳ Session Sniffer                    ◐  │
│ https://accounts.google.com/…            │
├──────────────────────────────────────────┤  toolbar   ~38px（7 按钮单行）
├──────────────────────────────────────────┤  ctx 栏    ~38px
├──────────────────────────────────────────┤  filter 栏 ~38px
├──────────────────────────────────────────┤  tabs      ~36px（分段控件）
├──────────────────────────────────────────┤
│ 表格（可滚，sticky 表头）                  │  main      剩余
├──────────────────────────────────────────┤
│ 状态栏                                    │  footer    ~28px
└──────────────────────────────────────────┘
```

### 表格列宽

`table-layout: fixed`，四列：

| 列 | 宽度 | 内容 |
|---|---|---|
| name | 106px | cookie 名，Mono |
| value | auto（≈160px） | cookie 值，Mono + `--value` |
| domain | 96px | 域；**path 不为 `/` 时跟在后面**（`.google.com /accounts`） |
| flags | 170px | HttpOnly / Secure / SameSite / Partitioned / 过期 |

> **为什么把 path 列砍了**：99% 的 cookie path 是 `/`，独占一列纯属浪费 36px 横向空间——而横向空间正是让 value 和 flags 各占 2 行、每屏多显示一行的关键。非 `/` 的 path 合并进 domain 单元格，信息不丢。

### 溢出策略

- name / value / domain：`word-break: break-all` + `overflow-wrap: anywhere`（不可读串必须硬断）
- flags：`word-break: normal` + `overflow-wrap: break-word`（要按空格断，否则 `SameSite=None` 会被劈开）
- 过期时间格式化为 `Exp=MM-DD HH:MM`，比完整 ISO 短 8 字符，正好压进 2 行

---

## 5. 交互

| 状态 | 表现 |
|---|---|
| `:focus-visible` | `border-color: --accent` + `box-shadow: 0 0 0 3px --accent-soft`（3px 光晕，不是 outline） |
| 按钮 hover | 底色 → `--bg-inset`，描边 → `--line-strong`，文字 → `--fg-strong` |
| 按钮 active | `translateY(.5px)`，模拟按下 |
| 表格行 hover | 底色 → `--bg-inset` |
| 过渡 | `.12s ease`（位移 `.08s`） |
| `::selection` | `--sel`（黏土橘 22% 透明） |
| `prefers-reduced-motion` | 全部 transition / animation 关掉 |

主次按钮：`#copyheader`（复制 Cookie 头）是黏土橘实心主操作；`#scanall` / `#export` 用强描边做次强调；其余为普通描边按钮。**一屏只有一个实心色块**，这是 Claude 的克制感来源。

---

## 6. 预览与调试

`preview.html` 是脱离 Chrome 扩展环境的设计稿，塞了假数据，直接用浏览器打开：

```
preview.html                      跟随系统
preview.html?theme=light          强制浅色
preview.html?theme=dark           强制深色
preview.html?tab=local            看 localStorage 面板
preview.html?tab=raw              看原始 JSON 面板
```

截图（用于设计回归对比）：

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=560,460 \
  --virtual-time-budget=3000 --screenshot=/tmp/shot.png \
  "file://$PWD/preview.html?theme=dark"
```

---

## 7. 改主题只改令牌

**所有颜色、字体、圆角都走 CSS 变量**，没有一处硬编码色值散落在规则里。要换皮：

1. 改 `:root` 里的令牌 → 浅色
2. 改 `@media (prefers-color-scheme: dark)` 和 `:root[data-theme="dark"]` → 深色（两处必须同步，否则手动锁深色和自动深色会不一致）
3. 字体换 `--font-ui / --font-serif / --font-mono`，或替换 `fonts/*.woff2` 并改 `@font-face` 的 `src`


---

## 8. 字体来源与再分发

`fonts/` 下的四个 `.woff2` 是从 Claude Web 存档中提取的 **Anthropic 自有品牌字体**（Anthropic Sans / Serif / Mono，variable，`wght` 300–800）。本地自用、内部工具、设计对齐没有问题；若要把这个扩展打包分发到商店，字体授权需另行确认——届时把 `@font-face` 指向替代字体（如 Inter / Source Serif / JetBrains Mono）即可，其余令牌不用动。

---

## 9. 与 Claude 原站的差异

只取视觉语言，不复制组件：

| 原站 | 本扩展 |
|---|---|
| 侧边栏 + 会话流 + 输入框 | 单页 popup，固定 560×460 |
| 大量留白、14px 正文 | 高密度表格、11px 正文、9.5px 表头 |
| 多层级卡片阴影 | 只有两级阴影（`--shadow-1` / `--shadow-2`） |
| 黏土橘作为强调/链接色 | 黏土橘只给「复制 Cookie 头」一个按钮 |
| 完整图标系统 | 只保留星芒标 + `◐/☀/☾` 三个字形 |

---

## 10. 图标

黏土橘渐变 squircle 底 + 奶油色放射星芒。星芒即 Claude 的品牌标，同一个形状也用在 popup 顶栏 `h1` 前面（`icons/mark.svg`，黏土橘透明底）。

![图标预览](icons/preview.png)

### 10.1 几何

单一参数表，改一处全家更新：

| 参数 | 完整版（48 / 128） | 简化版（16 / 32） |
|---|---|---|
| 画布 | 128 | 32 |
| 圆角半径 | 29（22.7%） | 7.2（22.5%） |
| 星芒数量 | **8** | **6** |
| 射线内/外半径 | 19 → 47 | 5.0 → 12.0 |
| 射线笔画宽 | 11.2 | 3.7 |
| 中心圆盘半径 | 14 | 3.6 |
| 起始角度 | −90°（正上方有芒） | −90° |

**为什么小尺寸要减到 6 芒**：16px 下 8 条射线的间隙只有不到 1 个像素，抗锯齿一糊就变成一坨白点。6 芒 + 更粗笔画（相对画布 11.6% vs 8.75%）才能在 16px 保住「放射」的辨识度。这不是缩放，是重新配平——专业图标集都这么做。

### 10.2 底色

`linearGradient` 从 `#DE8767`（左上）到 `#BE5E3A`（右下），45° 斜向而非垂直——垂直渐变在小尺寸下会看成上下两块色。另叠一条 `#FFFFFF 18%` 的 1.5px 内描边，模拟图标边缘的一线反光。

**为什么用黏土橘底而不是奶油底**：浏览器工具栏在浅色主题下是浅灰、深色主题下是深灰。奶油底图标在浅色工具栏里会糊掉，黏土橘在两种背景下都站得住，且品牌识别最强。

### 10.3 图标生成方式

现有图标由 SVG 经 Chrome 按 8 倍尺寸渲染，再用 Pillow LANCZOS 缩到目标尺寸。目录保留 SVG 源文件、各尺寸 PNG 和预览图；生成脚本已移除。

**为什么不直接让 Chrome 渲染 16px**：headless Chrome 有最小窗口尺寸限制，请求 16×16 或 48×48 时实际渲染尺寸更大、截图被裁成左上角一块（第一版就这么翻车的）。所以一律先渲染 8 倍（16→128、128→1024）再缩。

### 10.4 文件

| 文件 | 尺寸 | 用在哪 |
|---|---|---|
| `icons/icon.svg` | 矢量，128 画布 | 源文件（8 芒完整版） |
| `icons/icon-small.svg` | 矢量，32 画布 | 源文件（6 芒简化版） |
| `icons/mark.svg` | 矢量，透明底 | popup 顶栏 `h1` 前的星芒 |
| `icons/icon16.png` | 16×16 | 工具栏、扩展管理页小图标 |
| `icons/icon32.png` | 32×32 | Windows 高分屏工具栏 |
| `icons/icon48.png` | 48×48 | 扩展管理页 |
| `icons/icon128.png` | 128×128 | 商店列表、安装对话框 |
| `icons/preview.png` | — | 本文档的尺寸对照图 |

四张 PNG 已在 `manifest.json` 的 `icons` 与 `action.default_icon` 两处注册：`icons` 决定扩展管理页与商店展示，`default_icon` 决定工具栏按钮——漏掉后者工具栏会显示灰块。

# PageForge · 网页前端资源提取

将当前网页的 DOM 快照、可获取的样式、脚本和图片等资源打包为 ZIP，并可附带 `ai_instructions.md`，便于本地查看和继续开发。

当前版本 **1.0.0**，采用 Manifest V3，通过浏览器侧边栏操作。需要支持 `chrome.sidePanel` 及 `setPanelBehavior` 的浏览器。本目录已包含 js-beautify 和 JSZip 的浏览器文件，无需安装依赖或执行构建。

提取范围是当前已加载的页面与代码能发现、下载到的资源；输出包是否能独立运行，取决于原站的脚本、接口和资源依赖。

## 安装与更新

1. Chrome 打开 `chrome://extensions/`；Edge 打开 `edge://extensions/`。
2. 开启**开发者模式**，点击**加载已解压的扩展程序**。
3. 选择当前 `Pageforge-Extractor/` 目录，即包含 [manifest.json](manifest.json) 的目录。
4. 打开目标网页，点击工具栏的 PageForge 图标，进入侧边栏。

更新文件后，在扩展管理页重新加载扩展，再重新打开侧边栏和刷新目标页面。

## 提取当前网页

1. 等待目标网页加载完成。需要的折叠区域、懒加载图片或列表，应先手动展开、滚动加载。
2. 在侧边栏确认 **Target Webpage** 的标题和 URL。
3. 按需选择资源类型及清理选项。
4. 在 **Package Name** 中填写包名，不必添加 `.zip`。
5. 点击 **Forge Code Package**，查看进度与 `extraction.log`。
6. 完成后浏览器会发起 ZIP 下载，保存位置由浏览器下载设置决定。

切换标签页会更新侧边栏目标信息，并重新建议包名。开始前请再次确认当前标签页与文件名。

### 提取选项

| 界面选项 | 默认值 | 实际作用 |
| --- | --- | --- |
| HTML Code | 开启且不可关闭 | 输出当前 DOM 克隆生成的 `index.html` |
| Stylesheets (CSS) | 开启 | 下载已登记的外部样式表及生成的动态样式文件 |
| Scripts (JS) | 开启 | 下载外部脚本并改写 src；关闭时移除外部 script 标签，内联脚本仍可能保留 |
| Images & Assets | 开启 | 下载已登记的图片、srcset、picture 资源和部分样式引用资源 |
| Clean HTML | 开启 | 按内置选择器移除部分广告、追踪和第三方挂件，移除 noscript 及普通 HTML 注释 |
| Generate AI Agent Guide | 开启 | 输出 `ai_instructions.md` |

「Clean HTML」是基于有限选择器的清理规则，不覆盖全部广告或追踪代码。关闭 CSS 选项也不会完整移除 HTML 中改写后的样式引用；关闭图片选项不阻止外部 CSS 中的字体、背景等嵌套资源下载。因此这些开关不能保证生成完全无样式、无脚本或无图片请求的页面。

## 输出包内容

以下为结构示例，各目录仅在存在对应资源时出现，文件名随资源登记顺序生成：

```text
example_forge.zip
├── index.html
├── css/
│   ├── main_1.css
│   ├── main_1.css.map
│   └── dynamic_styles.css
├── js/
│   ├── app_2.js
│   └── app_2.js.map
├── assets/
│   ├── logo_3.png
│   └── nested_font.woff2
├── src/                    Source Map 中包含的原始源码
└── ai_instructions.md      勾选生成指南时出现
```

- **HTML**：克隆当前 document，按设置清理内容、登记资源并改写部分引用，再进行格式化。
- **CSS**：下载外部样式表；读取可访问的 CSSOM 动态规则，生成 `css/dynamic_styles.css`；尝试下载外部 CSS 中 `url()` 引用的字体、背景等资源。
- **JavaScript**：下载外部 script 文件，美化代码，并记录压缩或混淆特征。
- **图片等资源**：处理 img、图片输入框、srcset、picture source 及部分行内背景引用。
- **Source Map**：对外部 CSS、JS 的原始 URL 直接追加 `.map` 尝试获取；存在 `sourcesContent` 时将源码写入 `src/`。

主资源下载失败时，日志会记录错误，并在对应本地路径写入错误说明文本。嵌套 CSS 资源下载失败时记录警告并保留原引用。**ZIP 生成成功不代表所有资源下载成功**，请检查日志和输出文件。

### 查看本地页面

解压 ZIP，在解压目录打开终端运行：

```bash
python3 -m http.server 8080
```

然后用浏览器访问 `http://localhost:8080/index.html`。这只提供静态文件服务，不会补齐原站后端、鉴权接口或运行环境。

### AI 指南包含什么

`ai_instructions.md` 由扩展本地生成，主要包含：

- 页面标题、原始 URL、生成时间和语义布局标签摘要。
- 资源文件清单及部分原始地址。
- 从可读取的 `:root` 规则中提取、名称含 color / brand / theme 的 CSS 变量。
- JavaScript 可读性报告，包括压缩、混淆特征及 Source Map 发现情况。
- 针对可疑脚本的处理提示，以及继续修改页面的提示词。

混淆判断基于标识符和行长等启发式规则，不会执行完整反混淆，也不能证明代码安全。指南清单来自资源登记结果，可能包含关闭下载或获取失败的项目，应以 ZIP 内实际文件和日志为准。

## 常见问题与限制

**按钮显示 Extraction Unavailable。** 当前没有可处理的网页，或处于浏览器内部页、扩展页等受限环境。切换到普通 HTTP(S) 页面再操作。

**提示 Failed to communicate with page。** 扩展会先尝试注入分析脚本。若仍无法通信，刷新目标页并确认扩展有该网站的访问权限，再重试。

**大量资源显示 Failed to retrieve。** 资源可能不存在、需要登录凭据或被服务端限制。扩展侧资源请求使用 `credentials: omit`，不会自动携带页面登录 Cookie；已登录页面的 DOM 可以被克隆，但其受保护资源未必能重新下载。

**本地无样式、图片缺失或页面白屏。** 查看日志和生成文件。当前实现仅改写部分引用：不递归打包 JS import、动态加载脚本、CSS import 或所有运行时依赖；也不保存接口响应、WebSocket 数据和服务端逻辑。页面中已经渲染的内容可能进入 DOM 快照，后续交互仍可能依赖原站。

**没有 src 目录。** 当前只探测「原资源 URL + `.map`」，不解析任意 sourceMappingURL 或内联 Source Map；即使找到 map，也需要包含非空的 sourcesContent 才能提取源码。

其他当前限制：

- 仅分析顶层文档，不递归展开 iframe 或 Shadow DOM。
- DOM 克隆不会完整保存事件监听器、Canvas 像素及所有表单运行时状态。
- 部分 HTML 内 style 资源路径使用 `../assets/`，与根目录 index.html 的位置不一致，可能需要手动修正。
- 外部 CSS 的嵌套资源按文件名保存，同名文件可能覆盖；不能保证全包资源去重或无冲突。
- 图片开关关闭时仍可能保留部分原始引用，输出包不保证完全离线。
- 字体和大图片会增加下载、打包耗时；界面没有取消按钮或可配置超时。

## 权限与网络请求

| 权限 | 用途 |
| --- | --- |
| `sidePanel` | 打开侧边栏 |
| `tabs` | 读取活动标签页的标题、URL，并监听标签页变化 |
| `scripting` | 向目标页注入分析脚本 |
| `downloads` | 清单已声明；当前 ZIP 下载实现使用临时链接的 download 属性 |
| `<all_urls>` | 在允许的页面执行分析，并请求网页关联资源 |

页面分析、代码格式化、指南生成和 ZIP 打包在浏览器内完成，代码未将提取结果上传到远程处理服务。下载资源会向原站及其资源域名发起请求；侧边栏还通过 Google Fonts 加载 Inter 字体，因此侧边栏本身也存在字体网络请求。

## 目录结构

```text
Pageforge-Extractor/
├── manifest.json
├── service-worker.js      配置点击工具栏图标打开侧边栏
├── content.js             DOM 克隆、资源登记和页面元信息提取
├── sidepanel.html         侧边栏界面
├── sidepanel.css           侧边栏样式
├── sidepanel.js            分析调度、下载、美化、指南生成与打包
├── lib/                   js-beautify 与 JSZip 浏览器文件
├── icons/                 扩展图标
└── README.md
```

核心逻辑见 [content.js](content.js) 和 [sidepanel.js](sidepanel.js)。提取内容的版权及使用权限仍属于原权利人。

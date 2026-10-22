# Seraph-Extensions

**中文** | [English](README.md)

五款可直接加载的浏览器扩展，使用 Manifest V3，提供编码解码、货币换算、网页资源提取、会话数据查看和浏览器环境一致性测试功能。

| 扩展 | 功能 | 文档 |
| --- | --- | --- |
| CodecLens | 扫描网页编码文本，提供高亮、解码卡片和手动编解码工具 | [使用说明](Codeclens/README.md) |
| Currency Converter | 识别网页货币金额，按获取到的汇率换算并显示结果 | [使用说明](Currency-Converter/README.md) |
| PageForge | 将当前网页 DOM 及可获取的前端资源打包为 ZIP，生成 AI 开发指南 | [使用说明](Pageforge-Extractor/README.md) |
| Session Sniffer | 查看 Cookie、Web Storage 和页面会话数据，支持复制与导出 | [使用说明](Session-Sniffer/README.md) |
| GeoMask | 管理身份与域名绑定，分别保存最高 / 最低全局位置配置，展示出口探测与 ASN，支持 Worker CSP 自动兼容 | [使用说明](GeoMask/README.md) |

## 安装

1. 下载并解压本仓库，或使用 Git 克隆仓库。
2. Chrome 打开 `chrome://extensions/`；Edge 打开 `edge://extensions/`。
3. 开启**开发者模式**，点击**加载已解压的扩展程序**。
4. 选择需要安装的扩展子目录，即包含其 `manifest.json` 的目录。
5. 按需分别加载其他扩展。更新文件并重新加载扩展后，刷新目标网页。

每个扩展均可独立加载，无需安装 Node 依赖或构建。GeoMask 最低要求 Chrome 135 或具有对应 API 的 Edge；增强启动还需要开启用户脚本权限。兼容性、访问权限、具体使用步骤和当前限制见对应 README。

## GeoMask 的定位与出口探测

GeoMask 当前版本为 2.6.5。网页定位遵循 Chrome 的真实授权和网站策略：允许后返回配置坐标，拒绝不返回坐标，配置缺失时报告位置不可用，不回退真实定位。关闭定位处理则恢复浏览器原生行为。

2.6.5 修正指纹接口语义：文字测量保留真实 TextMetrics、零宽度及一次参数转换，水平宽度与边界协调处理；Canvas、WebGL、音频和合成 UA-CH 保留原生方法签名与类型校验，Float16 不再被按字节截断，Canvas 导出失败明确报告。保持既有字体测量开关，不包含字体枚举、允许列表或字体绑定。

2.6.4 重整面板：核心地域配置前置，页面 / Worker / 出口状态分别展示，设备与诊断按需展开；本站 Worker 草稿支持保留、撤销及未保存提示，历史后台错误与本次操作结果分开显示。

2.6.3 增加按完整域名保存的 Worker 模式、当前页面配置回执和刷新检查。对禁止 Blob 的站点可直接使用原生 Worker，避免扩展包装导致的重复 CSP 拦截；其内部保留原生时区、语言和指纹。页面连接与脚本注册分开显示，旧页面需要刷新；本站探测分别显示拒绝、接口不存在、超时、重定向等原因。

优先读取目标站点自身的回显；本站回显不可用时明确显示出口未确认，并按已保存的最高 / 最低位置优先级继承配置。两种优先级各保存一组位置。

当前发布不包含 GoogleVideo、ipify、httpbin 或 AWS 回显试用，不通过第三方回显推断其他站点的分流出口。原有全局探测与 GeoIP 查询继续提供参考，不能证明本站实际出口。详见 [GeoMask 使用说明](GeoMask/README.md)。

## 目录

```text
Seraph-Extensions/
├── Codeclens/
├── Currency-Converter/
├── GeoMask/
├── Pageforge-Extractor/
├── Session-Sniffer/
└── README.md
```

仓库保留扩展运行文件、图标、字体及文档所需的预览、演示和本地工具。各扩展的权限与网络行为不同，请参阅对应文档。
# Seraph-Extensions

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

GeoMask 当前版本为 2.6.2。网页定位遵循 Chrome 的真实授权和网站策略：允许后返回配置坐标，拒绝不返回坐标，配置缺失时报告位置不可用，不回退真实定位。关闭定位处理则恢复浏览器原生行为。

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

# Seraph-Extensions

四款可直接加载的浏览器扩展，使用 Manifest V3，分别提供编码解码、货币换算、网页资源提取和会话数据查看功能。

| 扩展 | 功能 | 文档 |
| --- | --- | --- |
| CodecLens | 扫描网页编码文本，提供高亮、解码卡片和手动编解码工具 | [使用说明](Codeclens/README.md) |
| Currency Converter | 识别网页货币金额，按获取到的汇率换算并显示结果 | [使用说明](Currency-Converter/README.md) |
| PageForge | 将当前网页 DOM 及可获取的前端资源打包为 ZIP，生成 AI 开发指南 | [使用说明](Pageforge-Extractor/README.md) |
| Session Sniffer | 查看 Cookie、Web Storage 和页面会话数据，支持复制与导出 | [使用说明](Session-Sniffer/README.md) |

## 安装

1. 下载并解压本仓库，或使用 Git 克隆仓库。
2. Chrome 打开 `chrome://extensions/`；Edge 打开 `edge://extensions/`。
3. 开启**开发者模式**，点击**加载已解压的扩展程序**。
4. 选择需要安装的扩展子目录，即包含其 `manifest.json` 的目录。
5. 按需分别加载其他扩展。更新文件并重新加载扩展后，刷新目标网页。

每个扩展均可独立加载，无需安装 Node 依赖或构建。兼容性、访问权限、具体使用步骤和当前限制见对应 README。

## 目录

```text
Seraph-Extensions/
├── Codeclens/
├── Currency-Converter/
├── Pageforge-Extractor/
├── Session-Sniffer/
└── README.md
```

仓库保留扩展运行文件、图标、字体及文档所需的预览、演示和本地工具。各扩展的权限与网络行为不同，请参阅对应文档。

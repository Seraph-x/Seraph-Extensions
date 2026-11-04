# Seraph-Extensions

**中文** | [English](README.md)

浏览器扩展集合。各扩展独立存放，可按需安装和更新。

## 扩展目录

| 扩展 | 使用说明 |
| --- | --- |
| CodecLens | [Codeclens](Codeclens/README.md) |
| Currency Converter | [Currency-Converter](Currency-Converter/README.md) |
| GeoMask | [GeoMask](GeoMask/README.md) |
| PageForge | [Pageforge-Extractor](Pageforge-Extractor/README.md) |
| Session Sniffer | [Session-Sniffer](Session-Sniffer/README.md) |

各扩展的功能、兼容性、权限、配置方式及限制，请参阅对应使用说明。

## 安装

1. 下载并解压本仓库，或使用 Git 克隆仓库。
2. Chrome 打开 `chrome://extensions/`；Edge 打开 `edge://extensions/`。
3. 开启**开发者模式**，点击**加载已解压的扩展程序**。
4. 选择需要安装的扩展子目录，即包含其 `manifest.json` 的目录。

仓库内的扩展可直接加载，无需安装 Node 依赖或构建。

## 更新

获取仓库最新文件后，在浏览器扩展管理页重新加载对应扩展，再刷新目标网页。

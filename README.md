# Seraph-Extensions

[中文](README_ZH.md) | **English**

A collection of browser extensions. Each extension lives in its own directory and can be installed and updated independently.

## Extension directory

| Extension | Usage guide |
| --- | --- |
| CodecLens | [Codeclens](Codeclens/README.md) |
| Currency Converter | [Currency-Converter](Currency-Converter/README.md) |
| GeoMask | [GeoMask](GeoMask/README.md) |
| PageForge | [Pageforge-Extractor](Pageforge-Extractor/README.md) |
| Session Sniffer | [Session-Sniffer](Session-Sniffer/README.md) |

See each extension's guide for its features, compatibility, permissions, configuration, and limitations.

## Installation

1. Download and unpack this repository, or clone it with Git.
2. Open `chrome://extensions/` in Chrome or `edge://extensions/` in Edge.
3. Enable **Developer mode**, then click **Load unpacked**.
4. Select the extension's subdirectory containing its `manifest.json`.

The extensions in this repository can be loaded directly, without installing Node dependencies or running a build.

## Updates

Get the latest repository files, reload the extension in your browser's extension manager, and refresh the target page.

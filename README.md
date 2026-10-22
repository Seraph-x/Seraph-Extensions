# Seraph-Extensions

[中文](README_ZH.md) | **English**

Five browser extensions that load directly, built on Manifest V3. They cover encoding and decoding, currency conversion, web resource extraction, session data inspection, and browser environment consistency testing.

| Extension | Function | Docs |
| --- | --- | --- |
| CodecLens | Scans pages for encoded text and provides highlighting, decode cards, and manual encode/decode tools | [Usage](Codeclens/README.md) |
| Currency Converter | Detects currency amounts on pages, converts them at fetched exchange rates, and displays the results | [Usage](Currency-Converter/README.md) |
| PageForge | Packages the current page's DOM and retrievable front-end resources into a ZIP and generates an AI development guide | [Usage](Pageforge-Extractor/README.md) |
| Session Sniffer | Inspects Cookie, Web Storage, and page session data, with copy and export | [Usage](Session-Sniffer/README.md) |
| GeoMask | Manages identity and domain bindings, stores separate highest / lowest global location profiles, shows egress probes and ASN, and supports automatic Worker CSP compatibility | [Usage](GeoMask/README.md) |

## Installation

1. Download and unpack this repository, or clone it with Git.
2. Open `chrome://extensions/` in Chrome; open `edge://extensions/` in Edge.
3. Turn on **Developer mode**, then click **Load unpacked**.
4. Select the subdirectory of the extension you want to install — the one containing its `manifest.json`.
5. Load the other extensions separately as needed. After updating files and reloading an extension, refresh the target page.

Each extension loads independently; no Node dependencies or build step are required. GeoMask requires at least Chrome 135, or Edge with the corresponding APIs; enhanced startup also requires user script permission. See each README for compatibility, access permissions, detailed steps, and current limitations.

## GeoMask positioning and egress probing

The current GeoMask version is 2.6.5. Web geolocation follows Chrome's real permission flow and site policy: after permission is granted it returns the configured coordinates; when permission is denied it returns no coordinates; when configuration is missing it reports position unavailable and does not fall back to real geolocation. Turning off geolocation handling restores native browser behavior.

2.6.5 corrects fingerprint interface semantics: text measurement keeps real TextMetrics, zero widths, and a single argument conversion, and handles horizontal width and bounds coherently; Canvas, WebGL, audio, and the synthesized UA-CH keep native method signatures and type validation, Float16 is no longer truncated as bytes, and Canvas export failures are reported explicitly. The existing font measurement toggle is kept; font enumeration, allowlists, and font binding are not included.

2.6.4 reworks the panel: core region configuration comes first, page / Worker / egress status are shown separately, and device and diagnostics expand on demand; the draft for this site's Worker supports keeping, discarding, and an unsaved marker, and historical background errors are shown separately from the results of the current operation.

2.6.3 adds a Worker mode saved per full domain, a configuration receipt for the current page, and refresh checks. Sites that forbid Blob can use the native Worker directly, avoiding repeated CSP blocks caused by the extension wrapper; it keeps native time zone, language, and fingerprints internally. Page connection and script registration are shown separately, and old pages need a refresh; probes for this site separately show reasons such as rejection, missing endpoint, timeout, and redirect.

The target site's own echo is read first; when the echo for this site is unavailable, egress is explicitly shown as unconfirmed, and configuration is inherited according to the saved highest / lowest location priority. Each priority stores its own set of locations.

The current release does not include GoogleVideo, ipify, httpbin, or AWS echo trials, and does not infer other sites' routing egress from third-party echoes. The existing global probe and GeoIP lookups remain available for reference and cannot prove this site's actual egress. See [GeoMask usage](GeoMask/README.md) for details.

## Layout

```text
Seraph-Extensions/
├── Codeclens/
├── Currency-Converter/
├── GeoMask/
├── Pageforge-Extractor/
├── Session-Sniffer/
└── README.md
```

The repository keeps the runtime files of the extensions, along with the icons, fonts, and the previews, demos, and local tools the documentation needs. Each extension has different permissions and network behavior; refer to its own documentation.

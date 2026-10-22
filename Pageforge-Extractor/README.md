# PageForge · Web front-end resource extraction

Packages the current page's DOM snapshot and retrievable resources such as styles, scripts, and images into a ZIP, optionally with an `ai_instructions.md`, for local inspection and continued development.

Current version **1.0.0**, Manifest V3, operated through the browser side panel. Requires a browser that supports `chrome.sidePanel` and `setPanelBehavior`. This directory already contains the browser files of js-beautify and JSZip; no dependencies or build step required.

Extraction covers the currently loaded page and the resources the code can discover and download; whether the output package runs standalone depends on the original site's script, API, and resource dependencies.

## Install and update

1. Open `chrome://extensions/` in Chrome; open `edge://extensions/` in Edge.
2. Turn on **Developer mode**, then click **Load unpacked**.
3. Select the current `Pageforge-Extractor/` directory — the one containing [manifest.json](manifest.json).
4. Open the target page, click the PageForge icon in the toolbar, and open the side panel.

After updating files, reload the extension on the extensions page, then reopen the side panel and refresh the target page.

## Extracting the current page

1. Wait for the target page to finish loading. Collapsed areas, lazy-loaded images, or lists you need should be expanded and scrolled into view manually first.
2. Confirm the title and URL under **Target Webpage** in the side panel.
3. Choose resource types and cleanup options as needed.
4. Enter a package name in **Package Name**; there is no need to add `.zip`.
5. Click **Forge Code Package** and watch the progress and `extraction.log`.
6. When finished, the browser starts a ZIP download; the save location follows your browser download settings.

Switching tabs updates the side panel's target information and suggests a new package name again. Confirm the current tab and file name once more before starting.

### Extraction options

| UI option | Default | Actual effect |
| --- | --- | --- |
| HTML Code | On and cannot be turned off | Outputs `index.html` generated from a clone of the current DOM |
| Stylesheets (CSS) | On | Downloads registered external stylesheets and generated dynamic style files |
| Scripts (JS) | On | Downloads external scripts and rewrites src; when off, external script tags are removed, while inline scripts may still remain |
| Images & Assets | On | Downloads registered images, srcset and picture resources, and some style-referenced resources |
| Clean HTML | On | Removes some ads, trackers, and third-party widgets by built-in selectors, and removes noscript and ordinary HTML comments |
| Generate AI Agent Guide | On | Outputs `ai_instructions.md` |

"Clean HTML" is a cleanup rule based on a limited set of selectors and does not cover all ads or tracking code. Turning off the CSS option also does not fully remove the rewritten style references in the HTML, and turning off the images option does not prevent nested resources such as fonts and backgrounds inside external CSS from being downloaded. These toggles therefore cannot guarantee a page with no style, script, or image requests at all.

## Package contents

The following is a structure example; each directory appears only when the corresponding resources exist, and file names are generated in resource registration order:

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
├── src/                    Original sources contained in Source Maps
└── ai_instructions.md      Present when the guide generation is enabled
```

- **HTML**: clones the current document, cleans content and registers resources according to the settings, rewrites some references, then formats the result.
- **CSS**: downloads external stylesheets; reads accessible CSSOM dynamic rules to generate `css/dynamic_styles.css`; tries to download fonts, backgrounds, and other resources referenced by `url()` in external CSS.
- **JavaScript**: downloads external script files, beautifies the code, and records minification or obfuscation characteristics.
- **Images and other assets**: handles img, image inputs, srcset, picture source, and some inline background references.
- **Source Map**: appends `.map` directly to the original URL of external CSS and JS and tries to fetch it; when `sourcesContent` is present, the sources are written to `src/`.

When a primary resource download fails, the log records the error and an explanatory error text is written to the corresponding local path. When a nested CSS resource download fails, a warning is logged and the original reference is kept. **A successfully generated ZIP does not mean all resources downloaded successfully**; check the log and the output files.

### Viewing the local page

Unpack the ZIP, open a terminal in the unpacked directory, and run:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/index.html` in a browser. This only serves static files and does not fill in the original site's backend, authenticated APIs, or runtime environment.

### What the AI guide contains

`ai_instructions.md` is generated locally by the extension and mainly contains:

- Page title, original URL, generation time, and a summary of semantic layout tags.
- A list of resource files and some original addresses.
- CSS variables whose names contain color / brand / theme, extracted from readable `:root` rules.
- A JavaScript readability report, including minification and obfuscation characteristics and Source Map findings.
- Handling hints for suspicious scripts and prompts for continuing to modify the page.

Obfuscation judgments are based on heuristics such as identifiers and line length; they do not perform full deobfuscation and cannot prove that the code is safe. The guide's file list comes from resource registration and may include items whose download was turned off or failed; rely on the actual files in the ZIP and the log.

## FAQ and limitations

**The button shows Extraction Unavailable.** There is currently no page to process, or you are on a browser-internal page, extension page, or another restricted environment. Switch to a normal HTTP(S) page and try again.

**"Failed to communicate with page" appears.** The extension first tries to inject its analysis script. If communication still fails, refresh the target page, confirm the extension has access to the site, and retry.

**Many resources show Failed to retrieve.** A resource may not exist, may require login credentials, or may be restricted by the server. The extension's own resource requests use `credentials: omit` and do not automatically carry the page's login cookies; the DOM of a logged-in page can be cloned, but its protected resources may not be downloadable again.

**No styles locally, missing images, or a blank page.** Check the log and the generated files. The current implementation only rewrites some references: it does not recursively bundle JS imports, dynamically loaded scripts, CSS imports, or all runtime dependencies, and it does not save API responses, WebSocket data, or server-side logic. Content already rendered on the page may make it into the DOM snapshot, but later interaction may still depend on the original site.

**There is no src directory.** Only "original resource URL + `.map`" is probed; arbitrary sourceMappingURL values and inline Source Maps are not parsed. Even when a map is found, it must contain non-empty sourcesContent for sources to be extracted.

Other current limitations:

- Only the top-level document is analyzed; iframes and Shadow DOM are not expanded recursively.
- The DOM clone does not fully preserve event listeners, Canvas pixels, or all form runtime state.
- Some HTML inline style resource paths use `../assets/`, which does not match the location of `index.html` in the root directory and may need manual fixing.
- Nested resources in external CSS are saved by file name, so files with the same name may overwrite each other; the package cannot guarantee deduplicated or conflict-free resources.
- When the images toggle is off, some original references may remain, so the output package is not guaranteed to be fully offline.
- Fonts and large images increase download and packaging time; the interface has no cancel button and no configurable timeout.

## Permissions and network requests

| Permission | Purpose |
| --- | --- |
| `sidePanel` | Opens the side panel |
| `tabs` | Reads the active tab's title and URL, and watches for tab changes |
| `scripting` | Injects the analysis script into the target page |
| `downloads` | Declared in the manifest; the current ZIP download implementation uses the download attribute of a temporary link |
| `<all_urls>` | Runs analysis on allowed pages and requests resources associated with the page |

Page analysis, code formatting, guide generation, and ZIP packaging all happen in the browser, and the code does not upload extraction results to a remote processing service. Downloading resources makes requests to the original site and its resource domains; the side panel also loads the Inter font from Google Fonts, so the side panel itself makes a font network request.

## Directory structure

```text
Pageforge-Extractor/
├── manifest.json
├── service-worker.js      Configures the toolbar icon click to open the side panel
├── content.js             DOM cloning, resource registration, and page metadata extraction
├── sidepanel.html         Side panel interface
├── sidepanel.css          Side panel styles
├── sidepanel.js           Analysis scheduling, downloads, beautifying, guide generation, and packaging
├── lib/                   js-beautify and JSZip browser files
├── icons/                 Extension icons
└── README.md
```

Core logic is in [content.js](content.js) and [sidepanel.js](sidepanel.js). Copyright and usage rights of the extracted content remain with the original rights holders.

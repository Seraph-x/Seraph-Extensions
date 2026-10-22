# CodecLens · Page encoding detection and decoding

Automatically scans page text for encoded data, marks it in place, and shows the decoded result in a floating card. You can also paste text into the toolbar popup and pick a decoder manually.

Current version **1.2.0**, Manifest V3, with a manifest-declared minimum Chrome version of **105**. This directory loads directly; no dependencies or build step required.

## Install and update

1. Open `chrome://extensions/` in Chrome; open `edge://extensions/` in Edge.
2. Turn on **Developer mode**, then click **Load unpacked**.
3. Select the current `Codeclens/` directory — the one containing [manifest.json](manifest.json).
4. Open or refresh the target page and wait for the automatic scan; the options page opens on first install.
5. Click the toolbar icon to see page results, or open **Manual decode**.

The local demo page is at [demo/demo.html](demo/demo.html). To open it in a browser, first allow access to file URLs in the extension details.

After updating files, reload the extension on the extensions page and refresh the page; re-injecting scripts into existing pages is covered below.

## Viewing page results

- Hover over a marked encoded fragment to see its type, detection score, original text, and decoded result.
- Copy the result from the floating card; multi-layer encodings show the chained decode path, and `Esc` closes the card.
- Open the **Page results** tab in the popup to see the match count, scanned node count, and elapsed time.
- Use the type / content filter boxes to narrow results, click a result to locate it on the page, or click **Copy all**.
- Click the rescan button at the top of the popup to process the current page again.

Detection scores come from heuristics such as format and readability and are not statistical probabilities. Binary data or short strings may not be detected automatically; specify a decoder instead.

### Three display modes

| Setting | Current behavior |
| --- | --- |
| Highlight marks (default) | Uses the CSS Custom Highlight API where available; falls back to span wrapping |
| Highlight and append the decoded result after the original | Keeps the encoded original and appends the decoded text |
| Record only, show no marks | The current implementation clears results and stops page scanning; it does not keep recording in the background |

When the highlight API is available the original text needs no wrapping; append mode and span highlighting modify the page DOM. On sites that depend on node structure, turn scanning off or add the site to the blocklist.

## Manual decoding and supported formats

Open the **Manual decode** tab in the popup, paste text, choose automatic detection or a specific decoder, then click **Run**. You can also select text on a page and use "CodecLens: Decode selected text" from the context menu. The link context menu tries to extract encodings from common redirect parameters.

| Format | Default state for automatic page detection | Notes |
| --- | --- | --- |
| Base64 / Base64URL | On | For example `aGVsbG8gd29ybGQ=` → `hello world` |
| Base58 / Base32 / Hex | On | Hex example: `48656c6c6f` → `Hello` |
| JWT | On | Shows header, payload, signature fields, and time fields; does not verify the signature |
| URL encoding | On | For example `%E4%BD%A0%E5%A5%BD` → `你好` |
| HTML entities | On | For example `&lt;div&gt;` → `<div>` |
| Unicode escapes | On | For example `\u4f60\u597d` → `你好` |
| Data URI | On | Page scanning can extract and decode the payload; the manual tool currently has no dedicated entry for a complete Data URI |
| Ascii85 / ROT13 | Off | Automatic detection can be enabled in settings, or specify the decoder directly |

The manual tool provides two reverse operations, **Base64 encode** and **URL encode**. The popup currently has a "Base64URL decode" option, but it is not bound to a matching decoder export and reports unsupported when selected; use automatic detection or Base64 decoding instead.

### Compressed content

Format markers for GZIP, ZLIB, BZIP2, and ZSTD can be recognized in the decoded bytes. When the **Expand compressed stream** button appears, you can try decompressing in the page's floating card.

The current decompression implementation only supports GZIP and deflate formats such as ZLIB when the browser's `DecompressionStream` is available. **BZIP2 and ZSTD can only be recognized, not decompressed**; clicking expand shows an unsupported error. Compression layers must be expanded manually; not all decompression and subsequent decoding happens automatically.

## Adjusting scan settings

Click the gear in the popup, or right-click the extension icon and open options. After changing regular scan settings, click **Save settings**; **Restore defaults** resets them.

| Setting | Default | Effect |
| --- | --- | --- |
| Enable scanning | On | Globally controls page scanning; the manual tool still works when off |
| Display mode | Highlight marks | Highlight, append results, or turn page scanning off |
| Watch dynamic content | On | Rescans when the page adds or changes text |
| Scan Shadow DOM | On | Scans accessible open shadow roots |
| Skip code blocks | Off | Excludes pre / code content when on |
| Minimum candidate length | 12 | Adjustable from 6–40 on the options page; shorter candidates are more prone to false positives |
| Maximum chained decode layers | 4 | Adjustable from 1–8 on the options page |
| Detection types | 10 on | 12 independent type switches, with Ascii85 and ROT13 off by default |
| Site blocklist | Empty | One domain per line; asterisk wildcards supported |

In the blocklist, `example.com` matches that domain and its subdomains, while `*.example.com` matches subdomains. Excluded pages are not scanned automatically, but manual decoding from the context menu or the popup tools can still be tried.

The **Self-test** area of the options page can load samples or paste data to see detection and chained decoding results under the current configuration.

### Shortcuts

| Default shortcut | Effect |
| --- | --- |
| `Alt+Shift+D` | Temporarily toggles the scan state of the content script in the current tab; not written to global settings |
| `Alt+Shift+R` | Re-injects the script into open pages that allow injection |

Shortcuts are assigned by the browser; if one conflicts, adjust it in the shortcut settings on the extensions page.

## Page navigation and script updates

The extension watches dynamic DOM changes, same-page URL changes, and back/forward cache restores. **Auto re-inject on navigation**, on by default, checks the content script when a tab finishes loading or is switched to and re-injects it if necessary.

The **Developer** area of the options page provides:

| Feature | Default state / purpose |
| --- | --- |
| Auto hot reload | Off by default; when on, periodically compares fingerprints of lib, content scripts, and content styles, and re-injects the affected pages when they change |
| Auto re-inject on navigation | On by default; checks whether the page script is available |
| Re-inject all pages | Unloads old instances and loads the current script; the page itself is not refreshed |
| View status | Shows the version, script fingerprint, and page connection state |
| Reload extension | For use after changing background.js or manifest.json; tries to restore page injection after the restart |

After changing popup or options page files, reopen the corresponding interface; re-injecting the page content script does not refresh those interfaces.

## FAQ and limitations

**No marks or results.** Confirm that global scanning is on, the display mode is not "Record only", and the site is not on the blocklist. Check the detection types and minimum length, and try rescanning; short strings, random bytes, or low-readability results may be filtered by the rules.

**Stops working after navigating or updating.** First try `Alt+Shift+R` or the re-inject button on the options page. If there is still no response, refresh the page and confirm the browser allows the extension to access that site.

**The local demo page does not work.** Allow access to file URLs in the extension details, then open or refresh the demo page.

Browser-internal pages, extension stores, and other restricted pages cannot be injected normally. The current automatic script only injects into the top-level page and does not cover iframes; closed shadow roots cannot be scanned. Scanning of large pages is limited by node and text length and is not guaranteed to cover all text.

## Permissions and data

| Permission | Purpose |
| --- | --- |
| `storage` | Saves scan configuration and developer settings |
| `contextMenus` | Provides context menus for selected text, link decoding, and scanning |
| `clipboardWrite` | Copies decode results |
| `activeTab` / `scripting` | Operates on the current page and re-injects the content script |
| `<all_urls>` | Automatically recognizes encoded content on pages it is allowed to access |

Encoding and decoding happen locally in the browser; page text and decode results are not sent to a remote service. Regular settings are stored in `chrome.storage.sync`, while states such as developer switches are stored in local storage; hot reload reads the extension's own local script files.

## Directory structure

```text
Codeclens/
├── manifest.json
├── icons/                 Extension icons
├── demo/demo.html         Local demo page
├── src/
│   ├── background.js      Context menus, shortcuts, badge, and script injection
│   ├── lib/               Configuration utilities, codecs, and detection logic
│   ├── content/           Page scanning, highlighting, floating card, and content styles
│   ├── popup/             Page results and manual tools
│   └── options/           Scan settings, self-test, and developer actions
└── README.md
```

Core implementation: [codecs.js](src/lib/codecs.js), [detector.js](src/lib/detector.js), and [content.js](src/content/content.js). The version follows the manifest; the options page footer still keeps the old version text.

## License

Local project — use and modify as you like.

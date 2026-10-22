# Automatic currency conversion · Currency Converter

Automatically detects currency amounts on pages, converts them to a chosen currency at the fetched exchange rate, and supports replacing the original text, appending the result, and hover inspection.

Current version **1.1.5**, Manifest V3, for Chrome, Edge, and other browsers that support this extension format. Enabled by default, target currency **CNY**, display mode **Replace original text**. This directory loads directly; no dependencies or build step required.

## Install and update

1. Open `chrome://extensions/` in Chrome; open `edge://extensions/` in Edge.
2. Turn on **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the current `Currency-Converter/` directory — the one containing [manifest.json](manifest.json).
4. Open or refresh the target page and wait for the rates to load and the page scan to finish.
5. Click the extension icon in the toolbar to set the target currency and display mode; you can pin the icon to the toolbar from the browser's extensions menu.

After updating or changing files, click **Reload / Refresh** for the extension on the extensions page, then refresh the target page.

## Viewing conversion results

The extension scans page text automatically and watches for newly added content and price changes. Amounts already in the target currency are skipped by default.

| Display mode | Page effect | When to use |
| --- | --- | --- |
| Replace original text (default) | `$100` → `¥724.00` | Read converted prices directly |
| Original + conversion | `$100 (¥724.00)` | Check the original price and the result together |
| Hover only | Keeps `$100` and shows a conversion card on hover | Keep the original amounts on display |

The above only illustrates the display effect, assuming `1 USD = 7.24 CNY` and that the original amount is recognized as USD; actual results depend on the data source, cache, currency detection, and decimal settings.

Hovering over a processed amount shows the original price, source currency, conversion result, target currency, the rate used, and the data source. Append mode places a result label after the original price and replaces spaces inside the original with non-breaking spaces, so amounts are less likely to wrap in the middle.

### Using the toolbar popup

The top of the popup shows the current domain, and the bottom shows the page's run state or the number of converted amounts. Settings and actions are all in the popup.

| Action | Effect |
| --- | --- |
| Enable switch at the top | Enables or disables conversion globally; disabling restores processed amounts |
| Rescan | Reprocesses the page with the current settings and resumes scanning paused by a manual restore |
| Restore original | Restores the original amounts on the current page and pauses automatic rescanning, without changing the global enabled state |
| Refresh rates | Forces a rate refetch and reprocesses the current page |
| Restore default settings | Restores the default configuration and reprocesses the current page |
| Clear rate cache | Clears the cache, immediately refetches rates, and reprocesses the current page |
| Diagnostics | Shows the current page's settings, run state, rate information, and scan statistics |

Settings are saved to the browser's extension sync storage, and other open pages running the content script also receive the setting changes. To disable a single site, use the blocklist; the top switch controls all sites.

## Adjusting settings

### Basic settings

| Setting | Default | Notes |
| --- | --- | --- |
| Enable conversion | On | Controls whether the extension converts amounts |
| Target currency | CNY | Chosen from the built-in currency list; which currencies can actually be converted depends on whether the current rate source provides them |
| Display mode | Replace original text | Can be changed to Original + conversion or Hover only |
| Decimal places | Auto | Rounds when the absolute result reaches 1000, otherwise keeps 2 decimals; 0–4 can also be specified |
| Output style | Symbol | The popup offers symbol, code, and symbol + code; see below for the current page output limitation |

### Advanced settings

| Setting | Default | Notes |
| --- | --- | --- |
| Scope | Convert on all sites | Can be changed to whitelisted sites only |
| Blocklist | Empty | One domain or URL per line; matching sites are not converted |
| Whitelist | Empty | Used only when the scope is set to "Whitelisted sites only" |
| Rate cache duration | 6 hours | 1, 6, 12, or 24 hours; see below for the current limitation of the "Refresh on every open" option |
| Highlight converted amounts | On | Adds a light highlight to processed amounts |
| Mark same-currency amounts too | Off | When on, also processes amounts whose source currency matches the target currency |
| Convert unsigned numbers as the specified currency | Off, preset USD | The UI offers a currency selector; see below for the current limitation on plain-number detection |

### Configuring site lists

Enter one rule per line. For example:

```text
example.com
*.shop.example.org
https://store.example.net/products
```

- `example.com` matches that domain and its subdomains.
- `*.shop.example.org` matches its subdomains, not `shop.example.org` itself.
- A full URL is matched by hostname only; the path does not participate, so the example above matches `store.example.net`.
- The blocklist takes precedence over the whitelist. With "Whitelisted sites only" selected and an empty whitelist, no site is converted.

## Amount detection coverage

Built in: **93 currencies and 188 common symbol forms**, plus region-specific symbols added according to page language and domain.

| Type | Examples |
| --- | --- |
| Currency symbols | `$100`, `€49.99`, `Rp 6.175`, `249.000₫` |
| Currency codes before or after the amount | `USD 120`, `120 USD`, `$7.19 USD` |
| Number formats from different regions | `1,234.56`, `1.234,56`, `1 234,56`, `1'234.56` |
| Chinese magnitude units | `¥18万`, `CNY 3.5亿` |
| English magnitude abbreviations attached to numbers | `$10k`, `USD 2.5m`, `EUR 1bn` |

Shared symbols such as `¥` and `$` are resolved using page language, region information, and some typographic cues; when an explicit currency code sits next to the symbol, the code usually wins. Ambiguity can still remain, so check the source currency in the hover card.

Code blocks, input fields, editable regions, common code editors, and formula areas are skipped by default. Amounts inside images and Canvas are not scannable text.

## Rates and caching

The background worker tries the data sources configured in the code in the following order, requesting the next one only after the previous one fails:

1. The jsDelivr address for currency-api.
2. The Cloudflare Pages mirror of currency-api.
3. `open.er-api.com`.
4. `frankfurter.app`.

All rates are based on USD, and cross rates are used between currencies. Cached rates from the last 6 hours are used by default; they are refetched when the cache expires or on a manual refresh. If every data source fails and an old cache exists, the old cache continues to be used and the popup rate row is marked "cached". Conversion cannot be completed without a usable rate.

The popup rate row shows the rate for `1 USD` against the target currency, the fetch time, and the data source. The fetch time is when the data was pulled locally and does not represent when the market rate was updated; rates also exclude payment platform fees and settlement spreads.

## FAQ and current limitations

**No conversion results after installing.** Refresh the target page and check the status at the bottom of the popup. Confirm the extension is enabled, the site is not excluded by the lists, rates have been fetched, and the page contains recognizable amounts. Amounts already in the target currency are skipped by default.

**"Not running on this page" is shown.** After installing or reloading the extension, open pages must be refreshed. Browser-internal pages, extension management pages, and other restricted pages cannot have the content script injected normally; local file pages require allowing access to file URLs in the extension details.

**Still nothing after changing the lists or re-enabling.** If the page was disabled or excluded by the lists when it first loaded, the content script skips engine initialization. Adjust the settings and refresh the page so the engine starts again.

**Rate fetching fails or "cached" is shown.** Check the network and click "Refresh rates"; you can also clear the cache and refetch in advanced settings. Different data sources cover different currency sets, and an amount is not converted when any required currency rate is missing.

**Automatic conversion stops after clicking "Restore original".** That is a pause state for the current page; click "Rescan" to resume. To keep it disabled, turn off the top switch or add the site to the blocklist.

**The page still shows the currency symbol after changing the output style.** The current version saves that option, but the page detection logic does not pass `symbolStyle` to the formatting function, so page results still use the default symbol style.

**"Refresh on every open" still uses the cache.** That option is stored as `0`, which the background currently treats as the default 6 hours. Click "Refresh rates" to update immediately.

**Plain numbers still do not change after enabling unsigned conversion.** The current detection function skips such results before handling unsigned matches, so the option does not take effect yet.

In addition, the current version only processes the top-level page and does not scan text inside iframes or Shadow DOM. Replace and append display modes modify the page DOM, so sites that depend on exact text or node structure may run into compatibility issues; switch to Hover only, or add the site to the blocklist.

## Permissions and data

| Permission or storage | Purpose |
| --- | --- |
| `storage` | Saves settings, the rate cache, and the expanded state of advanced settings |
| `activeTab` | Works with the popup to get the active tab and communicate with the content script |
| `<all_urls>` | Injects the scan script into allowed pages and makes requests to rate sources |
| `chrome.storage.sync` | Stores conversion settings; can sync with the browser account's sync configuration |
| `chrome.storage.local` | Stores the rate cache and popup UI state |

Amount detection and conversion happen in the browser. The extension's external requests are used to fetch rates; page text and recognized amounts are not uploaded, and no API key needs to be configured. The popup uses the local fonts in `fonts/`.

## Directory structure

```text
Currency-Converter/
├── manifest.json          Extension declaration, permissions, content script load order
├── background.js          Background rate requests, caching, and message handling
├── content.js             Page initialization, settings sync, and conversion scheduling
├── popup.html             Toolbar popup structure
├── popup.css              Popup styles and local font declarations
├── popup.js               Popup settings, actions, and run state
├── lib/                   Amount detection, default configuration, rates, message coordination, and page UI modules
├── icons/                 Extension icons
├── fonts/                 Local fonts
└── README.md
```

The conversion core is in [lib/core.js](lib/core.js), page scanning and restoration in [lib/engine.js](lib/engine.js), rate sources and cache policy in [lib/rates.js](lib/rates.js), and default configuration and site matching rules in [lib/defaults.js](lib/defaults.js).

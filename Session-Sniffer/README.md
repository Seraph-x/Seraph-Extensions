# Session Sniffer · Page session data inspection and export

Inspect the current tab's Cookies (including HttpOnly), localStorage, sessionStorage, and document.cookie; copy a Cookie header, export JSON, and enumerate cookies accessible through browser APIs.

Current version **1.0.0**, Manifest V3, loadable in Chrome, Edge, and other browsers that support the required extension APIs. This directory needs no dependencies or build step.

![Light interface](preview-light.png)
![Dark interface](preview-dark.png)

## Install and capture

1. Open `chrome://extensions/` in Chrome; open `edge://extensions/` in Edge.
2. Turn on **Developer mode**, then click **Load unpacked**.
3. Select the current `Session-Sniffer/` directory — the one containing [manifest.json](manifest.json).
4. Open the target site, click the extension icon in the toolbar, and wait for the capture to finish.
5. After the page's login state or storage changes, click **Refresh** in the popup to capture again.

After updating files, reload the extension on the extensions page and reopen the popup; the page-side script updates after refreshing the page.

## Viewing captured data

| Tab | Content | Scope |
| --- | --- | --- |
| Cookies | Name, value, domain, path, and flags such as HttpOnly, Secure, SameSite, and partition | The initial capture uses the cookies returned by chrome.cookies.getAll({ url }) |
| localStorage | Stored key/value pairs | Top-level document of the current tab |
| sessionStorage | Stored key/value pairs | Top-level document of the current tab |
| Raw | JSON data | The current page capture snapshot; does not change with table filtering or the full-store scan |

Cookies are read through the browser extension API and can include HttpOnly data; document.cookie only contains what page scripts can read. Web Storage is read by a function injected into the main world of the top-level page; data inside iframes is not captured.

### Table filtering and the full-store scan

- The filter box does case-insensitive substring matching on cookie name, domain, path, and value.
- **Partitioned only** keeps only entries with a partitionKey in the table.
- **Full-store scan** calls chrome.cookies.getAll({}) and switches the cookie table's data source to the set returned by that call; localStorage, sessionStorage, and the raw snapshot keep the current page capture.
- Clicking **Refresh** exits the full-store view and captures the current page again.

"Full store" means this API call is not limited by the current URL; it does not mean every separate cookie store or every partitioned context has been explicitly enumerated.

| Sort option | Current rule |
| --- | --- |
| Send order | Longer path first; when lengths are equal, longer domain first |
| Domain + name | Sorted lexicographically by domain, then name |
| Raw | Keeps the existing order of the current data source; domain-related sorting was already done during capture and the full-store scan |

"Send order" is an approximate rule of the current implementation and is not guaranteed to match the actual cookie order in browser requests.

## Copy and export

Different buttons use different data ranges, so **the entries you see in the table are not necessarily the entries that get exported**.

| Action | Output | Data currently used |
| --- | --- | --- |
| Copy JSON | Current page snapshot JSON | The current page capture, unaffected by table filtering or the full-store scan |
| Copy Cookie header | name=value; name2=value2 | The full-store scan result if any, otherwise the current page cookies; can be filtered by send conditions, but does not use the text search or the Partitioned table filter |
| Copy Netscape | Tab-separated cookie.txt content | Current page cookies; does not use the full-store scan result or table filters |
| Export JSON | session_domain_timestamp.json, with a save dialog | The same current page snapshot as Copy JSON |
| Save snapshot | Writes to extension local storage | The current page snapshot; overwrites the previously saved content |

The JSON contains capturedAt, url, origin, cookies, localStorage, sessionStorage, and documentCookie. The current interface has no buttons for loading historical snapshots, listing snapshots, importing, or restoring a login state; export separate JSON files when you need to keep multiple capture results.

The Netscape format works with tools that support cookie.txt; it is not JSON that Puppeteer can use directly, and it cannot fully preserve extended fields such as SameSite and Partition key. For the Puppeteer format, use the command-line conversion tool described below.

## Copying a Cookie header for target request conditions

1. Capture the current page first; if the target API is on another path or subdomain, click **Full-store scan** first to widen the candidate range.
2. Fill in the **Target URL**; when left empty, the URL of the currently captured page is used.
3. Fill in the **Top-level site**; when left empty, the current page origin is used.
4. Choose the HTTP method and set **Top-level navigation** according to the actual scenario.
5. Keep **Only send cookies visible to this page** checked and click **Copy Cookie header**.

The current filter function checks HTTPS/Secure, expiry time, domain, path, SameSite, partition key, and the __Host- / __Secure- prefix constraints. After unchecking "Only send cookies visible to this page", the copied header uses all cookies in the current candidate set.

**This is a candidate header computed from the input conditions, not a packet capture of what the browser actually sent.** The extension does not monitor network requests; the target URL input only participates in filtering and does not automatically make a request or re-capture cookies for that URL. The current "Only send cookies visible to this page" option also only controls the copied Cookie header and is not applied to the table, JSON, or Netscape output.

### Current filtering limitations

- Domain checks do not use the cookie's hostOnly field and may include a cookie that belongs only to a specific host in a subdomain request.
- The SameSite branch compares None / Lax / Strict directly without normalizing the naming and casing of browser return values, so cross-site filtering may be inaccurate.
- Same-site checks use a built-in limited suffix table and do not fully handle protocol differences or the browser's other sending policies.
- It cannot reproduce, from the creation time, the temporary sending exception for new cookies that do not explicitly declare SameSite; sorting also does not use the creation time.
- Partition keys are compared approximately by top-level registrable domain and cannot cover all partitions and third-party cookie policies.
- An invalid target URL makes the filter function return the unfiltered set; use a valid full HTTP(S) URL.

To confirm which cookies a specific request actually carried, rely on the request in the browser's Network panel.

## Local command-line tools

Two standalone scripts are kept in the directory and require Node.js on the machine. The commands below run inside `Session-Sniffer/`; dump.json, before.json, and after.json all refer to actual JSON files exported from the popup.

### Finding candidate login cookies and converting formats

[auth-detect.mjs](auth-detect.mjs) supports:

```bash
node auth-detect.mjs list dump.json
node auth-detect.mjs curl dump.json
node auth-detect.mjs header dump.json
node auth-detect.mjs puppeteer dump.json
node auth-detect.mjs diff before.json after.json
```

- list ranks candidates by features such as name, HttpOnly, Secure, value length, and shape.
- curl and header prefer candidates whose score reaches the threshold; when there are no candidates they use all cookies in the input file and do not apply the target send filtering from the popup.
- puppeteer converts the input cookies into the corresponding JSON fields.
- diff compares by domain, path, and name to find added entries or entries whose value changed; it does not compare all attributes and partition contexts.

Differences before and after login and the scores are only leads for locating credentials; a single change alone cannot confirm that an item is the login credential. The scripts generate commands or format data and do not themselves sign in or make requests.

### Inspecting the byte structure of a packed cookie

[decode-cookie.js](decode-cookie.js) can Base64URL-decode a colon-separated packed value and try to display protobuf wire-format fields:

```bash
node decode-cookie.js --from-json dump.json COMPASS
```

Replace COMPASS with a cookie name that actually exists in the input file. The tool does not hold the site's protobuf schema and does not guarantee that it can explain every field's meaning or every cookie format.

## FAQ

**localStorage or sessionStorage is empty.** The page may simply not have written data, or injection permissions or the page environment may limit it. Only the top-level document is read; IndexedDB, Cache Storage, and iframe storage are not read.

**The cookie count in the JSON did not increase after a full-store scan.** Full-store results are only used for the table and the copied Cookie header; JSON, Netscape, and save snapshot still use the current page capture.

**The table count does not change after changing the target URL or checking "Only send cookies visible to this page".** The current send filtering applies only to copying the Cookie header; the table is filtered by the search box and the Partitioned condition.

**The capture reports complete, but the data looks incomplete.** The current page only fetches cookies by URL, subject to permissions and the cookie store scope; restricted pages may also block injection. The complete status only means the capture flow finished and does not guarantee that every data type was read successfully.

Browser-internal pages, extension stores, and other pages that forbid injection cannot have page storage read normally. There is currently no cookie editing, importing, or automatic login restoration.

## Theme and additional docs

The theme button at the top cycles **Follow system → Light → Dark**, and the choice is saved in extension local storage. The interface uses the local fonts in fonts/.

[preview.html](preview.html) is a static interface preview you can open directly; it uses sample data and performs no real capture. It supports the theme=light / dark and tab=cookies / local / session / raw query parameters.

| Doc | Content |
| --- | --- |
| [COOKIE-BASICS.md](COOKIE-BASICS.md) | Cookie attributes, purposes, and comparison with other storage |
| [COOKIE-VS-SESSION.md](COOKIE-VS-SESSION.md) | The relationship between cookies and server-side sessions |
| [AUTH-COOKIE.md](AUTH-COOKIE.md) | Using snapshot differences before and after login to help locate credentials |
| [THEME.md](THEME.md) | Notes on fonts, color palette, layout, and icons |

## Permissions and data

| Permission | Purpose |
| --- | --- |
| cookies / `<all_urls>` | Reads cookies within the authorized scope and supports enumeration not limited by the current URL |
| tabs / activeTab | Gets the current tab and its URL |
| scripting | Injects a function to read the top-level page's Web Storage and document.cookie |
| storage | Saves the most recent snapshot and theme preference |
| downloads | Saves JSON as a local file |

The current extension and command-line scripts make no remote uploads or active network requests. Copied results go to the system clipboard, exported data is written to the chosen file, and saved snapshots are written to chrome.storage.local. The data may contain credentials for the current session and should be used only with accounts and environments that you own or are authorized to use.

## Directory structure

```text
Session-Sniffer/
├── manifest.json
├── background.js          Cookie reading, main-world storage capture, and local snapshot saving
├── content.js             PING_STORAGE message channel; the current popup capture flow does not call it
├── popup.html / popup.css / popup.js
├── auth-detect.mjs        Cookie scoring, diffing, and format conversion
├── decode-cookie.js       Byte structure analysis of packed values
├── preview.html           Static interface preview
├── preview-light.png / preview-dark.png
├── fonts/                 Local fonts
├── icons/                 Extension icons and documentation images
├── COOKIE-BASICS.md / COOKIE-VS-SESSION.md / AUTH-COOKIE.md / THEME.md
└── README.md
```

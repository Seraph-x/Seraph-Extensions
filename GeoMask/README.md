# GeoMask 2.6.5

Configure time zone, language, geolocation, and some device fingerprints per site, for browser environment consistency testing. Supports Manifest V3 on Chrome / Edge, and requires at least Chrome 135 or Edge with the corresponding APIs.

The extension does not provide a proxy, does not change your IP, does not isolate cookies, and does not guarantee that sites cannot detect it or that accounts are not linked.

The current release keeps this site's echo and global location priority, and does not include GoogleVideo, ipify, httpbin, or AWS echo trials. The existing global egress probe and GeoIP lookup remain available.

## 2.6.5 Fingerprint interface semantics

- The existing `fp.fonts` text measurement toggle continues to be used; no font enumeration, font allowlist, or per-domain font binding is added, and saved user toggles are not modified.
- `measureText` validates the receiver, missing arguments, and Symbol through the native interface and performs a single WebIDL string conversion; it returns a real `TextMetrics`, preserving the prototype, native getter type validation, and object property shape.
- Native zero widths stay zero. Noise is generated from the native horizontal measurement, so equivalent font fallbacks, whitespace normalization, and other cases that produce the same measurement do not yield different perturbation because of a CSS font name or the form of the input object.
- Width and the horizontal left and right bounds use the same scale factor, and vertical metrics stay native; the result is a snapshot taken at measurement time and is not rewritten by later seed or toggle changes. New measurements use the new configuration.
- DOM Canvas, OffscreenCanvas, and the covered Worker share the same text measurement rules. With perturbation enabled, values can still differ from real glyph pixels and DOM layout; this is not the same as a uniform or hidden font environment.
- The Canvas, WebGL, audio, device getter, and synthesized UA-CH wrappers changed here keep native function targets, so method names, argument counts, non-constructibility, and existing receiver validation do not change because of a plain JavaScript wrapper function. Native UA-CH mode still does not modify the corresponding descriptors.
- Canvas export validates the object with the native size getter, converts the MIME type once, and reads the size after the conversion side effects; native empty-canvas results, asynchronous Blob callbacks, and cross-origin canvas SecurityError are preserved. Clone, pixel-read, or encode failures throw explicitly instead of silently falling back to an unperturbed export.
- Float16 pixel channels are perturbed at the least significant bit of the floating-point representation, preserving fractions, HDR, and non-finite values so they are not truncated by 8-bit integer arithmetic. Plain Uint8ClampedArray keeps the existing low-bit perturbation.

This change improves the call semantics of the interfaces it touches and does not guarantee identical values on every pixel path: partitioned reads, color space conversion, OffscreenCanvas export, other realms, and unwrapped Workers still have coverage limits. The Canvas image itself is unchanged; text noise is not font isolation. After the measurement noise rules change, values with that option enabled may differ from earlier versions; after refreshing the page, the new runtime is used uniformly.

## 2.6.4 Panel and editing logic

- The first screen is ordered by page state, core configuration, egress results, identity binding, and Worker settings. Device / browser / fingerprint, connection notes, and probe evidence are collapsed; the identity and binding directory stays at the bottom of identity management.
- The status summary separately indicates whether the page is connected, which Worker mode is in use, and whether this site's egress is echoed. Unconfirmed states use a warning color; a failure of the current operation still shows the specific error, and a registered script is not equated with an effective page.
- Changes to this site's Worker are kept as a popup draft keyed by full domain. Checking status, switching panels, or saving other settings does not overwrite the selection; saving and discarding are supported, and the draft counts toward the unsaved total. Closing the panel discards the draft, consistent with other edit groups.
- The last background failure is kept in a separate timestamped record and is no longer shown as a failure of the current operation; the original error can still be expanded. Failures of the current save, probe, and refresh continue to be reported explicitly.
- The toolbar popup is still 420 × 600 CSS pixels, and only the content area scrolls. This release does not change fingerprint, probe, or permission handling rules.

## 2.6.3 Page connection and compatibility diagnostics

- The this-site overview adds a page connection check that distinguishes a missing bridge, a runtime that is not connected, configuration awaiting a receipt, application failure, an old version, and a receipt from the current version. Registration state does not mean the page is effective; a receipt only represents a report from the top-level runtime and does not prove what the site collected or that all Workers are covered.
- "Refresh this page and check" only refreshes the original tab, confirms that the document has been replaced, and then waits up to 8 seconds for the current-version receipt of the new document; if it still fails, the specific reason is shown, the old page is not re-injected, and other tabs are not refreshed automatically.
- Worker adds a mode saved by full hostname: handle automatically, or use native directly. On sites that forbid Blob, such as GitHub, choosing native and refreshing skips the extension's Blob wrapper and avoids the repeated CSP logs that wrapper produces; the Worker keeps the native time zone, language, and fingerprints internally. Switching back to automatic restores the previous behavior and is not inherited by subdomains. Pages and request headers continue to be handled by their own settings, and the site's own CSP errors are not hidden.
- Probes for this site separately explain HTTP 401/403, 404, 429, timeout, invalid echo, redirect, and generic network errors. Redirects are not followed; network errors are not disguised as confirmed CORS / DNS / TLS causes. The Chrome Web Store is explicitly reported as unsupported and the echo request is skipped.
- The existing global location fallback logic is kept; the fallback IP is not treated as this site's egress, and no proxy, echo service, cross-validation, or debug permission is added.

## Install and update

1. Download and unpack the repository, keeping the whole `GeoMask` folder.
2. Open `chrome://extensions/` in Chrome, or `edge://extensions/` in Edge.
3. Turn on "Developer mode", click "Load unpacked", and select this directory (which contains `manifest.json`).
4. Open the extension panel to view this site's configuration, and set identity, time zone, language, and device fields as needed.
5. To update, replace the files in the same directory, click "Reload" on the extension card, then refresh the page.

This directory already contains all runtime files; no Node.js, dependencies, or build step are needed. Changing the install directory may change the ID of the unpacked extension and make the existing configuration unusable.

## How to use the panel

| Page | Purpose | How it saves |
| --- | --- | --- |
| This-site overview | See this site's identity, time zone, language, coordinates, device, and the source of each; see egress probe evidence and ASN / organization | Domain bindings require clicking save; reprobing runs immediately |
| Identity management | See identities and all domain bindings, edit an individual configuration, set the default identity, unbind, or delete an identity | Click "Save identity changes" after editing; selecting an identity only switches the edit target |
| Global settings | Set the device, fingerprint handling, manual location, and startup mode that each identity inherits | Device and location need saving; interface and network switches save immediately |

Unsaved changes show a draft marker, and drafts are not kept after the popup closes. After saving configuration, refresh the page so the page script, request headers, and newly created Workers all use the same configuration. An identity only selects settings by domain; cookies and login state in the same browser are still shared.

## When a site requests geolocation

2.6.2 changed this to follow Chrome's real geolocation permission. After enabling "Global settings → Use GeoMask coordinates after permission":

| State | What the page receives |
| --- | --- |
| Chrome has allowed, and complete configured coordinates exist | GeoMask configured coordinates, with slight jitter applied according to the switch |
| Chrome has not decided yet | The browser's native geolocation permission flow is triggered; waiting for a choice |
| The user denies, revokes permission, or the site's Permissions-Policy forbids geolocation | Geolocation is denied and no coordinates are returned |
| No complete configured coordinates | Position unavailable; does not fall back to the browser's real location |
| Geolocation handling turned off or the extension paused | Native geolocation is restored; real location may be returned after browser permission |

Permission queries keep the real PermissionStatus and change events and no longer fake granted. Waiting for permission uses a cancellable native geolocation watch; a page that keeps requesting location also stops receiving configured positions after cancellation or revocation. After switching modes, old native location callbacks do not continue to deliver real coordinates.

The native permission flow may call the operating system's and browser's location services; GeoMask does not read, store, or forward location data from their callbacks. The position object returned to the page is still constructed by the extension, is not guaranteed to be indistinguishable from a native object, and does not fully emulate hardware geolocation or all PositionOptions behavior.

Slight jitter is on the order of tens of meters or less; it does not provide the mathematical privacy guarantees of controlled noise. Toggling jitter updates the cache, and a page modifying one returned object does not affect later results.

Regular startup may still keep native behavior before configuration arrives asynchronously; enhanced startup is meant to reduce that window. After updating, reload the extension and refresh the page; positions already returned cannot be retracted. Coordinates in the panel are the intended configuration, not proof of what the page actually read.

## Viewing domain bindings and deleting identities

Identity management shows the edit form first, with identities and the domain list at the very bottom of the page; the "Identities and bindings" entry at the top jumps there directly, and the bottom of the page returns to editing. The list shows every explicitly bound domain of each identity and marks "default", "this site configuration", and "being edited"; filtering by identity name or domain only changes what is displayed and does not change configuration. Clicking "Edit" jumps to the configuration form; selecting an identity does not change site bindings.

"View by domain" shows the corresponding identity for each domain and the inherited result after unbinding. Subdomains inherit from parent domains, and more specific bindings take precedence; after unbinding one, a parent-domain identity or the default identity may still apply. The default identity is not the same as an explicit domain binding, and the list is not a record of actual visits.

Each identity in the list and the top of the edit area have a delete entry. Before deleting, the identity name, all explicit domains that will be unbound, and the effect on the default identity and unsaved drafts are shown; clicking cancel writes nothing, and only clicking "Confirm delete identity" deletes. Only the selected identity, its domain bindings, and the matching default selection are deleted; other identities and their drafts remain. Deleting an identity does not clear cookies or sign out of accounts.

The three tabs keep their own scroll positions while the popup stays open. After creating an identity, its name is selected automatically; cancelling a delete returns to the previous position. The save bar saves identity configuration only; binding sites is done in "This-site overview".

## Time zone, location, and egress

On navigation, the extension tries to read the egress IP of the probe request from `https://{host}/cdn-cgi/trace` on the target site, then queries a geographic database for the time zone, country, and approximate coordinates; language is derived from the country.

2.6.0 offers two choices under "Global settings → Global location and priority", with lowest as the default:

| Choice | Priority (high to low) |
| --- | --- |
| Lowest · default location | Identity fixed location → this site's usable geographic result → global manual default location → global probe result |
| Highest · override location | Global manual location → identity fixed location → this site's usable geographic result → global probe result |

Time zone, language, latitude, and longitude are inherited separately; an empty value falls through to the next source, and a numeric 0 is valid. When this site has only an IP and no geographic result, the filled-in default location is also used, but it is not labeled as that IP's actual home location. A historical location kept after the latest probe failure ranks below the manual default; without a manual default, the historical configuration is kept and its source is labeled.

In 2.6.1, highest / lowest each store their own time zone, language, latitude, and longitude. After selecting the group to edit, the corresponding saved location or that group's draft is shown; the panel marks the currently enabled group and the group being edited separately. Only clicking "Save this group's location" or "Save and enable this group" takes effect, and saving one group does not overwrite the other group's values or draft. Discarding drops only the current group's draft and returns to the enabled group, while other groups' drafts remain. Closing the popup does not keep unsaved drafts.

"Clear this group's location" clears only the location of the group currently being viewed; it does not switch the enabled priority and does not clear the other group. The old location stays under the previously enabled group, the other group starts empty and is not copied automatically; the two groups never borrow each other's locations, and when a group is empty it inherits identity / probe results according to that group's priority rules.

Pages, request headers, enhanced startup, and panel sources use the same merge rules; refresh the page after saving. Old configurations without a priority field are still interpreted as lowest mode. The global manual location does not change the IP, ASN, or actual network egress.

Third-party echoes can only confirm the egress used when reaching that service. Even when the service and the target site belong to the same cloud provider, a proxy may still route by domain, destination IP, or protocol, so a third-party echo cannot automatically be labeled as this site's real egress. The current version does not add fallback third-party echo endpoints and does not automatically infer that sites share routing.

The default endpoint is [Cloudflare's /cdn-cgi/trace](https://developers.cloudflare.com/fundamentals/reference/cdn-cgi-endpoint/), which is not a generic IP lookup interface available on every site. Under the same routing, some sites may still return 401 / 403 or 404, so no echo can be obtained. Without this site's echo, the extension cannot directly confirm the client egress IP that the site sees; a server IP cannot stand in for client egress.

The panel clearly separates "this site's echo" from "global reference". 2.5.2 shows the HTTP status, invalid echo, timeout, and network failure directly on the probe card; the attempt time, raw error, and endpoint are in a collapsed area. Failures no longer show a green success indicator. When the IP is echoed but the geographic lookup fails, the two are explained separately; with no global result, the old configuration is kept and labeled with a historical source, the latest diagnostics are saved without updating the old data timestamp; with no configuration at all, a specific error is returned. An echo only represents that probe request; URL path routing, IPv4 / IPv6, redirects, and proxy policy can all make it differ from the egress of other requests from the page. A global fallback result cannot confirm this site's actual egress. This update corrects diagnostics and messages; it does not widen the coverage of sites that can be echoed.

ASN, organization, and ISP use data returned by the existing geographic lookup and show "not provided" when missing; no additional request is made for these fields. When this site's echoed IP differs from the fallback geographic IP, the fallback IP's ASN / ISP is not borrowed. 2.4.1 removed IP type, score, residential, and proxy / VPN / Tor markers; it does not query Net.Coffee and does not cross-validate multiple sources; old intelligence caches are no longer read or displayed.

## Device and fingerprint

- Mac Apple M / Intel profiles and Windows Intel / AMD profiles can be selected; system, chip, browser brand, and UA-CH fields are cross-validated.
- "Keep native" preserves both the legacy UA and UA-CH; when a custom profile or a full profile set is chosen, the two are linked to the selected brand and system, and the Chromium version uses the version reported by the real browser's native UA.
- Canvas, WebGL identifiers, audio spectrum, and text measurement can be handled deterministically; the same seed keeps results stable, and each identity can have its own seed.
- Font handling only affects text measurement; it does not install or hide fonts, and does not swap the real font library per IP.
- The WebRTC non-proxied UDP restriction can be controlled independently; extra ICE filtering may affect calls.

These treatments do not replace the real GPU, browser engine, fonts, or TLS capabilities; interface coverage is limited and detectable differences may remain.

## Worker mode and automatic CSP compatibility

"This-site overview → Worker compatibility status" can save "handle automatically" or "use native directly" per full domain. In native mode, the original entry point is used directly after a refresh without creating the extension's Blob wrapper, avoiding the repeated CSP logs that wrapper causes; it is not inherited by subdomains. Checking status or saving other settings does not overwrite an unsaved selection, and closing the popup discards the draft.

"Interface and network → Use the native entry point automatically when a Worker is blocked by CSP" is on by default. When the browser explicitly reports that the site's enforced CSP forbids blob Workers, the extension switches to the original entry point; later Workers on the same page use the original entry point directly, and the site's CSP is not modified.

A Worker switched automatically keeps the browser's native time zone, language, and fingerprints, while pages and request headers are still handled per configuration. The first CSP block may still appear in the extension's error records; if the native entry point is also blocked by CSP it still fails, and ordinary script and network errors do not trigger a retry.

See "This-site overview → Worker compatibility status" for the switch report of the current top-level page, and click "Check current page" to read it again; the report only states that the native entry point was chosen, not that the Worker started successfully, and the situation of subframes / child Workers must be checked in their own consoles. The state is not cached across pages and is explicitly shown as unavailable when it cannot be read. Turning off automatic compatibility and refreshing the page restores the previous strict behavior.

The switch preserves the original Worker object and message order, and transferable objects are detached at call time; forwarded events are synthesized, so `isTrusted` is not equivalent to the original Worker, and borrowing `Worker.prototype` methods directly is outside the instance forwarding coverage. A created Worker does not hot-update with settings; refresh the page after changing settings.

## Enabling enhanced startup

Regular mode needs to obtain configuration asynchronously, so the page's earliest scripts may read native values first. Enhanced mode preloads known configuration into the HTTP/S page startup script, reducing that window.

1. On Chrome 138+ enable "Allow user scripts" in the extension details; on Chrome 135–137 keep Developer mode on for the extensions page. Edge needs the corresponding permission support.
2. In the panel's "Page startup protection", choose "Enhanced · preload startup configuration".
3. Confirm that "Enhanced startup registered" is shown, then refresh the page; click "Check / Apply" if necessary.

Failures of permissions, registration, or cleanup show an error. Enhanced startup does not guarantee that there is no configuration gap across all frames, unknown egress, extension updates, or browser restarts.

## Permissions and data

| Permission | Purpose |
| --- | --- |
| Access to all sites | Installs API hooks in pages and frames and performs egress probes |
| storage / alarms | Saves configuration and caches, and refreshes on a schedule |
| tabs / webNavigation | Identifies the current site and navigation |
| scripting / userScripts | Registers regular and enhanced startup scripts |
| declarativeNetRequestWithHostAccess | Rewrites language and the selected UA / UA-CH request headers |
| privacy | Controls the WebRTC non-proxied UDP policy |

Egress and geographic probes contact the target site and the available services among `ipwho.is`, `ipapi.co`, `ifconfig.co`, `api.ip.sb`, and `freeipapi.com`; on failure, fallback sources are tried in the existing order without cross-comparison. These services see the request egress and the IP being queried. There is no self-hosted telemetry or account upload endpoint, and no remote code is downloaded or executed. Identities, settings, and caches are stored in the extension's local storage.

## Errors and limitations

- Probe failures, field validation errors, and permission application failures are shown in the panel; more detailed information is in the extension's service worker console.
- When all global probes fail, previous results are kept for viewing and the failure is reported explicitly; old data is not called a successful new probe.
- After the master switch is turned off, automatic probing stops and extension policies are released; the user can still probe manually.
- Some Workers, cross-origin frames, page CSP, and the earliest-executing page code cannot be fully covered. Information the site has already collected and requests already sent cannot be retracted.

## File composition

`manifest.json`, `background.js`, `background/`, `content/`, `shared/`, `popup/`, and `icons/` are runtime files, and this README is the installation and usage guide. Development dependencies, tests, build scripts, screenshots, logs, and original icon artwork are not included in this directory.

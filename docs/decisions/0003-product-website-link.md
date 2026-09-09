# 0003 — User-initiated product website link

Status: Implemented, 9 September 2026.

The owner requested a link to `https://offlinemask.com/` from the app. A link in the anchored sidebar footer opens the homepage in the user's browser, alongside the application version. It does not submit app content, session identifiers, query parameters, or aliases. The landing page will be built separately later.

## Implementation and dependency

Use the official Tauri opener plugin (`@tauri-apps/plugin-opener` and `tauri-plugin-opener`, resolved to 2.5.5). Both are licensed MIT OR Apache-2.0, consistent with the existing Tauri dependency family; the project's license is still pending. Sources: [official plugin repository](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/opener) and [Tauri documentation](https://v2.tauri.app/plugin/opener/), consulted via Context7. Both dependency lockfiles are retained.

The native capability permits only `opener:allow-open-url` for the exact homepage URL. It grants no path-opening permissions or broad opener defaults. Disable the plugin's automatic JavaScript link interception and handle the click explicitly once, including failure feedback. The browser preview retains a normal anchor with `target="_blank"` and `rel="noopener noreferrer"`.

A plain anchor is sufficient for the web preview but does not provide reliable native system-browser behavior. The official plugin avoids maintaining bespoke OS launch commands and delegates URL opening to platform handlers. It adds a small JavaScript wrapper and native platform dependencies; runtime and binary-size overhead have not been benchmarked separately.

## Offline boundary

Opening the homepage is a deliberate action outside the offline processing workflow and requires internet in the browser. The app does not fetch the website, initiate background requests, or add remote assets. Processing and sample history continue to work without network access. This is an explicit owner-requested exception to the previous UI's absence of external links, not an AI integration.

Focused adapter tests cover ordinary browser navigation, one native call with only the fixed homepage URL, synchronous navigation prevention, and propagation of native opening failures for UI feedback.

# 0138 — The privacy page names the system web view's own connections

Date: 24 October 2026. Status: implemented. Owner: "fix the privacy page please", after testing showed the Windows app's process tree opening connections the page said did not exist.

## Problem

`landing/privacy.html` §4 said OfflineMask uses the network in three cases, all on a click, and "Ngoài ra không có kết nối nào khác". Watching the installed Microsoft Store build on Windows showed `msedgewebview2.exe` (WebView2's network service, user data in the app's `EBWebView`) connecting out within a minute of launch, with no user action.

A WebView2 net log of the idle app (`--log-net-log` through `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`, 90 seconds, 2.1.0) shows what they are:

- `https://edge.microsoft.com/componentupdater/api/v1/update`: the WebView2 runtime's own component updater;
- `https://dns.google/dns-query`: Chromium's secure DNS. The test machine's DNS servers are Google's, so name lookups were upgraded to DNS over HTTPS with the same provider; another machine uses its own DNS;
- `wpad`: the standard proxy auto-discovery lookup on the local network.

None of it comes from OfflineMask's code, and none of it carries the user's content. The page's content security policy keeps the web layer from connecting anywhere but itself. Still, the sentence was not true of everything running in the app's process tree, and the page is a promise.

## Decision

- §4 says OfflineMask itself uses the network in the three cases, then names the system component. The interface runs in the operating system's web view (Microsoft Edge WebView2 on Windows, WebKit on macOS and Linux), which Microsoft or Apple manages and which can connect by itself. On Windows it checks for updates to its components at `edge.microsoft.com` and looks up names through the machine's DNS, sometimes over HTTPS (`dns.google` when the machine uses Google's DNS). It carries nothing the user puts into OfflineMask and falls under Microsoft's privacy statement. The Store build is updated by the Store, under the machine's Store settings.
- The download row names Microsoft Store beside GitHub.
- §8 "Tự kiểm chứng" says the `edge.microsoft.com` connection a monitor shows belongs to the system component.
- `privacy-contract.test.mjs` pins the disclosure. The page must name WebView2 and `edge.microsoft.com`, and if the Windows configuration ever passes WebView2 arguments that switch its component updater or secure DNS off, the test fails until the page is updated.

Switching that traffic off was not done here. WebView2's component updater keeps security data current, and turning off the system's DNS choice would override a user's network settings. Doing it would be a separate decision with its own measurement. macOS and Linux were not measured; the page names WebKit without claiming specific connections.

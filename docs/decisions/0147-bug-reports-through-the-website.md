# 0147 — Bug reports go through the website, never from the app

Date: 25 October 2026. Status: implemented. Owner: "users are lazy and low tech, reporting details is challenging to them"; "it should open a report page, then auto fill what they typed and they need to click the button to send"; "note users that the app has no internet access, they will be redirected to the website to report the bug".

## Problem

Careful testing still lets bugs through, and the only way to report one was a GitHub issue, which most users neither have an account for nor would think of. The app promises no automatic network access and no automatic error reporting (privacy §4), so it cannot send a report itself. The bugs that matter most, missed personal information, sit inside files the user must never send.

## Options

- **Crash reporting or a report endpoint called from the app.** Ruled out: it breaks the privacy promise and the CSP that keeps the web layer local.
- **GitHub issues or `mailto:`.** Ruled out: most users have no GitHub account, and `mailto:` often opens nothing on Windows.
- **Copy the report and open Messenger or Zalo.** Ruled out: the user has to paste, Zalo cannot prefill, and reports would carry personal accounts.
- **The app fills a report page on OfflineMask.com and the user presses Gửi there.** Chosen.

## Decision

- **In the app**, the sidebar has *Báo lỗi* under *Cài đặt*. It opens `ReportDialog.vue`, which first says that OfflineMask has no internet access and that the browser will open the website, where the user presses *Gửi*. The user picks one of four kinds (`missed`, `wrong`, `crash`, `other`, in `src/core/report.ts`) and writes a line or two. A hint asks them not to paste names, phone numbers or real documents. The dialog shows what it adds by itself: the app version, the OS family from the user agent (never its build) and the screen they were on.
- *Mở trang báo lỗi* opens `https://offlinemask.com/bao-loi#kind=…&message=…&version=…&os=…&screen=…` in the system browser. The report rides in the fragment, which browsers never send to a server, so opening the page transmits nothing. The opener permission allows exactly `https://offlinemask.com/bao-loi#*` besides the homepage.
- **On the website**, `landing/bao-loi.html` fills its form from the fragment, then removes the fragment from the address bar so it stays out of history. Nothing is sent until the visitor presses *Gửi*, which posts JSON to `/report`. The page also works when someone opens it directly, with an empty form and no app details.
- **The Worker** (`landing/worker.js`) accepts only the four kinds, a non-empty message of up to 2,000 characters, short version/OS/screen strings and a body of up to 8 KB; anything else gets a 400 and nothing is stored. It stores the report in the `offlinemask-reports` KV namespace (binding `REPORTS`, created 25 October 2026) under `<ISO time> <8 random hex>`, with `{ kind, version }` as metadata. It records no IP address, country, user agent or cookie.
- `landing/privacy.html` §4 lists the report page as a fourth time the app uses the network: by the user's clicks, sending only what the page shows. §7 says what the Worker keeps, and §9 points to the page. `desktop/tests/privacy-contract.test.mjs` pins the opener scope, the fragment and those sentences. `desktop/tests/report.test.mjs` checks the URL, that the kinds match in all three places, and what the Worker stores and refuses.

## Reading reports

Cloudflare → Storage & Databases → KV → `offlinemask-reports`, or from the command line:

```sh
CLOUDFLARE_ACCOUNT_ID=90814f99c119cd5dc08362580f81a76f mise exec -- pnpm -C landing exec wrangler kv key list --namespace-id 3bcc4d99a5ec436d9c5ab7aa9a430f6e --remote
CLOUDFLARE_ACCOUNT_ID=90814f99c119cd5dc08362580f81a76f mise exec -- pnpm -C landing exec wrangler kv key get --namespace-id 3bcc4d99a5ec436d9c5ab7aa9a430f6e --remote "<key>"
```

## Limits and follow-ups

- The endpoint is public and has no rate limit. The free KV plan allows 1,000 writes a day across both namespaces, so a flood could also stop download counts for that day. Add a Cloudflare rate-limiting rule if it is abused.
- Nothing notifies the owner of a new report; check the namespace.
- Not built yet: a *Báo lỗi này* button on error messages that fills in the error, and reporting a missed value by its shape only (`0912 345 678` → `0000 000 000`) so the value itself never leaves the computer.

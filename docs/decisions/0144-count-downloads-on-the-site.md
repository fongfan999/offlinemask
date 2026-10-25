# 0144 — Count downloads on the website, never in the app

Date: 25 October 2026. Status: implemented. Owner: "the privacy page is for the app, not for the landing page, tracking on the landing page is normal".

## Problem

The app has no telemetry, and that stays true. That left only GitHub's per-file counts (Mac and Linux) and Microsoft Partner Center (Windows Store) to show whether anyone uses OfflineMask. GitHub's counts are split by file and release, and they don't show daily trends or countries.

## Options

- **An update check or ping from the app.** Ruled out: the app promises no automatic network access.
- **A browser analytics script (Cloudflare Web Analytics).** Unnecessary for now. Cloudflare's zone analytics already shows visits and requests from the server side, with nothing loaded in the browser.
- **Count in the Worker that already answers `/download/<platform>`.** Chosen. The first vers- `landing/worker.js` adds one to a key in the `offlinemask-downloads` KV namespace (binding `DOWNLOADS` in `wrangler.jsonc`) after each successful download redirect. The key is the UTC month and the platform, for example `2026-10 deb`, and the value is the count as text. It records no IP address, country, user agent, referrer, cookie or identifier. `/latest.json` and failed lookups write nothing. The write runs in `waitUntil`, so it never delays the redirect, and a KV error is swallowed so it never stops a download.
- KV is not an atomic counter: two downloads of one platform in the same moment can count once. That is acceptable at this volume. The free plan's 1,000 writes a day caps counting, not downloads.
- Section 7 of `landing/privacy.html` now says that it covers the website, not the app, and that each download adds one to that month's count for its platform and nothing else. It also says Cloudflare shows aggregate visit numbers. The app's promises are unchanged.
- To read the counts, open Cloudflare → Storage & Databases → KV → `offlinemask-downloads`. Visits stay in Cloudflare's own zone analytics.

dflare shows aggregate visit numbers. The app's promises are unchanged.
- Read the counts with the SQL API, using a token with Account Analytics Read:

  ```sql
  SELECT blob1 AS platform, SUM(_sample_interval) AS downloads
  FROM offlinemask_downloads
  WHERE timestamp > NOW() - INTERVAL '30' DAY
  GROUP BY platform ORDER BY downloads DESC
  ```

## Verification

`desktop/tests/landing-downloads.test.mjs` checks that two downloads leave exactly `{ "<month> deb": "2" }`, that `/latest.json` writes nothing, and that a failing KV still redirects. `pnpm lint`, `pnpm test` and a Wrangler dry run (which lists the KV binding) pass. Not verified: a count written by the deployed Worker.

# 0144 — Count downloads on the website, never in the app

Date: 25 October 2026. Status: implemented. Owner: "the privacy page is for the app, not for the landing page, tracking on the landing page is normal".

## Problem

The app has no telemetry, and that stays true. That left only GitHub's per-file counts (Mac and Linux) and Microsoft Partner Center (Windows Store) to show whether anyone uses OfflineMask. GitHub's counts are split by file and release, and they don't show daily trends or countries.

## Options

- **An update check or ping from the app.** Ruled out: the app promises no automatic network access.
- **A browser analytics script (Cloudflare Web Analytics).** Unnecessary for now. Cloudflare's zone analytics already shows visits and requests from the server side, with nothing loaded in the browser.
- **Count in the Worker that already answers `/download/<platform>`.** Chosen.

## Decision

- `landing/worker.js` writes one Workers Analytics Engine data point per successful download redirect to the `offlinemask_downloads` dataset (binding `DOWNLOADS` in `wrangler.jsonc`): `blob1` is the platform, `blob2` the two-letter country from `request.cf`, and the platform is also the index. It records no IP address, user agent, referrer, cookie or identifier. `/latest.json` and failed lookups write nothing. Analytics Engine is included in the Workers Free plan.
- Section 7 of `landing/privacy.html` now says that it covers the website, not the app, and that each download adds one count with platform and country only. It also says Cloudflare shows aggregate visit numbers. The app's promises are unchanged.
- Read the counts with the SQL API, using a token with Account Analytics Read:

  ```sql
  SELECT blob1 AS platform, SUM(_sample_interval) AS downloads
  FROM offlinemask_downloads
  WHERE timestamp > NOW() - INTERVAL '30' DAY
  GROUP BY platform ORDER BY downloads DESC
  ```

## Verification

`desktop/tests/landing-downloads.test.mjs` checks that a download writes exactly `{ blobs: [platform, country], indexes: [platform] }`, even when the request carries an IP address and a user agent, and that `/latest.json` writes nothing. Not verified: writes on the deployed Worker. The dataset is created on its first write after the next deploy.

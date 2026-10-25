# 0140 — The newest release, looked up when someone visits

Date: 25 October 2026. Status: implemented. Owner, on 0139: "for the getting latest files, I think we need to call a public to fetch it, if needed we can upload the built files to somewhere to fetch".

## Problem

0139 read the newest release when the page was built. Publishing a release does not trigger a Cloudflare build, so the page stayed on the previous version until the next push. The version shown and the files offered were only as new as the last deploy.

## Options

- **The visitor's browser asks GitHub's API.** This is simplest, but the page would load from a third party on every visit, against the privacy page ("không tải tài nguyên từ bên thứ ba"). Unauthenticated API calls are also limited to 60 an hour per address.
- **Mirror the files elsewhere (R2) and publish a `latest.json`.** This needs write credentials in the release workflow and a second copy of every installer, all to answer one question GitHub already answers.
- **A same-origin endpoint on the Worker that already serves the site.** Chosen.

## Decision

- `landing/worker.js` answers two paths and hands everything else to the static assets. `run_worker_first` limits it to those paths, so the 404 page and every asset behave as before.
  - `/latest.json`: `{ version, date, downloads }`, where `downloads` maps each platform to `/download/<platform>`.
  - `/download/mac-arm|mac-intel|windows|deb|rpm`: a 302 to that platform's file in the newest release. GitHub then redirects to its file host, which sends the file as an attachment, so the visitor stays on the page.
- Source: `releases/latest/download/SHA256SUMS.txt`. GitHub resolves it to the newest published, non-draft release, and it is not the rate-limited API. The version comes from the file names, and the day from `## [x.y.z] — date` in that tag's `CHANGELOG.md` on `raw.githubusercontent.com` (omitted if missing). Answers are reused for five minutes per Cloudflare location through the Cache API, so a new release reaches the page within minutes of publishing. If GitHub fails, the endpoint returns a short Vietnamese "try again in a few minutes" (503), never a GitHub page.
- The pages link `/download/<platform>`, so downloads are always the newest files even without JavaScript. The build still writes the version that is newest at that moment, as the initial text. `latest.js` then replaces every `[data-om-version]` and `[data-om-release-date]` from `/latest.json`, on the home page and the install guide.
- The Worker reads no cookies and sends nothing about the visitor to GitHub. Observability stays off, so nothing is logged. The privacy page's section on the site says the version and download buttons are looked up from GitHub by the site's own code on Cloudflare, without cookies or logs, and that Mac and Linux files come from GitHub's file host.
- Build-time strictness from 0139 is gone. The build no longer fails in CI when GitHub is unreachable, because the live lookup corrects the page. The links no longer name files, and the tests check them instead.

## Verification

`wrangler dev` on the built site: `/latest.json` returned 2.1.1 and 2026-10-24. Each `/download/<platform>` redirected to the matching 2.1.1 file, and following the deb redirect ended in `content-disposition: attachment`. An unknown platform and an unknown path returned the 404 page, and `/` returned the page. In the in-app browser, the install guide's version text set to a stale value was corrected to "2.1.1 (phát hành ngày 24/10/2026)" from `/latest.json`. `desktop/tests/landing-downloads.test.mjs` covers parsing, a missing changelog day, routing, the 503 when GitHub fails, and that every `/download/…` link on the pages is a platform the Worker serves. `pnpm test` (340) and `pnpm lint` pass. Not verified: the deployed Worker on offlinemask.com, and whether the Cache API is shared as expected there.

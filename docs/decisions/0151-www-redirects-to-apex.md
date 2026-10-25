# 0151 — www.offlinemask.com redirects to offlinemask.com

Date: 25 October 2026. Status: accepted; the rule is set in the Cloudflare dashboard. Owner: "our landing page is at offlinemask.com, not www one, it should not serve that host, and auto redirect to the one that has no www"; then, on a first version that did it in the Worker, "why dont we just use redirect rule which is free?"

## Decision

The site has one address, `https://offlinemask.com`. Every request to `www.offlinemask.com` gets a `301` to the same path and query on the apex from a Cloudflare **Redirect Rule** (Single Redirects, free plan) on the `offlinemask.com` zone:

- Name: `www to apex`
- When incoming requests match: custom filter expression `(http.host eq "www.offlinemask.com")`
- Then: dynamic redirect, expression `concat("https://offlinemask.com", http.request.uri.path)`, status `301`, preserve query string on.

Redirect Rules run before Workers, so `www` never reaches `landing/worker.js` and the Worker still runs only for `/latest.json`, `/download/*` and `/report` (`run_worker_first`, decision 0140). `www` stays a custom domain in `landing/wrangler.jsonc` so its DNS record and certificate keep existing; without a proxied record the rule would never see the request.

A first version redirected inside the Worker with `run_worker_first: true`. It was dropped: it ran the Worker on every page and asset, spending Worker requests on what the zone does for free. The cost of the rule is that it lives in the dashboard, not the repository; this record is its source of truth.

## Verification

`curl -sI https://www.offlinemask.com/privacy?x=1` shows `301` and `location: https://offlinemask.com/privacy?x=1`; `curl -sI https://offlinemask.com/` stays `200`.

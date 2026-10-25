# 0151 — www.offlinemask.com redirects to offlinemask.com

Date: 25 October 2026. Status: accepted; the redirect is set up by the owner in the Cloudflare dashboard. Owner: "our landing page is at offlinemask.com, not www one, it should not serve that host, and auto redirect to the one that has no www"; then, on a first version that did it in the Worker, "why dont we just use redirect rule which is free?"; and "so just remove the www part from the app, I'll set up on CF".

## Decision

The site has one address, `https://offlinemask.com`. Every request to `www.offlinemask.com` gets a `301` to the same path and query on the apex from a Cloudflare **Redirect Rule** (Single Redirects, free plan) on the `offlinemask.com` zone:

- Name: `www to apex`
- When incoming requests match: custom filter expression `(http.host eq "www.offlinemask.com")`
- Then: dynamic redirect, expression `concat("https://offlinemask.com", http.request.uri.path)`, status `301`, preserve query string on.

`www` is no longer a custom domain in `landing/wrangler.jsonc`; the Worker is bound to the apex only and still runs only for `/latest.json`, `/download/*` and `/report` (`run_worker_first`, decision 0140). The `www` name, its proxied DNS record and the rule are kept in the Cloudflare zone by the owner, outside the repository; without a proxied record the rule would never see the request. A deploy does not remove a custom domain created earlier, so the old `www` binding is removed in the dashboard (Workers → offlinemask-landing → Domains) when the rule is set up.

A first version redirected inside the Worker with `run_worker_first: true`. It was dropped: it ran the Worker on every page and asset, spending Worker requests on what the zone does for free. The cost of the rule is that it lives in the dashboard, not the repository; this record is its source of truth.

## Verification

`curl -sI https://www.offlinemask.com/privacy?x=1` shows `301` and `location: https://offlinemask.com/privacy?x=1`; `curl -sI https://offlinemask.com/` stays `200`.

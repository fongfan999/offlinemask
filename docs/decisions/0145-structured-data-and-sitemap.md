# 0145 — Structured data, sitemap and robots.txt for the website

Date: 25 October 2026. Status: implemented. Owner: "add SoftwareApplication and FAQPage JSON-LD to index.html plus a sitemap.xml and robots.txt sitemap line".

## Problem

offlinemask.com described itself to search engines and AI assistants only through its text and meta tags. It had no structured data, `/sitemap.xml` returned 404, and `/robots.txt` was Cloudflare's managed file: content-signal comments with no rules and no sitemap line. Lighthouse already scores SEO 100; this is about saying plainly what the product is, so that search and AI answers can repeat it.

## Decision

- `landing/search.js` produces all three; the Vite build uses it. The home page's head has a `<!-- structured-data -->` marker that the build replaces with one `application/ld+json` script holding a `@graph` of:
  - **SoftwareApplication**: name, description (the page's own meta description), `SecurityApplication`, macOS/Windows/Linux, the release version the build writes (`__OM_VERSION__`'s source), free (`price` 0, `isAccessibleForFree`), publisher Wot Da Fong. No rating or review: there are none, and inventing them is against Google's rules.
  - **FAQPage**: every question of the page's FAQ, **read from `product.html` at build time**, so the structured data cannot drift from what visitors see. `<` in the JSON is escaped, so no answer can close the script.
- `sitemap.xml` lists `/`, `/privacy` and `/install` (the served, extensionless URLs). No `lastmod`: a build date would claim changes that did not happen.
- `robots.txt` allows everything and names the sitemap. Cloudflare's managed robots.txt, if enabled, adds its content-signal notes above it.
- `desktop/tests/landing-search.test.mjs` checks that every FAQ entry on the page is in the structured data as plain text, that the script is valid JSON-LD with nothing that could end it early, and the sitemap and robots lines.

Expectations, honestly: Google shows FAQ rich results only for authoritative government and health sites since 2023, and software rich results need ratings. The gain is clearer machine-readable facts for Google's understanding of the page and for AI assistants, not new snippets.

Nothing here changes networking, storage or what the page loads, so `landing/privacy.html` is unchanged.

## Verification

`pnpm test`, `pnpm lint`, a production build checked for the JSON-LD (parsed, nine questions matching the page), `dist/sitemap.xml` and `dist/robots.txt`, and Lighthouse SEO on the local build. Not verified until the next deploy: the live files and Google's Rich Results Test on the live URL.

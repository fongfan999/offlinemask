# 0148 — A share image for each post, and llms.txt

Date: 25 October 2026. Status: implemented. Owner: "Add llms.txt built from the pages and posts, and a share image for each post."

## Problem

Every blog post (decision 0146) shared the home page's `og.png`, so on Facebook, Zalo or Slack each post's preview looked the same. And the site had no `/llms.txt`, the plain-text map some AI assistants read.

## Decision

- **Share images.** `landing/cards.js` draws `/blog/<slug>.png` (1200×630) for every post at build time: the cobalt of the home page's card, the wordmark, the post's title, its date and the domain. Each post's `og:image` and its `BlogPosting` `image` point to it. The dev server draws them on request.
  - Drawn with **Satori 0.33.5** (MPL-2.0, `satori` on npm, by Vercel: layout and text to SVG paths) and **@resvg/resvg-wasm 2.6.2** (MPL-2.0: SVG to PNG in WebAssembly), so the Cloudflare build needs no browser, native module or system fonts. Satori 0.33.5 is its last release before October 2026, when dozens of releases came out within days; newer ones can wait until they settle.
  - Satori reads WOFF but not WOFF2, so the text uses **@fontsource/noto-sans 5.3.0** (OFL-1.1, the same Noto Sans as the page, static 500 and 700 cuts) rather than the page's variable WOFF2 files. Its Latin and Vietnamese subsets are given to Satori as two families, because Satori falls back between families for a missing glyph but not within one; as one family, ư, ơ and ử came out as boxes.
  - About 1.3 s per image and 430 KB each. The build redraws them all every time; worth caching only once there are a few hundred posts.
- **llms.txt.** `search.js` builds `/llms.txt` in the llmstxt.org format: a one-paragraph summary and the product facts (the same ones `landing/blog/README.md` allows), the indexed pages with their own `<title>` and meta description read from the HTML, every post with its description, and the source code. The report page (`noindex`) is left out with the sitemap's other omissions. No search engine has said it uses llms.txt; it is cheap and always current. Cloudflare serves `.txt` as `text/plain` without a charset, so browsers showed its Vietnamese as mojibake; the build emits a `_headers` file giving `/llms.txt`, `/robots.txt` and `/font-licenses.txt` `charset=utf-8`.

Nothing here changes networking or what pages load, so `landing/privacy.html` is unchanged.

## Verification

`pnpm test` (a card is a 1200×630 PNG; post pages point at their own image; llms.txt lists pages and posts), `pnpm lint`, a production build with both posts' cards looked at for Vietnamese letters, and `dist/llms.txt` read through. Not verified until deployed: Facebook's Sharing Debugger on a live post.

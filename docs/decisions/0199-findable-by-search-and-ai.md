# 0199 — What search engines and AI assistants are told, kept true and sent sooner

Date: 12 November 2026. Status: implemented; IndexNow takes effect on the first push after this change is live. Owner: "we need somehow people can search for a problem on google or AI apps like ChatGPT, Gemini, Claude, etc. Our site should be appeared"; then "do step 1" of the plan that followed.

## Problem

The site was already open to every crawler, with structured data, a sitemap, `llms.txt` and a blog (decisions 0145, 0146, 0148). A check on 12 November 2026 found four gaps:

- **`llms.txt` said the opposite of the page.** Its product facts were written by hand and still said "Chưa hỗ trợ PDF và hình ảnh", while the page lists PDF, PNG and JPG and says scans are read on the machine (decisions 0149, 0180, 0191). The blog's writing brief said the same, so posts could repeat it. AI assistants that read `llms.txt` were being told the app cannot do something it does.
- **The release date had gone missing.** The changelog's headings changed from "—" to "-" on 29 October (keyboard characters only), but the Worker and the build still looked for "—", so since 2.6.0 the install page has shown no "phát hành ngày" and the build had no release day.
- **The sitemap gave no date for the four pages**, only for posts.
- **Bing learnt of new posts only when its crawler came back.** ChatGPT's and Copilot's search runs on Bing's index, so a post could wait days to be found there.

## Decision

- **Formats come from the page.** `search.js` reads the page's `.om-formats` list and the note after it (`formats()`), and `llms.txt` names exactly those, with the note word for word. A test fails if `llms.txt` misses a listed format or says "chưa hỗ trợ". The blog brief names the current formats and points the writer at the page's list.
- **The release day reads either dash.** The Worker and the build's fallback accept "—" or "-"; a test covers the plain dash.
- **Every page has a `lastmod`**, from data the build already has: the release day for the home and install pages (both name the release), the date in the privacy page's "Cập nhật ngày" line for `/privacy`, and the newest post's day for `/blog/`. No git history is needed, so Cloudflare's shallow build clone is enough.
- **`sameAs`** on the `SoftwareApplication`: the GitHub repository and the Microsoft Store listing, so engines can tie the three together.
- **IndexNow.** The build serves the site's key as `/<key>.txt` (the key is public by design: engines accept URLs only from whoever can place that file on the host). After a push to `main` that touches the site, the `Landing: Verify` workflow's `indexnow` job maps the changed files to URLs (`changedUrls()`: a post and the blog index, or a page whose own file changed; styling and scripts are left out), waits until the live sitemap shows the changed posts' and privacy page's dates, or three minutes when it cannot tell, and posts the list to `api.indexnow.org`, which shares it with Bing, Yandex, Seznam, Naver and Yep. Google does not take IndexNow; it reads the sitemap.
  - Considered: Cloudflare's Crawler Hints, which sends IndexNow from the zone with a dashboard switch. It decides on its own what changed, from cache behaviour, and nothing about it is in the repository; the workflow is explicit and testable.

Nothing here changes what the app or the website does with visitors: the ping runs on GitHub's servers and carries only public URLs, so `landing/privacy.html` is unchanged.

## Verification

`pnpm test` (formats, dates, `sameAs`, changed URLs, the key's shape, the plain-dash release day), `pnpm lint`, a production build with `sitemap.xml`, `llms.txt`, `_headers`, the key file and the JSON-LD read through, and a run of the ping script with the IndexNow request stubbed out. Not verified until deployed: the first real IndexNow answer (expect 202 while Bing checks the key, then 200), and the key file live at `https://offlinemask.com/fba01db3abd23b9057084797a5de1fb0.txt`.

Left to the owner: verifying offlinemask.com in Google Search Console and Bing Webmaster Tools (a DNS TXT record in Cloudflare) and submitting `/sitemap.xml` in both.

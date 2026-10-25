# 0146 — A blog on the website, written on a schedule

Date: 25 October 2026. Status: implemented. Owner: "writing blogs for the landing page automatically … 2, 3 days 1 post, SEO friendly"; then "build blog first", "just write vietnamese", "not spamming, answer users problems/questions", "just push to the main to deploy automatically", and whether to use Cloudflare's EmDash.

## Problem

People ask Google and AI assistants questions OfflineMask answers ("có nên dán thông tin khách hàng vào ChatGPT không?"), but the site has three pages and nothing that answers them. The owner wants a Vietnamese blog that grows by itself, a post every two to three days, without becoming spam.

## Decision

- **Markdown in the repository, built by the existing Vite site.** Posts are `landing/blog/posts/<slug>.md` with `title`, `description`, `date` and optional `updated`. `landing/posts.js` renders them with **marked 16.4.1** (MIT, the `marked` package on npm, a landing dev dependency used only at build time) into `/blog/<slug>`, with `/blog/` listing them and `/blog/rss.xml`. `landing/blog/index.html` is the one template: the build fills its `<!-- blog-head -->` and `<!-- blog-main -->` markers for the list and for each post after the page is final (stylesheet inlined), and the dev server fills them per request. Pages sit in `dist/blog/`, so their relative asset paths are the same as the list's; Cloudflare serves `blog/<slug>.html` at `/blog/<slug>`.
- **Search.** Each post has its own title, description, canonical, Open Graph tags, `BlogPosting` and `BreadcrumbList` JSON-LD, and a sitemap entry with its real `lastmod` (`search.js`). The list has `Blog` JSON-LD. Headings get ids. The product page's footer links to the blog, so crawlers find it.
- **The build is the reviewer.** Posts go live with no human in the loop, so `posts.js` fails the build on a post that would publish badly: a non-slug file name, a title over 70 characters, a description outside 70–170, a bad date, unknown fields, any HTML (no embeds or third-party resources, which also keeps the privacy page's §7 true), a `#` heading, remote or missing images, images without alt text, or fewer than 400 words. Tests in `desktop/tests/landing-blog.test.mjs`.
- **The writer.** A scheduled Claude Code routine (cloud, Monday/Wednesday/Friday) follows `landing/blog/README.md`: take the next real question from `landing/blog/topics.md`, verify facts about laws and AI providers against official sources at writing time, state only the product facts listed there, build, test, lint, commit only the post and the queue, and push to `main`. Google's spam policies target scaled, low-value content, so the brief asks for one real question answered well per post and lets the writer skip a topic rather than pad it.
- **Not EmDash.** Cloudflare's EmDash is a full CMS (Astro, a database, an admin with sign-in). The writer is an agent committing files, so a CMS adds a database, an admin surface, a migration of the site to Astro and new facts for the privacy page, and solves nothing here. The posts are plain Markdown, so the future move to the Astro/EmDash host on wotdafong.dev can import them.

Nothing here changes networking, storage or what pages load (posts may link to other sites, with `noreferrer`, but load nothing from them), so `landing/privacy.html` is unchanged.

## Verification

`pnpm test`, `pnpm lint`, a production build (post and list pages with inlined styles and `../assets` paths, `rss.xml`, sitemap with the post), and the pages in the dev server at desktop and phone widths. Not verified until the first deploy: the live `/blog/` routes on Cloudflare and Google's Rich Results Test on a live post.

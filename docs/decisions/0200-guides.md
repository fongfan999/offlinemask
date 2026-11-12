# 0200 — Guides: a page for each job the app does

Date: 12 November 2026. Status: implemented. Owner: "we need somehow people can search for a problem on google or AI apps like ChatGPT, Gemini, Claude, etc. Our site should be appeared"; then "do step 2" of the plan that followed (decision 0199 was step 1).

## Problem

People find software by searching for the job, not the name: "ẩn thông tin cá nhân trong file PDF", "che số CCCD trong ảnh chụp", "ẩn danh nhiều file một lúc". The home page targets the product and its promise; the blog (decision 0146) answers general questions and mentions the app in passing. No page answered "how do I do this job, step by step", so neither a search engine nor an AI assistant had a page to send such a person to, or to cite.

## Decision

- **A second Markdown collection, `landing/huong-dan/pages/`, published at `/huong-dan/<slug>`**, with a list at `/huong-dan/`. It is the blog's machinery made general rather than a copy: `posts.js` parses both collections with the same checks (front matter, title and description lengths, no HTML, local images, at least 400 words), and one Vite plugin factory builds each collection's pages, share cards and images. Guides add an `order` field and are listed in that order, undated, because they are read as a set rather than a stream.
- **Structured data**: each guide is an `Article` with a `BreadcrumbList` (OfflineMask > Hướng dẫn > the guide); the list is a `CollectionPage`. `HowTo` was considered and left out: Google stopped showing HowTo results in 2023, and the steps read as ordinary headings and lists.
- **Found everywhere the blog is**: the sitemap (each guide with its `lastmod`, the list with its newest), `llms.txt` (its own "Hướng dẫn" section), IndexNow (decision 0199) and a "Hướng dẫn sử dụng" link in the home page's footer. Each guide ends with the same download box as a post.
- **One guide per job the app does, not per profession.** The blog already has posts for accountants, HR, contracts and Excel; guides for the same searches would compete with them. The guides cover what no post covers, and link to the posts where a reader would want them. A test fails if a guide links to a post that does not exist.
- **Facts only from the app.** Every claim was checked against `landing/product.html`, `PRD.md`, the decisions and the app's own Vietnamese labels; the guides use the app's exact button and screen names. They are written by hand, not by the blog routine, and are updated when the app changes. A guide that would need a fact the app cannot back is not written.
- **No screenshots yet.** The owner prefers crisp illustrations to shrunken app screenshots (landing feedback, October 2026), and Markdown pages cannot carry the home page's HTML illustrations. The guides use numbered steps with the app's exact labels; real cropped screenshots can be added per guide later, under `huong-dan/images/`.

The Excel post said "Chưa hỗ trợ PDF và hình ảnh", the stale fact decision 0199 removed from `llms.txt`; the sentence is gone and the post carries `updated: 2026-11-12`.

Nothing here changes networking or what is stored, so `landing/privacy.html` is unchanged.

## Verification

`pnpm test` (guides parse with an order and render as articles under `/huong-dan/`; every published guide passes the checks, with distinct orders and links to existing posts; the sitemap and `llms.txt` list guides), `pnpm lint`, a production build with each guide, the list, the cards, `sitemap.xml` and `llms.txt` read through, and the pages looked at in the dev server at desktop and phone width.

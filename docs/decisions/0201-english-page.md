# 0201 — One English page, honest that the app is for Vietnamese

Date: 12 November 2026. Status: implemented. Owner: "we need somehow people can search for a problem on google or AI apps like ChatGPT, Gemini, Claude, etc. Our site should be appeared"; then "do step 3" of the plan that followed (decisions 0199 and 0200 were steps 1 and 2). The plan recommended one English page rather than a translated site, and left the choice to the owner; "do step 3" took that recommendation.

## Problem

Every page on offlinemask.com is Vietnamese. Many people ask AI assistants in English, including Vietnamese speakers ("offline tool to mask personal data before ChatGPT"), and an assistant answering in English prefers an English source it can quote. The site had none, so the app could only be found through Vietnamese queries.

## Options

- **Translate the site.** The app's interface and its name and address detection are Vietnamese, so an English site would invite people the app cannot yet serve, and every page would need keeping in step with its Vietnamese original.
- **No English at all.** Leaves English questions with nothing to cite.
- **One English page that says what the app is and who it is for** (chosen).

## Decision

- **`/en/`** (`landing/en/index.html`, its own small entry `en/en.js` for the shared styles and the release number): what OfflineMask does, the three steps, Ẩn nhanh, what it finds, the formats, why it is private, and the downloads. A note near the top says plainly that the app is made for Vietnamese: its interface is Vietnamese and it is tuned for Vietnamese documents; other languages are planned. What it finds in other languages is stated only as far as the detectors back it.
- **hreflang** on both pages: `vi` for the home page, `en` for `/en/`, `x-default` for the home page, each page naming both. The English page links the home page as "Tiếng Việt", and the home footer links "In English". Blog posts and guides stay Vietnamese-only.
- **Structured data**: the home page's `SoftwareApplication` gains an `@id` (`https://offlinemask.com/#app`); the English page is a `WebPage` in English `about` that same app, so engines see one product with two descriptions rather than two products.
- **Crawlers**: `/en/` is in the sitemap with the release day as its `lastmod` (it names the release), in `llms.txt` among the pages, with a short English summary added under the Vietnamese one, and in IndexNow's page map.
- **Kept from the Vietnamese pages, not repeated**: the privacy policy, install guide and report form stay Vietnamese and are linked as such. The format list must match the home page's; a test compares them.

## Corrected on the way: card numbers and passwords need the pack

Checking what to promise in English, the detectors were run on sample text. Card numbers, passwords, API keys, user names and dates of birth are found by rules, but their category ("Thông tin riêng tư khác", `other` in `desktop/src/core/detection/options.ts`) is marked as needing the pack, as decision 0012 set; without the pack only email, phone and the account and identifier group run. The home page's "Nhận diện" card listed **Số thẻ** and **Mật khẩu** under "Có sẵn", and `llms.txt`, the blog brief and the text guide repeated it.

- The home page moves both chips to the pack's list; the card's sentence is unchanged.
- `llms.txt` now reads both lists from the page (`detects()` in `search.js`), as it reads the formats (decision 0199), and a test ties the page's lists to the app's categories: what needs the pack in `options.ts` must sit in the pack's list.
- The blog brief and the text guide say the same. Blog posts that say the app finds card numbers "and names too with the pack" are true with the pack and were left as they are.

For non-Vietnamese text the English page states only what was measured: email; phone numbers written with a country code (national formats such as "(650) 253-0000" are read as Vietnamese and missed); account, passport and tax numbers next to a label, Vietnamese or English ("account number", "tax ID"); no IBANs or other countries' ID numbers. Whether the pack's models find English names was never evaluated, so the page says the app is not built for them.

Nothing here changes networking or what is stored, so `landing/privacy.html` is unchanged.

## Verification

`pnpm test` (both pages name each other and a default with hreflang; the English page is canonical at `/en/`, lists the home page's formats and is in the IndexNow map), `pnpm lint`, a production build with `/en/` read through (release number, Store link, inlined styles, sitemap and llms.txt entries), and the page looked at in the dev server at desktop and phone width.

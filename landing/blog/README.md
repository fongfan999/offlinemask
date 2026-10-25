# OfflineMask blog: writing brief

Posts live in `posts/<slug>.md` and are published at `https://offlinemask.com/blog/<slug>` by the landing build (`landing/posts.js`, decision 0146). A scheduled Claude Code routine writes one post every two to three days from [topics.md](topics.md) and pushes it to `main`, which deploys the site. This file is that routine's brief, and the brief for anyone writing by hand.

## Who reads and why

People in Vietnam who use ChatGPT, Claude, Gemini or Copilot for work and handle other people's information: office staff, accountants, HR, customer care, sales, lawyers, teachers, small-shop owners. They arrive from a Google or AI-assistant search with **one concrete question**. A post exists to answer that question well; OfflineMask is mentioned where it genuinely helps, never as the point.

Google penalises scaled, generic AI content. Every post must be one a careful human expert would be glad to have written. If a topic cannot be answered usefully and truthfully, skip it (mark it `[-]` in topics.md with a reason) rather than pad it.

## Language and voice

- **Vietnamese only**, natural and friendly, as the product page speaks: "bạn", short sentences, everyday words. Explain any English term once (e.g. "dữ liệu cá nhân (personal data)") only if readers would search for it.
- Answer in the first paragraph. Then explain why, then show how, step by step, with a realistic example (fictional names and numbers only, like Nguyễn Minh Anh, 0901 234 567).
- No hype, no fear-mongering, no "?!", no emoji, no clickbait. Never claim OfflineMask is perfect: it finds most private information and the user always reviews before sending.

## Facts you may state about OfflineMask

Only these, or what `landing/product.html`, `landing/privacy.html` and `PRD.md` say today (read them before writing):

- Free, no ads, no account, no paid tier. macOS (Apple Silicon and Intel), Windows (also via Microsoft Store), Linux.
- Masks on the user's computer; works with no internet. Flow: mask → paste into any AI → paste the answer back → codes turn back into the real information. The mapping never leaves the computer.
- Detects email, phone, bank account, card number, CCCD, passport, tax code, passwords; names, addresses and organisations with the optional Vietnamese pack (about 1.2 GB, downloaded once).
- Text, plus spreadsheets and documents: XLSX, XLS, ODS, CSV, DOCX, ODT, keeping the formatting. **No PDF or images yet.**
- Ẩn nhanh (quick mask): select text in any app and press a button or ⌘⇧M to mask/restore in place. macOS and Windows only.
- History is kept, encrypted, only if the user sets a passcode, and deletes itself after the chosen period.
- OfflineMask does not connect to any AI. If the AI edits a code, that code is left as is for the user to check.

Never invent features, numbers, customers, reviews or comparisons. Link to the app as `../` (home) or `../#om-download`, to the privacy page as `../privacy`, and to other posts as `./<slug>`.

## Facts about the world

- Claims about laws (e.g. Vietnam's personal-data rules), AI providers' data policies or security incidents must be checked with a web search **at writing time**, against the official source (government site, the provider's own help page), and linked. If you cannot verify it, leave it out or say it generally.
- No statistics without a linked, reputable source. No quotes from real people.
- Prefer stable official URLs. No affiliate links.

## Format and SEO

- Front matter: `title` (≤ 70 characters, the reader's question or a clear answer to it, the main search phrase near the start), `description` (70–170 characters, the answer in a sentence), `date` (YYYY-MM-DD, today in Vietnam). Add `updated` only when revising an older post.
- File name = slug: lowercase ASCII words of the title without diacritics, hyphenated, at most about 8 words (`co-nen-dan-thong-tin-khach-hang-vao-chatgpt`).
- 700–1,400 words. `##` sections whose headings are the sub-questions people ask; `###` below them if needed. No `#` heading (the title is the page's h1).
- Plain Markdown only: no HTML, no embeds, no remote images. Images are optional; if used, put a WebP under `blog/images/`, reference it as `images/<file>.webp` with Vietnamese alt text, and show only fictional sample data.
- End with a short "Tóm lại" list. Link one or two related earlier posts where it truly helps.
- The build rejects posts that break these rules; run it before pushing.

## The routine's steps

1. `git pull` on `main`. Read this file, [topics.md](topics.md), the existing posts (so you never repeat one), and the product facts above.
2. Take the first unchecked `[ ]` topic. If it overlaps an existing post or cannot be answered honestly, mark it `[-]` with a short reason and take the next.
3. Research it (web search for anything factual), then write `posts/<slug>.md` dated today (Asia/Ho_Chi_Minh).
4. Mark the topic `[x]` with the slug. When fewer than ten unchecked topics remain, append five new real questions in the same style (things people actually search; no duplicates).
5. Check: `pnpm install --frozen-lockfile`, `pnpm -C landing build`, `pnpm test`, `pnpm lint`. Fix anything that fails. Reread the post once as a picky Vietnamese editor and tighten it.
6. Commit only the post, its images and `topics.md` with the message `Blog: <title>`, and push to `main`. Never touch other files; if something outside the blog needs changing, stop and say so in the run's summary instead.

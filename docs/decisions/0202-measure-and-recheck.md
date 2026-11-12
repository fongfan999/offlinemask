# 0202 — Measuring discoverability, and re-checking the blog's outside facts

Date: 12 November 2026. Status: implemented; the re-checks start with the blog routine's first run after this change is pushed. Owner: "do step 5" of the discoverability plan (decisions 0199-0201 were steps 1-3; step 4 was off-site), which read: Search Console queries become topics, watch the AI crawlers in Cloudflare, ask a fixed set of prompts in the AI apps each month, and re-check the posts that state providers' policies.

## Problem

The blog states facts that drift: what a law says, where ChatGPT's training setting lives, how Claude and Gemini delete history. The routine writes and never looks back, so a post right in October can be wrong in March, and an assistant that cites it repeats the error. Nothing recorded whether any of this work makes OfflineMask appear in search or AI answers.

## Decision

- **A `checked` date on posts** (`landing/posts.js`): the last day a post's outside facts were verified, changed or not. It is never shown; it paces the re-checks without touching `updated`, so `dateModified`, the sitemap's `lastmod` and the "cập nhật" line still mean the text changed. It must be on or after `updated` and `date`; a post without it counts from `updated`, else `date`.
- **The routine re-checks one post per run** (`landing/blog/README.md`, step 2): the oldest post that states what a law or an AI provider's settings, policy or product does and was last verified more than 60 days ago. It opens the sources the post links, searches for changes, and checks the post's statements about OfflineMask against the brief's facts. A change becomes `Blog: update <title>` with `updated` and `checked` set; no change becomes `Blog: re-check <title>` with `checked` alone. Running four times a week, one per run keeps every such post within about 60 days. No new scheduled task: the existing routine's brief carries it.
- **Search Console topics first**: a topic in `topics.md` ending in `(search)` is a real query the owner copied from Search Console, and the routine writes it before the others.
- **A monthly visibility log** in the owner's private launch kit (an Artifact, outside the repository): ten fixed prompts, five Vietnamese and five English, against ChatGPT, Gemini, Claude, Perplexity and web search, each recorded as not mentioned, named, or linked, one database document per month, with notes. The owner fills it on the first of each month.
- **Baseline, 12 November 2026**: before Search Console and Bing were set up, web search found offlinemask.com for none of the ten prompts, nor for the name "OfflineMask" itself. The results named other tools for the same job: Velum Privacy, PrivacyScrubber, Pii Blocker, A5 PII Anonymizer, OpenAI's Privacy Filter, and prompt-anonymizer, which, like OfflineMask, is a Tauri desktop app with reversible codes (MIT, ten languages).
- **AI crawler visits** are read in Cloudflare's dashboard, not measured by the site: nothing is added to the pages.

Nothing here changes networking or what is stored by the app or the site, so `landing/privacy.html` is unchanged.

## Verification

`pnpm test` (a `checked` date parses, defaults to `updated` or `date`, and is rejected before them; a re-check alone leaves `updated` unchanged), `pnpm lint`, a production build, and the launch kit's log published, seeded with the baseline and read back. Not verified until the routine runs: its first re-check, due once a post's last verification is over 60 days old (the oldest, 25 October, falls due on 24 December 2026).

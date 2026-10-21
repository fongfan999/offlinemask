# 0119 — A privacy contract test keeps the privacy page true

Date: 21 October 2026. Status: requested by the owner after the privacy page was rewritten as a short whitepaper ([0113](0113-landing-product-page-with-real-screens.md)): "the app is still under development, how can make sure this page is up to date".

## Problem

`landing/privacy.html` states concrete facts: where the app connects, what it stores, which permissions it holds, and that it watches mouse buttons but never keys. The page had already drifted once. It described only the clipboard shortcut, months after Ẩn nhanh began reading selected text ([0096](0096-selection-popover.md)). Nothing tied the page to the code.

## Decision

- **`desktop/tests/privacy-contract.test.mjs`**, part of `pnpm test`, reads the app's real configuration and source and fails when a promise may no longer hold:
  - the CSP's `connect-src` lists only the app's own origins;
  - no updater, analytics or crash-reporting package is a dependency;
  - only `model_pack.rs` and `models.rs` use `reqwest`;
  - pack files come only from the project's Cloudflare R2 host, which the page names;
  - the opener may open only `https://offlinemask.com/`;
  - the non-core capability permissions equal the list the page explains;
  - selection watching asks for left mouse button events only: no keyboard hook on Windows, no key mask on macOS;
  - the page carries a "Cập nhật ngày …" date.

  Every failure message says to update the page and its date first, then the expectation.
- **AGENTS.md** gains a rule: changes to networking, storage, permissions, input observation or Ẩn nhanh update `privacy.html` and its date in the same change.

## Limits

The test checks structure, not behaviour. It cannot prove that a function never sends text somewhere, only that the places able to do so stay as they are. It catches the usual drift (a new dependency, permission, host or hook) and points to the page that must change with it.

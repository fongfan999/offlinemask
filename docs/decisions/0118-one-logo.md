# 0118 — One logo lockup and wordmark face

Date: 2026-10-20

## Context

While reviewing the landing page, the owner noticed that the nav logo and the giant hero "OfflineMask" used different typefaces, and asked whether the same rule should apply to the desktop app. Checking every place the name appears turned up three differences:

- **Hero, footer, share image and intro video:** the website drew the giant name in Noto Serif with an italic "Mask".
- **Desktop app:** the wordmark was set in the system sans at weight 650 (`brand/README.md`: "the system sans"). It therefore looked different on macOS (SF Pro), Windows (Segoe UI) and Linux, and different from the website's Noto Sans 750.
- **Lockup:** the app paired the wordmark with the mark on a cobalt tile; the website used the bare mark.

## Decision

`brand/README.md` now carries the logo rules:

- **One lockup:** the tile mark plus "Offline" in ink and "Mask" in cobalt.
- **One face for the wordmark:** Noto Sans 750 at −0.04em, bundled rather than taken from the system.
- **The serif is for headlines only.**

To apply them:

- **Desktop:** add `@fontsource-variable/noto-sans` 5.3.0 (OFL-1.1, the version and lockfile entry the website already uses; no new network access). `style.css` registers only its Latin file as "OfflineMask Wordmark", about 36 KB, and `.brand-name` uses it at 750 / −0.04em. Nothing else in the app changes typeface.
- **Website:** the hero, footer and share-image wordmarks use the logo lettering, and the nav, footer and privacy page show the tile lockup.

The intro video's end card still uses the serif wordmark and needs a re-export after the film is updated. (Done 21 October 2026: the rebuilt film ends on the tile and the logo lettering; see [0113](0113-landing-product-page-with-real-screens.md).)

The same pass applied the owner's wording rules to the app: the copy confirmation now says "công cụ AI bạn dùng (ChatGPT, Claude, Gemini…)", the preview lists "ChatGPT, Claude, Gemini…", and the home headline says "thông tin riêng" instead of "thông tin nhạy cảm".

## Verification

`pnpm lint`, `pnpm -C desktop build`, `pnpm -C desktop test` and `pnpm -C landing build` pass. The landing nav, footer and privacy header were checked in browser captures. The app sidebar was checked in the browser preview of the desktop UI.

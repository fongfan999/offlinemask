# 0108 — Vietnamese typography for the product landing page

Date: 20 October 2026

## Problem

The owner noticed poor Vietnamese typography in the initial page. The earlier review verified interactions and layout but did not adequately assess letterforms. System-dependent serif/mono fallbacks, aggressive headline tracking (down to -5 px) and metadata as small as 8–10 px made the page unsuitable for Vietnamese reading.

## Change

Only the landing page gets explicit self-hosted fonts: Noto Sans Variable normal for body/headings/metadata and Noto Serif Variable italic for emphasis. Latin and Vietnamese faces come from the same Fontsource release. Heading tracking and line height now leave room for accents; headline sizing accommodates the new metrics. Small labels have an 11 px floor, and release notes use 12 px. Metadata uses the same sans face to avoid switching to a system monospace face for accented letters. The shared brand tokens and desktop typography are untouched.

`fonts.css` includes only the four required normal/italic Latin/Vietnamese WOFF2 faces, with upstream unicode ranges and `font-display: swap`. Fonts are dependencies of `landing/` only. Vite bundles all four locally (116,560 bytes total); no external font requests. The static build includes the fonts' original copyright and OFL notices in `font-licenses.txt`.

Provenance: `@fontsource-variable/noto-sans@5.3.0` and `@fontsource-variable/noto-serif@5.3.0`, Noto Project authors, SIL Open Font License 1.1. Current Fontsource documentation consulted through Context7: https://fontsource.org/docs/guides/vite and https://fontsource.org/docs/getting-started/variable. The CSS font-face declarations retain the installed packages' unicode ranges and asset references. `landing/README.md` records the additional assets and packages required for future EmDash migration.

## Verification

- Browser screenshots inspected before and after: headline, italic accents, uppercase labels, body text, and synthetic name in the interactive demo.
- Light and dark appearance reviewed; 320 px and 390 px mobile, 768 px tablet and 1280 px desktop widths inspected. Narrow and tablet checks found no horizontal overflow or text blocks outside the viewport. A temporary light-mode QA host was removed afterward.
- Direct FontTools cmap inspection of both pairs of WOFF2 files confirms all 146 precomposed Vietnamese vowel/tone combinations and `đ/Đ` exist in both normal sans and italic serif. This checks actual glyph coverage rather than assuming a CSS font-family declaration proves coverage.
- Landing production build and Workers deployment dry-run pass, as does root lint/format verification. No desktop code, native binaries or models change.

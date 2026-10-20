# 0113 — Landing page in the spirit of Dia, with real app screens

Date: 2026-10-20

## Context

The owner judged the 0112 "redaction desk" page still not good enough, citing all four of: too plain, no real product shown, message unclear, motion weak. They asked for a page like https://www.diabrowser.com/ in the product's own colours. On the same day offlinemask.com went live through Cloudflare's GitHub integration, so pushes to `main` now deploy the page (see `landing/README.md`).

Dia's page was studied in the browser. Its language is:
- a full-bleed painterly colour field holding a huge serif wordmark, with the real app window rising out of it and a playful sticker;
- a floating pill navigation and a download button pinned to the bottom of the screen;
- sections that tell the story with a sticky product window next to numbered steps;
- light serif display headings on paper and simple labelled feature cards.

## Decision

- **Real product imagery.** The page shows four screenshots of the actual app (`landing/shots/`), captured from the desktop web build using only its built-in sample text and spreadsheet, plus a fictional AI reply typed into the restore step (`landing/scripts/capture-app-shots.mjs`). A caption says they are real screens with sample data. The document sample was left out because its account number, written "tài khoản số …", is not masked by the current rule. That detection gap is reported to the owner separately.
- **Hero:** a cobalt wash replaces Dia's gold. It is layered radial gradients, slow-drifting blurred blots and film grain, all in the cobalt family with a paper highlight (no purple or lavender). Above sit the tagline as the `h1`, a giant upright and italic Noto Serif "OfflineMask" wordmark, and one explanatory line. The app window rises over the edge of the wash, with a warm starburst sticker "Chạy offline" and two floating chips that show a value struck through beside its code.
- **Navigation and download:** a centred glass pill nav, with a "Tải về" pill once the hero scrolls away. An ink download dock is pinned to the bottom and hides over the cobalt download band. Both use the platform-aware link from 0110.
- **Story:** "Ẩn trước khi hỏi. Đổi lại khi có câu trả lời." Three numbered steps scroll past a sticky app window that switches between the original, masked and restored screens.
- **Feature cards** in Dia's labelled-pill style: Bảng tính (with a screenshot), Tài liệu, Nhận diện, Lịch sử mã hóa, Không tài khoản, Tự kiểm chứng.
- **Kept:** the privacy boundary diagram, the FAQ, and a cobalt download band with every installer, checksums and the install guide.
- **Typography:** upright Noto Serif is added (pinned Fontsource 5.3.0 files, same licence) for display headings, alongside the existing italic.
- **Motion** is built with GSAP and respects reduced motion: wordmark letters rise, the window lifts into place, the sticker pops and the code chips scramble out of redaction blocks, then drift gently. The wordmark sinks on scroll, sections reveal, and the boundary codes slide across.
- `demo.js` and the scripted hero document from 0112 are removed; the real screens replace them.

No telemetry, storage or runtime network requests are added. The page grows by about 320 KB of WebP images (lazy-loaded below the hero) and about 60 KB of serif fonts.

## Verification

`pnpm lint` and `pnpm -C landing build` pass. Scroll-through captures with Chrome DevTools at 1440×900 (light and dark) and 390×844 confirmed several things. The hero intro plays. The story window switches with the active step. The dock hides over the download band. The phone layout stacks the story with inline screenshots, and there is no horizontal overflow at 390 px. Safari and real devices were not exercised.

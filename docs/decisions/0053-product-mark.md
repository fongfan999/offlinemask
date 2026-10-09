# 0053 — Product mark, app icons and copy

Date: 9 October 2026. Status: accepted by owner instruction ("can you design the logo, and feel free to change the copies if you think it's better").

## Context

OfflineMask shipped with the create-tauri-app placeholder icons and a generic shield glyph. The owner's personal brand (Decision 0052) is a hand-inked **P?!** mark in ink and cobalt on paper; that mark is personal and must not become the product logo. The product needed a mark of its own in the same family.

## Decision

### The mark is an alias

Two brush-drawn brackets in ink around a short cobalt dash: `[—]`. It is literally what the product does. On the homepage "Phan Thái Phong" becomes `[TEN_DEMO_01]`; the logo is that token with the value hidden. The brackets have a slight calligraphic taper (thicker at the corners, thinner at the tips) to sit beside the personal brand's brush strokes; the dash tilts −4°, the same angle as the brand's sticker and tile. At 16 px it reads as a bracketed dash; at 1024 px as two inked brackets.

Alternatives considered: a domino eye-mask (reads as costume, not privacy), a redaction bar alone (universal but indistinct), a lock or shield (generic, and the shield was what we had). The bracket form is the only one that is both ownable and a description of the feature.

### Files and usage

- `brand/mark-ink.svg`, `mark-paper.svg`, `mark-mono-black.svg`, `mark-mono-white.svg`: the mark for light, dark and single-colour use.
- `brand/tile-cobalt.svg`: 1024 px app-icon artwork, an 824 px squircle (22% radius, 100 px margin) in cobalt with a paper mark. `pnpm tauri icon brand/tile-cobalt.svg` regenerates `src-tauri/icons/` for macOS, Windows and Linux; the Android/iOS sets it also emits are removed because the project has no mobile target.
- `public/favicon.svg`: full-bleed cobalt tile, linked from `index.html` (this also removes the window's `favicon.ico` 404).
- `src/components/AppIcon.vue` gains a stroke-based `mask` glyph for in-app tiles, replacing the `shield` uses in the sidebar and hero. The shield path remains available but unused.
- Wordmark: **Offline** in ink, **Mask** in cobalt, set in the UI's system sans. The hidden part is the accent. `brand/README.md` records colours, minimum sizes, clear space and the rule that the personal P?! is never used as the app logo.

### Copy

- Hero subline: "Tên, số tài khoản, số điện thoại… được thay bằng bí danh ngay trên máy bạn. Không cần Internet." It names what gets hidden instead of the abstract "thông tin riêng tư", and keeps the two promises (alias, offline).
- Open private session subtitle: "Đọc lại bản đã ẩn, sao chép sang AI, rồi dán phản hồi bên dưới để khôi phục." It walks the full loop now that restoration exists. Sample sessions keep the earlier line.
- `index.html` description: "Ẩn thông tin nhạy cảm trước khi chia sẻ với AI. Hoàn toàn trên máy bạn."

Everything else (format cards, choices, buttons, hints, Settings) was reviewed and left as is; it already follows the owner's "less is more" direction.

## Verification

- Mark rendered at 96/48/24/16 px on paper and dark, the generated 256 px macOS icon and the home page with the new tiles were inspected.
- `pnpm lint`, `pnpm test` (181), `pnpm build` pass; `dist/favicon.svg` is emitted.
- Not verified: the packaged `.app`/`.ico` on a real dock or taskbar.

## Consequences

Decision 0002's "existing shield branding" is superseded. The product and the personal brand now share palette and stroke character while staying distinct marks. Future marketing assets (website, social banner) should start from `brand/`.

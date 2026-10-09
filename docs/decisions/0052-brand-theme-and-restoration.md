# 0052 — Personal brand theme and in-session restoration

Date: 9 October 2026. Status: accepted by owner instruction ("improve anything in terms of product … for the app theme, please follow my personal brand"), with the brand reference at the owner's `wotdafong` repository and https://wotdafong.dev/.

## Context

The owner's personal brand is a "builder's notebook": warm paper, ink, one cobalt accent, mono eyebrows, italic-serif emphasis, pill buttons, flat sheets with hard offset shadows, and a dark scheme that follows the system. OfflineMask shipped the earlier blue/white liquid-glass boilerplate. The owner also left product direction to the assistant for this pass. The product's biggest open MVP gap was restoration (PRD FR-09): the hero promises mask → AI → return, but nothing brought the AI's reply back.

## Decisions

### Theme

`src/style.css` now carries the brand tokens verbatim from the brand kit, in light and dark:

| Token | Light | Dark |
| --- | --- | --- |
| Paper / raised / sunk | `#f7f5ee` / `#fcfaf4` / `#efede4` | `#151713` / `#1b1e19` / `#1f221d` |
| Ink / muted | `#262a25` / `#595d54` | `#ebeae2` / `#a8ab9f` |
| Accent / strong / soft | `#3453b6` / `#243e95` / `#e3e9fd` | `#93a9ff` / `#b8c6ff` / `#1f2744` |
| Note / note ink | `#e4eafe` / `#2c4290` | `#28335c` / `#dfe6ff` |

Rules applied: the `.glass` class name is kept for templates but now draws a paper-raised sheet with a 1 px line border and a `3px 4px 0` shadow (no blur). Buttons are pills; the primary action uses the brand button shadow. Eyebrows, hints, badges, table headers and the sidebar footer use the mono stack. The hero's second line is italic serif in cobalt, the brand's emphasis device. The homepage AI panel is drawn as the tilted cobalt sticky note (2°, flat under reduced motion). Brand marks are cobalt tiles (22% radius). The background is the brand's faint dot grid. Focus outlines are 3 px cobalt. `color-scheme: light dark` lets WebKit/WebView2 follow the OS.

The personal **P?!** mark belongs to Phong Phan, not to the product, and is not used as OfflineMask's logo. Layout, copy, information architecture and the six detection choices are unchanged.

### Restoration inside a session

`src/core/restore.ts` replaces a session's exact aliases (including manual `AN_THEM` aliases) with their original values in pasted text. Alias-shaped tokens that do not belong to the session are listed and left untouched; nothing is guessed and no other character changes. `RestorePanel.vue` sits under an open private session as a collapsed disclosure: paste the AI reply, "Khôi phục", read the count and any unknown aliases, copy the result. Its state is per session and lives in RAM only. This satisfies the text part of FR-09 without the encrypted vault; closing the app still clears every session, as before.

### Smaller product changes

- Private sessions are listed by the first line of their masked copy (`src/core/session-preview.ts`, grapheme-safe truncation), with number, time and "Tạm thời" as the subtitle. The masked copy exposes nothing the output does not; nothing is persisted.
- ⌘/Ctrl + Enter in the draft runs the primary action; the button's tooltip says so.

## Verification

- `pnpm lint`, `pnpm build`, `pnpm test` (181 tests, 4 new for restoration and previews): pass.
- Headless Chrome against `pnpm dev`, light and dark: home, text entry, a masked session with the restore panel used (two aliases restored, one foreign alias reported), settings, narrow drawer. Screenshots were inspected; no page errors.
- Not verified here: the packaged desktop build and the macOS appearance switch at runtime (WebKit applies `prefers-color-scheme` live; this was checked only with a forced color scheme in Chrome).

## Consequences

Decision 0002's glass surface and the product-direction palette bullet are superseded for presentation; the storage boundary and workflow decisions in 0002/0004 stand. Future UI work follows the brand tokens. Restoration for CSV/XLSX and persistent mappings remain PRD work.

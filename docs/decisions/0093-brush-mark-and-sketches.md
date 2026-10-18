# 0093 — A new mark from sketches: the mask

Date: 18 October 2026. Status: accepted by owner instruction ("can you redesign the app logo with sketches like you did with wotdafong.dev", then "we dont need to keep the old design, feel free to design a brand new one, since the app hasnt published yet").

## Context

[Decision 0053](0053-product-mark.md) gave OfflineMask the alias mark `[—]`, hand-written SVG. The owner's personal mark on wotdafong.dev (**P?!**) is made differently: a Python script samples a centerline, offsets a variable-width brush profile along its normals and emits one filled path, so the strokes look inked by hand and can be regenerated. The owner asked for the logo to be redesigned that way, from sketches, and then said the old design need not be kept.

## Decisions

### One brush, twelve sketches, two rounds

`brand/make_mark.py` carries the brush (`brush()`: taper, round and flat caps, a tiny deterministic hand tremor) and twelve candidate marks, each a few lines of geometry in a 100-unit box. `brand/build.py` lays each round out on a sheet, every idea at 120 px and inside cobalt tiles at 16, 24, 32 and 48 px, with a one-line note.

Round 1 (`brand/sketches-round-1.png`) kept the alias concept and tried it against five others: struck handwriting, a speech bubble, a ring, a closed eye, an M with a bar. The owner then asked for something new.

Round 2 (`brand/sketches.png`):

| FIG. | Idea | Why it is not the mark |
| --- | --- | --- |
| 07 MASK | a wide cobalt swipe with two eye holes | **chosen** |
| 08 NINJA | two ink eyes above a cobalt band | the band under the eyes reads as a mouth; with knot tails it became a fish |
| 09 ANON | a head in one loop with a bar across the eyes | reads as a "no entry" sign on a tile |
| 10 AT | an @ with its inner a swiped out | clever, but an "e" at 16 px and an email icon at 48 |
| 11 SLASHED O | an O for Offline, swiped through | the universal "prohibited" sign |
| 12 QUOTE | quotation marks around the hidden value | eyebrows and a mouth: a face, and not ours |

### The mark is the swipe

The mark is the thing the product does: a brush swipe that hides a value. Two eye holes in it make it a mask and a character: whoever is behind it still sees, and what matters stays readable. It is a sibling to the personal **P?!** (same brush, same ink/cobalt/paper, the same kind of small character made of marks) without borrowing it.

- On paper: cobalt swipe, ink eyes. The swipe is heavy where the pen lands on the left and eases off to the right, tilted −4° like the brand's sticker; the eyes are irregular ink dots like the dot of the `?`, one a touch higher than the other.
- On a cobalt tile and in single colour: one path with the even-odd rule, so the eyes are holes that show the background. At 16 px it reads as a ninja; at 1024 px as a brush stroke.
- The wordmark, lockup, minimum sizes and clear space in `brand/README.md` are updated for a wide mark (the clear space is the height of one eye hole).

### The restore mark

Masking has an opposite, restoring, and the quick actions put the two side by side (⌘⇧M on a selection, the floating panel's two buttons). The restore mark is the same mask pushed up onto the forehead, a little askew because it was just lifted, with the eyes out in the open below it. The two parts are unchanged, only their relation flips: eyes inside the swipe means hidden, eyes under the lifted swipe means revealed. It never has holes; in single colour the swipe and the eyes are one fill. It is an action icon, not a second logo: tiles, favicon and app icon stay the mask. `BrandMark.vue` takes `variant="restore"`; the panel's restore button and the one-button dot use it instead of the generic undo arrow.

Alternatives tried on a strip: the mask pulled down under the chin (reads as a mouth), the lifted mask keeping empty eye holes (busy at 16 px), and a level lift (reads as a hat; the askew one reads as a movement).

### Generated, not drawn

- `brand/make_mark.py` is the source. `brand/build.py` writes `brand/mark-*.svg` and `brand/mark-restore-*.svg`, `brand/tile-cobalt.svg` (1024 px, 824 px squircle, 22% radius, glyph at 84%), `public/favicon.svg`, the sketch sheets, `brand/preview-sheet.png` and `src/components/brand-paths.ts`. `brand/png.sh` rasterises the sheets with librsvg. `pnpm tauri icon brand/tile-cobalt.svg` regenerates `src-tauri/icons/` (the Android and iOS sets it also emits are deleted).
- `src/components/BrandMark.vue` renders the generated path in `currentColor` and replaces the stroke-based `mask` glyph in the sidebar tile, the lock page and the floating panel's head. The `mask` glyph in `AppIcon.vue` remains the small UI icon on the panel's "Ẩn thông tin" button; it is an icon, not the logo.
- Python needs nothing beyond the standard library. The sheets set the wordmark in the system sans as live SVG text; the shipped mark files contain no text and embed no fonts.

## Verification

- Both sketch sheets, the mark at 256 and 512 px, the generated 128 px icon and the favicon at 16/20/32/48/128 px (4× nearest-neighbour strip) were inspected after each brush change.
- `pnpm lint`, `pnpm test`, `pnpm build` pass; the sidebar tile, lock page and pill were checked in the browser preview.
- Not verified: the packaged `.app`/`.ico` on a real dock or taskbar, and the menu bar tray icon, which uses the same generated icon.

## Consequences

0053's alias mark is superseded (its reasoning that a lock or shield is generic still holds). Any later change to the mark edits `make_mark.py` and re-runs the build; nothing is traced by hand. A monochrome template icon for the macOS menu bar (0092's follow-up) should be produced from `build_mark()` too. The brand README's rule that the personal P?! is never the app logo is unchanged.

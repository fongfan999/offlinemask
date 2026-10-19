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

Masking has an opposite, restoring, and the quick actions put the two side by side (⌘⇧M on a selection, the floating panel's buttons). The restore mark is **the mask, off**: the same swipe and eye holes with a brush slash through it, the way an eye-off or mute icon says "off". Unmasking is "mask off", and that convention is read everywhere without a label. On paper the slash is ink inside a gap cut from the cobalt band; in single colour the gap alone carries it, so it works on a cobalt tile and in running text. It is an action icon, not a second logo: tiles, favicon and app icon stay the mask. `BrandMark.vue` takes `variant="restore"` and draws the slash in ink over the currentColor band.

Five rounds got here. The first was the mask pushed up level onto the forehead with both eyes below: beside the mask and a label it read, alone it was a face with a hat, and at 15 px in running text it was a smear with two specks (the owner's screenshot of the home page showed that). The second was the mask coming off, one eye still through its hole: slightly better alone. The third strip tried a built-in "back" cue (the swipe curling back with an arrowhead, a brushed undo arc, motion marks, the mask held aside) and one open eye; arrowheads fight the brush and read as a question mark or a G at 16 px, motion marks vanish, and the single eye looked scary (one big eye reads as surveillance). The fourth softened it into two calm eyes, which say "a face" more than "restore". The fifth tried the two ideas left: the mask parted like a curtain with the eyes in the gap (a bow tie at 16 px) and the mask with a slash. The slash is the only one that reads at 15 px inline, on a tile and in one colour, because people already know what a slash through an icon means.

### Where the mark appears

The owner asked for the mark everywhere, so people get used to it. It now stands in every place the product names itself or asks for the action:

- Sidebar tile, home hero, lock page and the floating panel's head: the mask on a cobalt tile.
- The primary "Ẩn thông tin" buttons on the text, document and spreadsheet pages: the mask replaces the AI sparkle, which stays on the AI panel only.
- The home illustration: the mask before "Ẩn thông tin" in step 1, the slashed mask before step 3.
- The restore panel's intro and the panel's restore controls: the restore mark.
- Settings: the quick-action help shows the pair beside the words, and the version line is a small lockup (tile, wordmark, version).
- The macOS menu bar: a template icon (`src-tauri/icons/tray-template.png`, the mark in black with the eye holes transparent), which the system recolours for light and dark bars; this closes the follow-up in [0092](0092-background-mode.md). Windows and Linux trays keep the coloured app icon. The `image-png` Tauri feature is enabled to load it.
- The README on GitHub: the mark above the title, paper variant in dark mode.

Not given the mark: the stepper (numbers stay), the tray menu items (a non-template image would vanish on dark menus), and alias tokens.

## Verification

- Both sketch sheets, the mark at 256 and 512 px, the generated 128 px icon and the favicon at 16/20/32/48/128 px (4× nearest-neighbour strip) were inspected after each brush change.
- `pnpm lint`, `pnpm test`, `pnpm build` pass; the sidebar tile, lock page and pill were checked in the browser preview.
- The in-app placements were checked with `pnpm lint`, `pnpm test` and `pnpm build`; the Rust side with `cargo check`.
- Not verified: the packaged `.app`/`.ico` on a real dock or taskbar, and the template icon in a real menu bar.

## Consequences

0053's alias mark is superseded (its reasoning that a lock or shield is generic still holds). Any later change to the mark edits `make_mark.py` and re-runs the build; nothing is traced by hand. A monochrome template icon for the macOS menu bar (0092's follow-up) should be produced from `build_mark()` too. The brand README's rule that the personal P?! is never the app logo is unchanged.

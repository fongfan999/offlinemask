# OfflineMask — brand kit

The mark is **the mask**: a wide cobalt brush swipe, the thing that hides a value, with two eye holes. Whoever is behind it still sees, and what matters stays readable. At 16 px it reads as a ninja, at 1024 px as a brush stroke. It is drawn with the same brush as Phong Phan's personal **P?!** mark (a centerline, a variable-width profile, one filled path), so the two sit together on wotdafong.dev, but it is the product's mark; the personal mark is never used as the app logo.

It was chosen from twelve sketches in two rounds (`sketches-round-1.png`, `sketches.png`); [Decision 0093](../docs/decisions/0093-brush-mark-and-sketches.md) says why the others lost. The earlier alias mark `[—]` ([Decision 0053](../docs/decisions/0053-product-mark.md)) is retired.

## Files

| Use | File |
| --- | --- |
| Mark on light backgrounds | `mark-ink.svg` (cobalt swipe, ink eyes) |
| Restore action (the mask's eyes, open and calm) | `mark-restore-ink.svg`, `-paper`, `-mono-black`, `-mono-white`; `BrandMark.vue` with `variant="restore"` |
| Mark on dark backgrounds | `mark-paper.svg` |
| Single colour (eyes cut out) | `mark-mono-black.svg`, `mark-mono-white.svg` |
| App icon artwork (macOS/Windows/Linux via `pnpm tauri icon brand/tile-cobalt.svg`) | `tile-cobalt.svg` — 824 px squircle, 22% radius, 100 px margin, paper mark at 84% |
| Favicon / in-app tiles | `../public/favicon.svg` (full-bleed cobalt tile) and `src/components/BrandMark.vue`, which draws `src/components/brand-paths.ts` |
| Sketch sheets and preview | `sketches.png`, `sketches-dark.png`, `sketches-round-1.png`, `preview-sheet.png` |

Everything is generated: `make_mark.py` draws the strokes (a variable-width brush along a centerline, standard library only), `build.py` lays out the files and sheets, `png.sh` renders the sheets with librsvg (`brew install librsvg`). No fonts are embedded in the mark files; the sheets set the wordmark in the system sans. After editing `make_mark.py`:

```sh
cd brand && python3 build.py && sh png.sh
```

Then regenerate the platform icons (and delete the Android/iOS sets it also emits):

```sh
mise exec -- pnpm tauri icon brand/tile-cobalt.svg
```

## Colours

Taken from the personal brand kit, so the two marks sit together on wotdafong.dev.

| Token | Light | Dark |
| --- | --- | --- |
| Ink (eyes) | `#262a25` | `#ebeae2` |
| Paper | `#f7f5ee` | `#151713` |
| Cobalt (swipe, tiles) | `#3453b6` | `#93a9ff` |

## Rules

- The swipe is cobalt, the eyes are ink. On a cobalt tile or in single-colour use, the swipe is paper/white and the eyes are holes (even-odd fill) that show the background. Never draw the eyes as filled dots on a single-colour swipe.
- The restore mark is the mask's two eyes, open and calm: cobalt upper lids over the ink eyes; in single colour all of it is one fill. It is only ever an action icon, for "Khôi phục"; tiles, favicon and app icon are always the mask.
- The swipe tilts −4°, like the personal brand's sticker and tile; it is heavy where the pen lands on the left and eases off to the right. One eye sits a touch higher than the other. Do not straighten, level or redraw them by hand; change `make_mark.py`.
- The wordmark is the product name set in the UI's system sans at 650 weight: **Offline** in ink, **Mask** in cobalt. The hidden part is the accent. Never colour the whole word, and never write it as "Offline Mask" or "offlinemask" in UI copy.
- Lockup: tile or bare mark to the left of the wordmark, gap about a third of the mark's height, vertically centred on the x-height.
- Minimum sizes: mark 14 px wide, tile 16 px, wordmark 18 px tall.
- Clear space: the height of one eye hole on every side.
- No shadows or gradients on the mark itself; the UI's `3px 4px 0` sheet shadow may sit under a tile.

# OfflineMask — brand kit

The mark is **an alias**: two inked brackets around a cobalt dash — `[—]`. It is what the product does, drawn once. On the homepage your name becomes `[TEN_DEMO_01]`; the logo is that shape with the value hidden. It reads at 16 px as a bracketed dash and at 1024 px as two brush-drawn brackets. It belongs to the same family as Phong Phan's personal **P?!** mark (ink strokes, one cobalt accent, paper), but it is the product's mark; the personal mark is never used as the app logo.

## Files

| Use | File |
| --- | --- |
| Mark on light backgrounds | `mark-ink.svg` (ink brackets, cobalt dash) |
| Mark on dark backgrounds | `mark-paper.svg` |
| Single colour | `mark-mono-black.svg`, `mark-mono-white.svg` |
| App icon artwork (macOS/Windows/Linux via `pnpm tauri icon brand/tile-cobalt.svg`) | `tile-cobalt.svg` — 824 px squircle, 22% radius, 100 px margin, paper mark |
| Favicon / in-app tiles | `../public/favicon.svg` (full-bleed cobalt tile) and the `mask` glyph in `src/components/AppIcon.vue` |

Everything is hand-written SVG; no fonts are embedded. Regenerate the platform icons with:

```sh
mise exec -- pnpm tauri icon brand/tile-cobalt.svg
```

## Colours

Taken from the personal brand kit, so the two marks sit together on wotdafong.dev.

| Token | Light | Dark |
| --- | --- | --- |
| Ink (brackets) | `#262a25` | `#ebeae2` |
| Paper | `#f7f5ee` | `#151713` |
| Cobalt (dash, tiles) | `#3453b6` | `#93a9ff` |

## Rules

- Brackets are ink, the dash is cobalt. On a cobalt tile or in single-colour use, everything is paper/white.
- The dash tilts −4°, like the personal brand's sticker and tile. Nothing else tilts; the brackets stay upright.
- The wordmark is the product name set in the UI's system sans at 650 weight: **Offline** in ink, **Mask** in cobalt. The hidden part is the accent. Never colour the whole word, and never write it as "Offline Mask" or "offlinemask" in UI copy.
- Lockup: tile or bare mark to the left of the wordmark, gap about a quarter of the mark's width, vertically centred on the x-height.
- Minimum sizes: mark 14 px, tile 16 px, wordmark 18 px tall.
- Clear space: the width of one bracket arm on every side.
- No shadows or gradients on the mark itself; the UI's `3px 4px 0` sheet shadow may sit under a tile.

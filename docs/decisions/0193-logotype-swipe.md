# 0193 — The logotype: "Mask" under the brush swipe

Date: 1 November 2026. The owner noted that the app had a mark, the ninja's mask, but no logotype: the name was only typeset (Noto Sans 750, "Mask" in cobalt, [0118](0118-one-logo.md)), so nothing tied the lettering to the mark.

## Options

Four directions were drawn on a design canvas, each in the brand's Noto Sans and colours:

- **A · Swipe:** a cobalt brush swipe lies behind "Mask", and the word reads through it in the background colour. What is hidden is still readable, which is what the product does.
- **B · Mask on the i:** the dot of the "i" is a small swipe with eye holes.
- **C · Eye slit:** a thin brush cut runs through "Mask" at eye height.
- **D · A with C's slit** cut across the swipe.

The owner liked A and C and chose **A**. The first draft of A was hard to read: the swipe thinned toward the right and tilted −4°, so the tops of "s" and "k" left it and disappeared into the background. The chosen version tapers much less, is 1.1 em tall, and tilts −2.5°, so the whole word stays inside it.

## What

- **One swipe, generated.** `make_mark.py` draws it with the mark's own brush (`wordmark_swipe()`: the same `line`, `brush` and `wobble`, heavy where the pen lands, caps squashed so they stay round once stretched). `build.py` writes it to `brand/wordmark-swipe.svg`, a one-colour shape in a 220×100 box with `preserveAspectRatio="none"`. `brush()` gained a `squash` argument for its caps; the mark, tiles, favicon and paths it already drew are byte-for-byte unchanged.
- **Drawn as a mask behind live text.** Everywhere the logotype appears, "Mask" is an inline block (0.1 em after "Offline", 0.12 em padding, line height 1, −0.02 em tracking) whose `::before` is the swipe: `mask: url(wordmark-swipe.svg) 0 0 / 100% 100%`, 1.1 em tall, filled with the accent. The word stays text, so it is selectable, read aloud as "OfflineMask" and follows the theme. The box is set in em for Noto Sans's metrics, which is why the face is bundled rather than taken from the system.
- **Colours.** On paper: cobalt swipe, letters in `--on-accent`. On dark: the dark accent and dark `--on-accent`. On cobalt (the website hero, share images, blog cards): the light cobalt `#b3c3ff` swipe with cobalt letters, replacing "Mask in light cobalt".
- **Where.** The app's `.brand-accent` (sidebar, folded top bar, Cài đặt, the about lockup); the website's `.om-brand` lockups (every page header) and the hero, where the swipe is brushed on after the letters rise (none with reduced motion); `landing/cards.js`, the blog share cards drawn by Satori, which places the swipe as an image; `landing/og/card.html` and `brand/social/cover.html`, with `og.png` and `cover.png` re-rendered (the cover's wordmark is now 112 px so it stays clear of the screenshot).
- **Not changed.** The product name inside a sentence (`.om-name` on the website) stays plain lettering with "Mask" in cobalt: a swipe in running text would shout. The mark, app icon and favicon are unchanged. The screenshots on the website and in the share images still show the old sidebar until they are next retaken. The brand preview sheet's wordmark is live SVG text, which cannot be fitted to a swipe without measuring it, so it is left as is.

## Checked

The website hero and header (1280 px), the privacy page at phone width, the app sidebar in light and dark, a rendered blog card, `og.png` and `cover.png`.

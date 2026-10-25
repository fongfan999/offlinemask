# 0141 — An animated logo instead of the top bar

Date: 25 October 2026. Status: implemented. Owner: "anything we can improve this top bar, is that useful for users who are trying to understand what this app is? I'm open to remove everything, keep only an animated logo", then "Replace the top bar with the small animated logo as described."

## Problem

The landing page's top bar was a pill fixed at the top centre: the logo and three links, "Cách hoạt động", "Tính năng" and "Quyền riêng tư". It did not help someone work out what the app is:

- The page is a story told by scrolling, and the links only jumped to sections a visitor reaches anyway.
- The words describe any app, not this one.
- The same links are in the footer's Sản phẩm column.
- Pinned at the centre, the pill sat over the centred headings while scrolling, for example over the download heading.
- Downloading already has the bottom bar, so the top does not need a download button the way Dia's does.

## Decision

- **The pill and its links are gone.** Only the mask logo remains, 42 px (38 px on phones), fixed in the top-left corner, away from the centred headings. Clicking it returns to the top, and its label is "OfflineMask — về đầu trang". A paper ring and a soft shadow keep the cobalt tile visible over the cobalt hero and download bands.
- **It is the real mark, inline.** The SVG path comes from `brand/mark-mono-black.svg`: the swipe with its two eye holes, filled even-odd, on the cobalt tile at the same 15% inset as the footer lockup. Two paper circles, the lids, sit over the eye holes at the positions in `brand/make_mark.py` (`EYES`).
- **The animation tells the brand story.** On load the swipe is painted on from left to right, like a mask being brushed on (`clip-path` inset, 0.7 s, starting at 0.15 s). Then the lids close and open once (scaleY, 0.24 s, at 1 s), so the eyes blink. Hovering or focusing blinks again and tips the tile slightly. It is CSS only, so it plays with the first paint, before `main.js` loads the page script. With reduced motion the logo simply appears.
- **No wordmark beside it.** The hero already spells "OfflineMask" in large animated letters.

## Verification

In the in-app browser (dev server), both animations ran on load and ended with the mask complete and the eyes open. Frames rendered at 120 px showed the empty tile, the swipe half painted, the full mask, half-shut eyes and closed eyes. The old nav markup is gone, there is no horizontal overflow and the console shows no errors. `pnpm lint` and `pnpm test` pass. Not checked: Safari's rendering of `clip-path` inset on an SVG path, and a real reduced-motion setting, which only removes the animation.

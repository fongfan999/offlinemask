# 0111 — Landing page motion that explains the boundary

Date: 2026-10-20

## Context

After the clarity and trust pass (0110), the owner asked for the motion group from the landing audit: values that visibly change when masked and restored, a demo that plays on view, a scroll-driven section showing what crosses to the AI, and previews for the supported formats.

## Decision

- **Morphing values.** In the hero example, switching between real values and aliases scrambles each value through redaction blocks (`█▓▒░`) with GSAP ScrambleTextPlugin, instead of only flashing its background. The plugin ships in the already pinned `gsap` 3.15.0 package under the same Standard GSAP license (see 0105); no dependency is added.
- **Play on first view.** This changes 0109, where playback only started on request. The four-stage example now plays once when it first scrolls into view, if the visitor has not used its controls. The play button switches to "Dừng minh họa" while it runs, any control stops it, and it never starts or continues with reduced motion or a hidden document.
- **Boundary journey.** The three static workflow cards lose their mini visuals and become captions under one illustration: "Máy của bạn" and "Công cụ AI bạn chọn", separated by a dashed "Ranh giới". Without JavaScript, with reduced motion, or below 850 px, the illustration is static: the masked copy sits with the AI and the lookup table stays on the device. On wide screens with motion allowed, the section pins and scrolling scrubs the round trip: values are masked at home and the lookup table appears, the masked copy crosses to the AI and comes back as a reply, then the values are restored. The caption for the current step is highlighted. The illustration is `aria-hidden`; the captions carry the explanation.
- **Format previews.** The `Tt ▦ W` glyphs become small text, spreadsheet and document miniatures whose cobalt redaction marks sweep in once on view. Static, they show the masked state.

All motion is transform, opacity, text or CSS-variable based and created inside GSAP `matchMedia`, so a preference or width change reverts it to the static markup. The journey's cleanup restores its values and caption state. No storage, telemetry or network requests are added.

## Verification

`pnpm lint` and `pnpm -C landing build` pass. In the in-app browser at 1280 px: the hero example autoplays from the original and morphs values; the journey pins (one pin spacer), and at 25 %, 50 % and 97 % of its scroll shows the masked copy at home with the lookup table, the AI reply on the AI side, and the restored copy at home, with the matching caption highlighted. At 375 px there is no pin, no horizontal overflow, and the static composition reads top to bottom. No console errors. A real reduced-motion preference and Safari scrolling were not exercised.

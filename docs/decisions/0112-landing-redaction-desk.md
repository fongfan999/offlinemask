# 0112 — Landing page as a redaction desk

Date: 2026-10-20

## Context

After 0110 and 0111 the owner judged the landing page "slightly better, but not good enough". A full-page review found four problems. The demo sat in boxes nested four deep, with 11–12px text, so its key moment (a value becoming a code) was a tiny chip. Every section repeated a left-heading, right-list template under numbered mono eyebrows. The hero demo, a use-case strip and a pinned scroll section told the same story three times. Body copy was 12–14px muted text.

## Decision

Rebuild the page around one idea, an editorial redaction desk, within the existing palette, fonts and brand rules (flat sheets, hard offset shadows, italic serif emphasis).

- **Hero:** a centred headline, one lead sentence, two buttons and three short notes, with no eyebrow clutter.
- **One large document is the demo.** Three tabs ("Bản của bạn", "Gửi cho AI", "Nhận kết quả") replace the four-step window. Text is 18–23px. Real values carry a warm highlight (`--warm`), codes are cobalt chips, and restored values have a cobalt underline. A location chip and a single footnote say where the document is and why it matters. The request now includes a CCCD and a phone number, so five values show the scale. The restored stage shows the AI reply arriving in codes and morphing back. Static markup shows the coded request. This replaces the 0109/0111 four-stage window; autoplay on first view and the stop control remain, and each tab shows a progress bar while playing.
- **One trust diagram replaces the pinned journey from 0111.** The lookup table "Máy của bạn" sits beside the coded text "AI chỉ thấy", separated by a dashed "Ranh giới". On view, the codes slide across. There is no pinning; three numbered steps follow as plain text.
- **Detection and formats merge into one section:** two chip cards (built in / Vietnamese pack) above three format cards with larger redaction previews.
- **Cuts:** the use-case pill strip, numbered eyebrows and the oversized window chrome are removed. Privacy becomes a 2×2 grid; FAQ and download keep their content at larger sizes.
- **Type scale:** body text is 16–17px, section leads 19px, h1 up to 84px and h2 up to 62px. Every italic serif line balances on its own.

No dependencies, storage, telemetry or network requests are added. The detected-data list still follows 0110.

## Verification

`pnpm lint` and `pnpm -C landing build` pass. Static layout was reviewed at 1440 px with reduced motion forced (headless Chrome). In the in-app browser at 1280 px, light and dark, the demo autoplays through all three stages, values morph and restore, and the diagram animates on view. At 375 px there is no horizontal overflow and the tabs, document and diagram stack cleanly. Safari was not exercised.

# 0176 — Copied identity cards

Date: 30 October 2026. Status: built and measured. Follows [0172](0172-own-line-recogniser-for-windows.md) ("The owner's own scans"), [0174](0174-forms-with-a-column-of-labels.md) and [0175](0175-signature-names-on-copier-scans.md).

## Problem

Contracts and applications are filed with a copy of a party's citizen identity card (căn cước công dân), front and back, often photographed and pasted onto the last page. Everything on a card is its holder's: the number, name, birth date, sex, home town, residence, expiry date (which follows from the birth date), distinguishing marks, and three machine-readable lines (ICAO 9303, TD1) that repeat the number, birth date, expiry and name. On one of the owner's contracts the card's number was masked; its machine lines, birth date, home town and part of its residence were not.

A card's labels are tiny and bilingual ("Ngày sinh / Date of birth"), on a patterned grey ground, so text recognition garbles most of them ("Ngty dm/Dac cbữ: 04/08/1968"). No label rule can find the values after them. The machine lines are printed in OCR-B, which the recogniser never learnt: it reads the fillers "<" as C, K, "(" or "+". In scans the card's lines are also often joined, the title to the motto above it and the three machine lines into one paragraph. The synthetic set had no cards.

## Decision

- **A card is found and its text hidden** (`doc/id-card.ts`, applied in `maskParagraphs` beside the repeated values of 0171). A card starts at its title in capitals ("CĂN CƯỚC CÔNG DÂN", "CĂN CƯỚC", "CHỨNG MINH NHÂN DÂN", "Citizen Identity Card"; prose such as "căn cước công dân số …" is not a title) or at its first machine line ("IDVNM…"). From there, every paragraph is the card's until its machine lines end (the first and up to two more lines of capitals, digits and fillers), its page ends, or 25 paragraphs have passed. All of its text is hidden as `GIAY_TO` ("Căn cước"), one piece per stretch between the card's printed wording and what other rules already found, which keep their own aliases (a name stays the same `TEN` alias as elsewhere in the document).
- **The printed wording stays** (`identityCard` in `vocabulary/document-wording.json`): the national header and motto, the title, "CỤC TRƯỞNG CỤC CẢNH SÁT QUẢN LÝ HÀNH CHÍNH VỀ TRẬT TỰ XÃ HỘI" and the fingers' names, compared without tone marks so a misread mark still matches. Another rule's find inside that wording is dropped on a card (a model took part of the issuer's title for an organisation).
- **The garbled labels are hidden with the values.** Telling a misread label from a misread value is not possible on a card, and the AI needs neither; it still sees that a card was there, from its title.
- **The synthetic set gains a kind** `idcard` (layout `attached`): a short contract naming a party by her card, then the card's front and back at their real size (85.6 × 54 mm) on a grey ground, with small bilingual labels, a photo, the issuer and three machine lines with correct ICAO check digits in a monospaced bold font (Courier Bold, pdf-lib's standard font, nothing embedded); as PDF and Word. It is last in `kinds-more.mjs`, so every other document keeps its seed; a seed now gives 87 text documents. The card's issue date is "either way", as in every other kind.

## Measured

Through the app's code (`pnpm eval:documents`, the pack on this PC, `--reading` for scans, `--misread` where shown):

| | Before | After |
| --- | --- | --- |
| Cards, seeds 1–7, text PDF and Word (21) | 0 not read, **126 leaked**, 4 over-masked, 54 unlisted | 0 / 0 / 0 / 179 |
| Cards, seeds 1–7, scanned (14) | 56 not read, **42 leaked**, 0 over-masked, 8 unlisted | 56 / 0 / 0 / 111; misread: 0 readable |
| Cards, seeds 1–7, photographed and tilted 1.5° (14) | — | 57 / 0 / 0 / 88; misread: 0 readable |
| Seeds 1–7, text (546) | 0 / 0 / 0 / 0 | the same |
| Seeds 1–7, scanned (703) | 42 / 0 / 6 / 71; misread: 0 readable | the same |
| Appendix forms of 0174, text (42) and scanned (56) | 0 / 0 / 0 / 0 and 17 / 0 / 0 / 19 | the same |

"Before" was measured with the card's issue date still marked as must-hide (7 of the text leaks and 7 of the scanned); the generator now marks it either way. Unlisted rises because the card's labels and wording around the values are hidden with them. The values not read on the scanned cards are mostly the machine lines, read with other fillers; they sit inside the hidden stretch.

On the owner's contract, the card page is hidden from its title to the end of its machine lines.

## Not decided here

`readingShipped` stays off (0172). Cards of other countries, passports (TD3, two lines of 44) and driving licences are not recognised; a passport's machine lines start "P<" and would need their own start. What the owner's documents still miss after 0174–0176 is copier misreading of values masked nowhere else in the document (a phone, an e-mail address, a price table), which needs a recogniser trained also on copier print.

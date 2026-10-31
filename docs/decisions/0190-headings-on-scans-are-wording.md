# 0190 — Headings on scans are wording, with the party and the title that follow them

Date: 31 October 2026. Status: measured through the app, committed; `readingShipped` stays off. Follows [0188](0188-wording-read-with-other-tone-marks.md) and the over-masks recorded in [0187](0187-close-set-lines-read-again.md).

## Problem

On scans, the contextual models hid some of a document's own headings as names, places or organizations, though the same paragraph in the text PDF is not hidden. Every case is printed wording the phrase veto (decisions 0155, 0160, 0188) did not cover:

- a signature block's "ĐẠI DIỆN BÊN A" / "ĐẠI DIỆN BÊN B": "đại diện" is wording, but a run of wording could not take a contract party with it, so the span reaching into "BÊN A" was kept;
- the motto run into a title ("… Hạnh phúc ĐƠN XIN VIỆC", "… Hạnh phúc CĂN CƯỚC CÔNG DÂN" on a copied card): neither "tự do - hạnh phúc" nor the title was wording, nor was a card's front title;
- a handover's title "BIÊN BẢN BÀN GIAO TÀI SẢN" ("tài sản");
- a meeting's subject and agenda ("kế hoạch kinh doanh").

## Decision

- **More wording** (`vocabulary/document-wording.json`): "tự do - hạnh phúc" and "đơn xin việc" (forms), "tài sản" (records), "kế hoạch" (letters).
- **A card's front titles are wording** (`detection/vocabulary.ts`): the titles `identityCard.fronts` already lists to find a card ("căn cước công dân", …) join the phrases.
- **A run of wording may take a contract party** (`detection/model-policy.ts`): after a phrase, the run continues over "Bên A", "bên thuê", "các bên" (the party pattern the vocabulary already had), so "ĐẠI DIỆN BÊN A" is one run. A run still starts with a phrase, and only a span wholly inside it is dropped: "Đại diện Bên A: Trần Hạnh Phúc" keeps the name, and so does any find reaching past the run.

"phúc CĂN", which 0187 recorded as unsafe to drop by overlap with the card's title, is now dropped because it lies wholly inside the motto-and-title run; a name read just before the title still reaches outside it and is kept.

## Measured

Through the app (`evaluate-documents.mjs --reading`), not read / leaked / over-masked / unlisted:

| Documents | 0188 | This one |
| --- | --- | --- |
| Text PDFs and Word, seeds 1–7 (546) | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Copier scans, seeds 1–7 (703) | 28 / 0 / 8 / 82 | 28 / 0 / 2 / 80 |
| Grey scans, seeds 1–7 (703) | 7 / 0 / 3 / 59 | 7 / 0 / 2 / 59 |
| Photographed and tilted 1.5° (703) | 9 / 0 / 6 / 57 | 9 / 0 / 3 / 57 |
| Appendix forms scanned (56) | 5 / 0 / 0 / 5 | 5 / 0 / 0 / 5 |
| Identity cards scanned (14) | 14 / 0 / 1 / 111 | 14 / 0 / 0 / 102 |
| Identity cards photographed (14) | 18 / 0 / 0 / 114 | 18 / 0 / 0 / 106 |

Gone: "ĐƠN XIN VIỆC", "ĐẠI DIỆN BÊN A" and "ĐẠI DIỆN BÊN B" (copier, as PDF and picture), "BIÊN BẢN BÀN GIAO TÀI SẢN" (grey and photographed), the meeting's subject and agenda with "kế hoạch" (photographed), the motto on a scanned card. The unlisted that went are the cards' titles and a payslip's misread title hidden as part of the page. No over-mask is new.

The over-masks that remain are not wording, one by one:

- Copier scans, seed 1, a delivery slip as PDF and as picture, and photographed, seed 6, its PDF: "Sách Đắc Nhân Tâm", a book's title in the order table, taken for a name. A title is not wording and a name model cannot tell it from a name.
- Grey scans, seed 1, the same delivery slip as PDF and as picture: its note "Phí vận chuyển … Giao giờ hành chính." taken whole for a name.
- Photographed, seed 6, a CV as PDF and as picture: "Nhân viên", a job title read glued to the cell before it, taken for a name.

The copier form still has "Hạnh phúc ĐƠN" hidden as unlisted, a find reaching just past the run as the scan reads it.

The owner's documents, read again on the PC (in kinds only): every stretch the veto now takes as wording is contract, form or decision wording (headings, the motto, terms, parties, amounts in words), none a person's name.

## Dependencies

None.

## Not decided here

`readingShipped` stays off (0181): opening the Windows reading, with `landing/privacy.html` and its date line, is the owner's. Book titles and job titles in tables, which no wording list can hold.

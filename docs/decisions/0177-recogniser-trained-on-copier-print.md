# 0177 — The recogniser trained also on copier print

Date: 30 October 2026. Status: trained, measured through the app, committed in place of 0172's recogniser; `readingShipped` stays off. Follows [0172](0172-own-line-recogniser-for-windows.md) ("The owner's own scans") and [0176](0176-copied-identity-cards.md).

## Problem

After 0174–0176, what the owner's documents still missed was misreading of a real copier's print: a phone number and an e-mail address on a business registration, read with slashes and wrong letters, and whole lines of a contract read as nonsense. Looked at on the PC (nothing of them is recorded here but kinds):

- The contracts are office-copier scans: every pixel black or white, the toner spread so that strokes are heavy and letters touch. 0172's recogniser learnt only grey print (blur, noise, JPEG) and never a bi-level line.
- Their lines are close-set, so a line's box takes in the foot of the line above and the head of the line below. The lines read worst are those.
- The registration prints its values (the phone, the e-mail address) in italics; one of the 27 training fonts is italic.
- Everything is Times New Roman, the typeface Vietnamese administrative documents use (Decree 30/2020/NĐ-CP); Tinos, which has its metrics, was 3 of the 27 fonts.

The synthetic scans had no copier print either: the 703 scans of 0172 are grey JPEGs.

## Decision

- **Copier print in training** (`scripts/ocr-train/train.py --copier 0.3`): that share of lines is drawn black on white, in Tinos for 30 % of them and any other training font otherwise, then through `bilevel`: the toner spread (a 3 × 3 minimum, 40 % of lines of 24 px and more) or thinned (a maximum, 15 % of those of 30 px and more), the line read at 0.5–0.9 of its resolution, blurred a little, noised and cut at one grey between 100 and 200 into black and white, specks on a fifth of lines in up to 0.1 % of pixels, drawn back at its size sharp or smoothed, and printed in ink 0–70 on paper 225–255. A line that comes out a blot or blank is not used. 40 % of copier lines get pieces of other lines 1.0–1.3 font sizes above and below, cut off by the box; 12 % are slanted by 0.12–0.25 as italics are. The other 70 % are drawn as in 0172.
- **The texts as the documents now print them** (`scripts/ocr-train/export-lines.mjs`): exported again from today's generator, so they include a field's value as a form with a column of labels prints it (": 28/04/1994", 0174) and a copied identity card's lines (0176): 586 856 lines from seeds 100–399, 29 917 validation lines from seeds 400–409.
- **A fine-tune, not a new model** (`--init`): from 0172's checkpoint, with its alphabet of 231 classes, so `reading-v1.json` keeps its alphabet and only the recogniser's digest changes. AdamW at 5e-4 with a fresh warm-up and cosine schedule, batches of 48, two and a half hours on the same CPU: 16 123 steps. The checkpoint kept (step 16 000) is the best by (2 × clean + copier) / 3 of the character error on the validation lines, so a gain on copiers cannot be bought with clean scans. The documents' own fonts stay held out.
- **Copier scans to measure on** (`scripts/rasterise-documents.mjs --copier`): each page at 200 dpi, a pixel black where any of its 2 × 2 block is darker than grey 150 (the toner spread by about a pixel), white otherwise, a speck in one pixel in two thousand, kept as PNG, as a copier keeps a fax-coded picture losslessly. Its look is measured, not its coding (0173 decodes that).
- **Three rules for what copier print still misreads**, each with a test:
  - A signature note whose "Ký" is lost ("(ý, ghi rố họ tên)") is still the note when "ghi rõ họ tên" follows, whatever its marks (`detection/person-cues.ts`). Its names are one line: the line after a line of names is not read, as a page's "Trang 1/1" read "Trang VI" was taken for one.
  - The "số" after "CCCD" may carry another mark ("CCCD só:", `detection/banking.ts`).
  - A name hidden whole elsewhere outranks part of it found on another line (`doc/mask.ts`): a signature line where the model found "VŨ NGUYỄN" of a four-word name hides all four.

A first fine-tune, at a copier share of 0.4, with specks on two lines in five, from the texts of before 0174, kept by the plain mean of the two errors, was not shipped: it cut the copier leaks from 45 to 3 but leaked on the scanned forms (8) and identity cards (6 scanned, 10 photographed), because it dropped or garbled the colon at the start of a box (": Giám đốc" read ".Giám đốc"), so 0174's label and value no longer joined. The specks had taught it that small dots are dirt, and no training line started with a colon.

## Measured

Validation lines (seeds 400–409, 2 000 of each, fonts held out):

| | 0172's recogniser | This one |
| --- | --- | --- |
| As drawn in 0172 | 0.43 % characters wrong, 94.6 % lines exact | 0.40 %, 96.3 % |
| As a copier leaves them | 12.4 %, 52.6 % | 2.7 %, 81.2 % |

Through the app's code (`pnpm eval:documents`, the pack on this PC, `--reading --misread` for pictures), not read / leaked / over-masked / unlisted:

| Documents | 0172's recogniser and rules | This one |
| --- | --- | --- |
| Text PDFs and Word, seeds 1–7 (546) | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Copier scans, seeds 1–7 (703) | 179 / 45 / 2 / 255 | 30 / 1 / 12 / 90 |
| Grey scans, seeds 1–7 (703) | 42 / 0 / 6 / 71 | 12 / 0 / 2 / 50 |
| Photographed and tilted 1.5° (703) | 42 / 0 / 6 / 65 | 12 / 0 / 4 / 64 |
| Appendix forms scanned (56) | 17 / 0 / 0 / 19 | 3 / 0 / 0 / 4 |
| Identity cards scanned (14) | 56 / 0 / 0 / 111 | 24 / 0 / 0 / 126 |
| Identity cards photographed (14) | 57 / 0 / 0 / 88 | 20 / 0 / 0 / 90 |

The copier leak, one by one: in `1/statement/statement-classic-2`, the scan, an account number after "chuyen tien den TK", read exactly, but with the "TK" read as a cell of its own, so the line came out "TK · 1091…" and the account's cue no longer touched it. Fixed after this table: after "chuyen tien den", the transfer rule (`detection/banking.ts`) takes the number past a " · ", with or without the "TK". Measured again, all 31 copier-scanned statements of seeds 1–7 leak 0 and over-mask 0; so do the 62 grey-scanned and photographed statements, and the 546 text documents stay 0 / 0 / 0 / 0.

The over-masks, one by one (the text documents have none, so each is recorded as 0171 asks; a PDF and its PNG count as two):

- Copier scans (12): a book's title in an order ("Sách Đắc Nhân Tâm", `1/order/order-delivery-2`); the signer's title "GIÁM ĐỐC SỞ TƯ PHÁP TỈNH LÂM ĐỒNG" (`2/decision/decision-benefit-2`); the heading "ĐƠN XIN VIỆC" (`4/form/form-application-2`); the agenda paragraph of `4/minutes/minutes-meeting-2`; "ĐẠI DIỆN BÊN A" and "ĐẠI DIỆN BÊN B" over the signatures (`6/contract/contract-rental-1`).
- Grey scans (2): the heading "BIÊN BẢN BÀN GIAO TÀI SẢN", in the PNG of `3/minutes/minutes-handover-1` and the PDF of `7/minutes/minutes-handover-2`. 0172's recogniser had 6 here.
- Photographed (4): the same heading in the PDF of `1/minutes/minutes-handover-1`; the agenda paragraph in the PNG of `4/minutes/minutes-meeting-2`; the word "Nhân viên" in `6/form/form-cv-2`. 0172's had 6.

Each is a heading, a title or a paragraph of print hidden whole; none is a value left visible.

The owner's documents, read again on the PC: on the registration the phone number is read exactly and masked, and the e-mail address, read with two letters wrong, is still an e-mail address and masked; the enterprise code is masked, under a phone's alias. On the appendix the price tables read, and a party's ID number after a misread "số" is masked. On the service contract the party's name on the signature line is hidden whole. What still reads poorly is a few close-set lines of the copier contracts as a whole, and capitalised contract terms misread into name-like words ("Sự Kiện Bất Khả Kháng" read with other letters) are hidden as names.

## Dependencies

None new. Training uses 0172's locked environment (`scripts/ocr-train/uv.lock`) and fonts; the recogniser is the project's own work, 7 258 670 bytes, sha256 `481b00cc500313fa4cf3247991e006770c1af23cf37e1281f0b56c3bf4dede08`, replacing 0172's file and its digest in `reading-v1.json` in one change, as 0172 decided.

## Not decided here

`readingShipped` stays off (0172); opening it is the owner's decision. The close-set lines that still read poorly would need the detector's boxes cut between the lines rather than a better reader of what is in them. An account label read apart from its number is found again only after transfer wording; elsewhere, a " · " between a label and its value still parts them.

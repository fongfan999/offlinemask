# 0187 — Close-set lines read again in a box stopped short of their neighbours

Date: 31 October 2026. Status: measured through the app, committed; `readingShipped` stays off. Follows [0186](0186-recogniser-trained-on-copier-print.md) ("Not decided here").

## Problem

After 0186, what the owner's copier contracts still read poorly was a few paragraphs of close-set lines, read as nonsense ("đã về ni ông cng việc và di phí phỉ snh…"). Looked at on the PC (in kinds only):

- Every line's box is the detector's region pushed out by `unclip` (1.5) and grown by `grow` (a quarter of it): about 3.7 times the region's height, which is about the lines' x-height. On lines set 1.2 font sizes apart that is 1.5 to 1.6 font sizes: the box takes in the foot of the line above and the head of the line below.
- On a copier's bi-level print the detector's region of a close-set line comes out a little taller (17–19 pixels on a page where its neighbours' are 15), and the box with it (63–71 pixels against 56). The badly read lines were those: about two thirds of a line's height of its neighbours in the box, more than the recogniser learnt (0186 drew pieces of neighbours at 1.0–1.3 font sizes, cut by margins of at most 0.45).
- The detector does not join two lines into one region: the tallest regions on those pages are stamps and signatures.

## Decision

- **Read again, keep the surer reading** (`doc/reading.ts`). Where a line's box reaches toward a neighbouring line's core (another region overlapping it across), the line is read a second time in the same box stopped part of the way to that core: 0.6 of the gap above, 0.5 below, since a line's stacked tone marks stand above it and its descenders below are short. It is read again only where that takes off more than 5 % of the box. Of the two readings, the one whose letters the recogniser gave the higher mean probability (each word weighted by its length) is kept; the words keep the line's place either way.
- Always taking the shorter box was tried first and not kept: it read the contracts' prose right but misread a copied card's tightly set machine-readable lines and title ("IDVNM" as "I DNM" and "IDVNH"), so the card of 0185 was no longer found and its text leaked. A limit of 0.7/0.6 and of 0.8/0.7 still misread them. Painting out a neighbour's ink that touches the box's edge without reaching the line's core changed a few words, better and worse, and the nonsense stayed; it was not kept.
- **A card's title past a speck** (`doc/id-card.ts`): the title may have a dot, a colon, a comma or a "·" between its words ("CĂN. CƯỚC: CÔNG DÂN", a copier's specks read as marks). With the second reading that was how the owner's copied card read, and nothing else found the card.
- **"Họ, chữ đệm và tên" is a name label** (`detection/vocabulary/field-labels.json`, with "Họ, chữ đệm và tên khai sinh"): government forms (business registration, identity applications) put a person's full name after it, and only the name model found it (see Measured).

## Measured

Through the app (`evaluate-documents.mjs --reading`), not read / leaked / over-masked / unlisted:

| Documents | 0186 | This one |
| --- | --- | --- |
| Text PDFs and Word, seeds 1–7 (546) | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Copier scans, seeds 1–7 (703) | 30 / 1 / 12 / 90 (the leak closed by 0186's transfer rule since) | 28 / 0 / 8 / 86 |
| Grey scans, seeds 1–7 (703) | 12 / 0 / 2 / 50 | 7 / 0 / 3 / 61 |
| Photographed and tilted 1.5° (703) | 12 / 0 / 4 / 64 | 9 / 0 / 6 / 57 |
| Appendix forms scanned (56) | 3 / 0 / 0 / 4 | 5 / 0 / 0 / 5 |
| Identity cards scanned (14) | 24 / 0 / 0 / 126 | 14 / 0 / 1 / 111 |
| Identity cards photographed (14) | 20 / 0 / 0 / 90 | 18 / 0 / 0 / 114 |

The second reading costs no time that shows: 3 633 s for the copier scans against 3 671 s, 3 722 s for the grey ones against 3 921 s (most lines have no neighbour close enough to be read again).

Over-masks that are new, one by one. Each is the contextual name model's guess on a line read right, whose guess moved because other lines of the page now read differently (the same paragraph in the text PDF is not hidden):

- Grey scans, seed 1, a delivery slip as PDF and as picture: "Giao giờ" in its note ("Giao giờ hành chính") taken for a name.
- Photographed, seed 1, a meeting's minutes: "kế hoạch" in its subject taken for an address.
- Photographed, seed 6, a delivery slip: "Sách Đắc" of a book's title taken for a name (the copier scans of seed 1 already did it under 0186).
- Identity cards scanned, seed 4: "phúc CĂN", the end of the national motto and the start of the card's title, taken for a name. A find that runs into a card's title is not dropped: a real name read just before the title would be dropped with it. (Dropped since [0190](0190-headings-on-scans-are-wording.md), as lying wholly inside a run of wording.)

The copier scans lose two over-masks of 0186 (a decision's signatory title and a meeting's agenda). The unlisted on the cards' pages are their garbled bilingual labels, hidden as part of the card, cut differently.

The owner's documents, read again on the PC (in kinds only): the service contract's close-set paragraphs read close to right; its copied card is found by its title and its machine lines and hidden from one to the other; the party's name on the signature line, now read right, is hidden; the phone and e-mail address stay masked. Some capitalised contract terms are still hidden as names, others no longer. On the registration, the legal representative's name after "Họ, chữ đệm và tên:" was found only by the name model, which with the page read a little differently took two of its three words; that label of government forms joins the name labels (`field-labels.json`, with its "… khai sinh" form), so the name is hidden whole by its label. The appendix and the decision keep everything they masked.

## Dependencies

None.

## Not decided here

`readingShipped` stays off (0181). The box's `unclip` and `grow` stay PaddleOCR's and 0181's for every line that has no close neighbour.

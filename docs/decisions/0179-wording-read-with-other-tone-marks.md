# 0179 — Document wording read with other tone marks is still wording

Date: 31 October 2026. Status: measured through the app, committed; `readingShipped` stays off. Follows [0178](0178-close-set-lines-read-again.md) and [0177](0177-recogniser-trained-on-copier-print.md) ("capitalised contract terms … are hidden as names").

## Problem

On the owner's copier contracts, capitalised contract terms that text recognition misread were hidden as names or organizations: "Sự Kiện Bất Khả Kháng" read with other tone marks ("Sự Kiện Bát Khà Kháng", taken whole or in pieces), "Thù lao" read "Thủ lao", "Bên đó". These terms are already in the wording a model's name, place or organization may not be (`document-wording.json`, the phrase veto of decisions 0155 and 0160), but the veto compared them with their tone marks, so one misread mark let the model's guess through. Tone marks are what copier print loses most: they are small, and a speck or a gap changes one into another.

## Decision

- **The phrases are also compared without tone marks** (`detection/vocabulary.ts`, `detection/model-policy.ts`): a model's span wholly inside a stretch that reads as a phrase once marks are set aside ("su kien bat kha khang") is dropped, as one inside the phrase as printed always was.
- **Only phrases with a word no name has.** A phrase every word of which is a family name or a name syllable (`people.json`) keeps the comparison with its marks: "thanh toán" would otherwise take "Thanh Toàn" and "phạt" "Phát", real names. "Sự kiện bất khả kháng" ("sự", "bất" are no name's) and "thù lao" ("lao") are compared without marks; "thanh toán", "phạt", "án" are not.
- A span reaching past the phrase is kept, as before: "Nguyễn Thanh Toán" or a name read just after a term stays a name.
- **"Bên đó", "bên này", "bên ấy" are contract parties** (`partyRoles`), as "bên kia" was.

## Measured

Through the app (`evaluate-documents.mjs --reading`), not read / leaked / over-masked / unlisted:

| Documents | 0178 | This one |
| --- | --- | --- |
| Text PDFs and Word, seeds 1–7 (546) | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Copier scans, seeds 1–7 (703) | 28 / 0 / 8 / 86 | 28 / 0 / 8 / 82 |
| Grey scans, seeds 1–7 (703) | 7 / 0 / 3 / 61 | 7 / 0 / 3 / 59 |
| Photographed and tilted 1.5° (703) | 9 / 0 / 6 / 57 | 9 / 0 / 6 / 57 |
| Appendix forms scanned (56) | 5 / 0 / 0 / 5 | 5 / 0 / 0 / 5 |
| Identity cards scanned (14) | 14 / 0 / 1 / 111 | 14 / 0 / 1 / 111 |
| Identity cards photographed (14) | 18 / 0 / 0 / 114 | 18 / 0 / 0 / 114 |

What changed is only wording no longer hidden: a payslip's title read "PHIỀU LƯƠNG" (copier and grey scans) and a "Kỹ" of a handover's minutes. The synthetic contracts print their terms in lower case, so they had little of this to show; the owner's documents are where it was seen.

The owner's documents, read again on the PC (in kinds only): every stretch now taken as wording without its marks is contract or form wording (the force-majeure term in two misreadings, the fee, "giới tính", "sản phẩm" misread, "bên kia"), none a person's name. Terms misread with other letters, not only other marks ("Bên khối", garbled capitals), can still be hidden as names; that would need comparing letters, which would also reach names, and is not done.

## Dependencies

None.

## Not decided here

`readingShipped` stays off (0172). Comparing letters as well as marks.

# 0184 — Signature names on copier scans

Date: 29 October 2026. Status: built and measured. Follows [0181](0181-own-line-recogniser-for-windows.md) ("The owner's own scans") and [0183](0183-forms-with-a-column-of-labels.md).

## Problem

On the owner's two contracts, read through the app, two names on signature rows stayed visible although the same people were masked higher up:

- A representative's family name was read under the signature with another tone mark than in the parties' block ("NGÕ" there, "NGÔ" above). A value masked once is masked wherever else it stands whole ([0180](0180-scanned-pdfs-and-images-read-on-the-machine.md)), but only letter for letter, so the misread copy was a different value. The signature rule of [0154](0154-statement-and-contract-leaks.md) did not reach it either: the stamp over the signatures left no "(Ký, ghi rõ họ tên)" note to read.
- A four-word name ending in "QUÍ" was cut to its first three words in the parties' block and so could not be repeated under the signature. A name of more than three words must be made of known name syllables, and the list had "quý" but not "quí", the older spelling.

The synthetic scans do not show this: their print is clean enough that no name is misread (0 "misread and readable" values on all 703), so they serve here only to show that nothing else moves.

## Decision

- **A masked name is found again with other tone marks, or none** (`repeatedValues` in `doc/mask.ts`): the document's names of two words or more are also looked for with marks and case folded away, and a match counts where every word of it is capitalised, as names are written; a lowercase run of the same words ("ngô hoàng gia minh") does not. A match is hidden as a name under its own spelling, so its alias is its own and the copy restored from the AI keeps what the page says. Places and organisations stay letter for letter, as 0180 decided.
- **"quí" is a name syllable** (`vocabulary/people.json`), beside "quý".

## Measured

| | Before | After |
| --- | --- | --- |
| Seeds 1–7, text (546) | 0 not read, 0 leaked, 0 over-masked, 0 unlisted | the same |
| Seeds 1–7, scanned (703) | 42 / 0 / 6 / 71; misread values: 21 masked, 0 readable | the same |
| Appendix forms of 0183, text (42) and scanned (56) | 0 / 0 / 0 / 0 and 17 / 0 / 0 / 19 | the same |

On the owner's contracts, the representative's name under the signatures is masked, and the four-word name is masked whole in the parties' block. What these documents still miss, in kinds: misreadings of the copier's print where no masked copy of the value exists elsewhere (a phone, an e-mail address and a price table on the registration and a contract), and the photographed ID card. `readingShipped` stays off.

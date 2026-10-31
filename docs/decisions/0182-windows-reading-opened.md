# 0182 — Reading pictures with the app's own models is on

Date: 31 October 2026. Status: decided by the owner; the gate opened, the privacy page changed, pushed for release. Closes the "Opening it" question of [0172](0172-own-line-recogniser-for-windows.md); follows [0173](0173-pdf-picture-decoders-inside-the-app.md) to [0181](0181-headings-on-scans-are-wording.md).

## Problem

Since [0171](0171-scanned-pdfs-and-images-read-on-the-machine.md) scanned PDFs and pictures open on Tài liệu on macOS 14 and later, read by Apple's Vision framework. Since 0172 the same reading exists for Windows and older Macs with OfflineMask's own detector and recogniser, carried inside the app, but behind `readingShipped` (off) in `src/adapters/ocr.ts`: 0172 left opening it to the owner, after real scans had been read. Most of OfflineMask's users are on Windows, so until it opens the feature reaches few of them.

## What was done in between

The owner's four real documents (a colour scan of a business registration, two copier contracts, one with a photographed identity card, and a text PDF) were read on the PC on 29 October 2026 and missed values. Each kind of miss was fixed in turn, measured on the synthetic set before and after, and recorded:

- fax-coded and JBIG2 pictures in copier PDFs were not decoded at all ([0173](0173-pdf-picture-decoders-inside-the-app.md));
- forms with the labels in a column read as a two-column table ([0174](0174-forms-with-a-column-of-labels.md));
- signature names misread by one tone mark ([0175](0175-signature-names-on-copier-scans.md));
- a copied identity card's number, dates and machine lines ([0176](0176-copied-identity-cards.md));
- the recogniser had never seen bi-level copier print; it was fine-tuned on it ([0177](0177-recogniser-trained-on-copier-print.md));
- close-set lines read as nonsense ([0178](0178-close-set-lines-read-again.md));
- contract wording misread into name-like words hidden as names ([0179](0179-wording-read-with-other-tone-marks.md)), an enterprise code labelled as a phone ([0180](0180-enterprise-code-is-a-tax-code.md)) and headings on scans hidden whole ([0181](0181-headings-on-scans-are-wording.md)).

After 0181, through the app's code (`pnpm eval:documents --reading`), not read / leaked / over-masked / unlisted:

| Documents | |
| --- | --- |
| Text PDFs and Word, seeds 1–7 (546) | 0 / 0 / 0 / 0 |
| Copier scans, seeds 1–7 (703) | 28 / 0 / 2 / 80 |
| Grey scans, seeds 1–7 (703) | 7 / 0 / 2 / 59 |
| Photographed and tilted 1.5° (703) | 9 / 0 / 3 / 57 |
| Appendix forms scanned (56) | 5 / 0 / 0 / 5 |
| Identity cards scanned (14) and photographed (14) | 14 / 0 / 0 / 102 and 18 / 0 / 0 / 106 |

Every set leaks 0; the over-masks left are a book title, a delivery note and a job title (0181). On the owner's documents every private value that was found missing is masked, and what is hidden beyond that is contract or form wording, never a value left visible.

## Decision

- **`readingShipped` is on** (`src/adapters/ocr.ts`). Where the system has no Vietnamese recognition, Windows and Macs before macOS 14, the sidebar lists PNG and JPG with the documents and a scanned PDF or picture is read by the models in the app. The Mac path of 0171 is unchanged.
- **The privacy page says so** (`landing/privacy.html` §2, "Cập nhật ngày 31 tháng 10 năm 2026"): the text in a picture is read on the machine, on macOS 14 and later by the system's recogniser and on Windows by the model that comes with the app, installed with it and never downloaded; the picture is not kept and is not in the masked copy. `tests/privacy-contract.test.mjs` requires that sentence while both gates are on.
- **A build without the models fails while the gate is on** (`scripts/prepare-reading.mjs`). Before, a detector that could not be fetched left `public/reading/` out and the app silently offered no reading of its own; with the feature promised, a release must not lose it unnoticed. With the gate off the build still only reports it.
- **The PRD** no longer defers scanned pages on Windows.

## Not decided here

- **A Store build on a real copier scan.** The Windows reading was run end to end through `tauri dev` and the dev server (0172), not in an installed Store build; the first release carrying it should be installed and tried once on a copier scan before it is published.
- **Macs before macOS 14** get this reading, measured on Windows only (0172).
- **`media_ocr`**, the Windows.Media.Ocr engine of 0171, stays in the native module behind `WINDOWS_SHIPPED` (off); no Windows machine has a Vietnamese engine for it.
- Passports, driving licences and other countries' cards (0176); terms misread with other letters, not only other marks (0179).

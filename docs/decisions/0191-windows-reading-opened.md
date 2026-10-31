# 0191 — Reading pictures with the app's own models is on

Date: 31 October 2026. Status: decided by the owner; the gate opened, the privacy page changed, pushed for release. Closes the "Opening it" question of [0181](0181-own-line-recogniser-for-windows.md); follows [0182](0182-pdf-picture-decoders-inside-the-app.md) to [0190](0190-headings-on-scans-are-wording.md).

## Problem

Since [0180](0180-scanned-pdfs-and-images-read-on-the-machine.md) scanned PDFs and pictures open on Tài liệu on macOS 14 and later, read by Apple's Vision framework. Since 0181 the same reading exists for Windows and older Macs with OfflineMask's own detector and recogniser, carried inside the app, but behind `readingShipped` (off) in `src/adapters/ocr.ts`: 0181 left opening it to the owner, after real scans had been read. Most of OfflineMask's users are on Windows, so until it opens the feature reaches few of them.

## What was done in between

The owner's four real documents (a colour scan of a business registration, two copier contracts, one with a photographed identity card, and a text PDF) were read on the PC on 29 October 2026 and missed values. Each kind of miss was fixed in turn, measured on the synthetic set before and after, and recorded:

- fax-coded and JBIG2 pictures in copier PDFs were not decoded at all ([0182](0182-pdf-picture-decoders-inside-the-app.md));
- forms with the labels in a column read as a two-column table ([0183](0183-forms-with-a-column-of-labels.md));
- signature names misread by one tone mark ([0184](0184-signature-names-on-copier-scans.md));
- a copied identity card's number, dates and machine lines ([0185](0185-copied-identity-cards.md));
- the recogniser had never seen bi-level copier print; it was fine-tuned on it ([0186](0186-recogniser-trained-on-copier-print.md));
- close-set lines read as nonsense ([0187](0187-close-set-lines-read-again.md));
- contract wording misread into name-like words hidden as names ([0188](0188-wording-read-with-other-tone-marks.md)), an enterprise code labelled as a phone ([0189](0189-enterprise-code-is-a-tax-code.md)) and headings on scans hidden whole ([0190](0190-headings-on-scans-are-wording.md)).

After 0190, through the app's code (`pnpm eval:documents --reading`), not read / leaked / over-masked / unlisted:

| Documents | |
| --- | --- |
| Text PDFs and Word, seeds 1–7 (546) | 0 / 0 / 0 / 0 |
| Copier scans, seeds 1–7 (703) | 28 / 0 / 2 / 80 |
| Grey scans, seeds 1–7 (703) | 7 / 0 / 2 / 59 |
| Photographed and tilted 1.5° (703) | 9 / 0 / 3 / 57 |
| Appendix forms scanned (56) | 5 / 0 / 0 / 5 |
| Identity cards scanned (14) and photographed (14) | 14 / 0 / 0 / 102 and 18 / 0 / 0 / 106 |

Every set leaks 0; the over-masks left are a book title, a delivery note and a job title (0190). On the owner's documents every private value that was found missing is masked, and what is hidden beyond that is contract or form wording, never a value left visible.

## Decision

- **`readingShipped` is on** (`src/adapters/ocr.ts`). Where the system has no Vietnamese recognition, Windows and Macs before macOS 14, the sidebar lists PNG and JPG with the documents and a scanned PDF or picture is read by the models in the app. The Mac path of 0180 is unchanged.
- **The privacy page says so** (`landing/privacy.html` §2, "Cập nhật ngày 31 tháng 10 năm 2026"): the text in a picture is read on the machine, on macOS 14 and later by the system's recogniser and on Windows by the model that comes with the app, installed with it and never downloaded; the picture is not kept and is not in the masked copy. `tests/privacy-contract.test.mjs` requires that sentence while both gates are on.
- **A build without the models fails while the gate is on** (`scripts/prepare-reading.mjs`). Before, a detector that could not be fetched left `public/reading/` out and the app silently offered no reading of its own; with the feature promised, a release must not lose it unnoticed. With the gate off the build still only reports it.
- **The PRD** no longer defers scanned pages on Windows.

## Merged with main

The branch was merged with `main` on 31 October 2026, after release 2.5.0 had landed there with the folder masking ([0171](0171-mask-a-whole-folder.md)), the sidebar by task ([0172](0172-sidebar-by-task.md)), the memory budget in place of size limits ([0173](0173-no-limits-only-estimates.md)) and the app's text in keyboard characters. What the merge settled:

- **The sidebar no longer lists formats**, so it no longer says "PNG, JPG" or shows "Hình ảnh - Sắp có"; whether this machine reads pictures shows on the Tài liệu page (its subtitle, hint and accepted files) and in home's drop zone (accepted files).
- **Pictures have no byte limit**: the memory budget refuses a file before it opens, as for every document. A picture of more than 25 million pixels is still refused, as a memory refusal worded for pictures (`imageTooLarge` in `useDocRun.ts`), since the budget has no say in how large a decoded picture is.
- **The refusals no longer promise Windows "sắp có"**: where no reading is at hand (a browser preview, a build without the models) they say only that this machine cannot read the text in a scan or a picture.
- **A folder does not read pictures.** The folder masking opens its documents without the reading, so a scanned PDF in a folder is reported as a scan it cannot read and a PNG or JPG as unsupported; pictures are read one at a time on Tài liệu. Reading them in a folder is later work.
- **Measured after the merge** on seed 1's 102 grey scans and 102 copier scans through the merged code (`evaluate-documents.mjs --reading --misread`): 2 / 0 / 2 / 11 and 6 / 0 / 2 / 13, the same documents, values and counts as the last full run after 0190; 493 tests, lint, types, the build and the native checks pass.

## Not decided here

- **A Store build on a real copier scan.** The Windows reading was run end to end through `tauri dev` and the dev server (0181), not in an installed Store build; the first release carrying it should be installed and tried once on a copier scan before it is published.
- **Macs before macOS 14** get this reading, measured on Windows only (0181).
- **`media_ocr`**, the Windows.Media.Ocr engine of 0180, stays in the native module behind `WINDOWS_SHIPPED` (off); no Windows machine has a Vietnamese engine for it.
- Passports, driving licences and other countries' cards (0185); terms misread with other letters, not only other marks (0188).

## Numbering

These twelve decisions were written as 0171 to 0182 on the branch `claude/zealous-elgamal-f01fa4` between 28 and 31 October 2026, while `main` took 0171 to 0179 for the folder masking, the sidebar by task, the mascot, the packs' host and the restore-code limits. They were renumbered by nine (0180 to 0191) on 31 October 2026 before the branch was merged; the commit messages of those days cite the old numbers.

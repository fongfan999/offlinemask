# 0152 — Masking is measured on a set of real documents

Date: 25 October 2026. Status: implemented, with the owner's ten invoices as the first set. Owner, after a fourth round of fixes driven by one invoice at a time: "we can't fix one by one like this, we need a better methodology".

## Problem

Decisions 0149 and 0151 fixed what each new invoice showed: about six reading faults, eight families of model false positives and three rule gaps, one of them a leak. Each fix was checked on the file at hand and on the synthetic fixtures, so nothing showed whether it helped or hurt the other files, and every new document could reopen an old problem. The synthetic gates (`pnpm test`, `pnpm test:models`) stay, but invented text cannot stand for the documents people bring.

## Decision

1. **A private set.** The owner keeps real documents in one folder on their machine (first: `~/OfflineMask-eval/invoices`, nine WinMart VAT invoices and one MISA household-business invoice). Next to each document, `<document>.expect.json` lists what must be hidden (`hide`) and what must stay readable (`keep`). Nothing from the set enters the repository; evaluations record counts.
2. **One command measures it exactly as the app masks.** `pnpm -C desktop eval:documents <folder>` (`desktop/scripts/evaluate-documents.mjs`) opens every .pdf, .docx and .odt with `openDocument`, scans it with `scanTexts` (the same batches, letter split and categories as the Tài liệu page) through the detection engine with the installed pack, masks it with `maskParagraphs`, and compares. The pack is loaded by `desktop/scripts/pack-runtime.mjs`, now shared with `check-pack.mjs`.
3. **Each failure says where to look.** Every expectation lands in one bucket: **not read** (a hidden value is missing from the reader's text: the reader, or a scan), **leaked** (read but not fully masked: detection), **over-masked** (a kept text partly masked: detection), **unlisted** (masked but in neither list: to review). The run exits with an error on anything not read or leaked.
4. **Every run is compared with the last.** The report is written to `<folder>/report.json`, and the next run prints each value that entered or left a bucket. A change to the reader, a rule or a model is judged by this diff across the whole set, not by the file that prompted it.
5. **Drafting without inheriting mistakes.** `--draft` starts a list for a new document from what the app masks today, with an empty `keep` and `"draft": true`, for the owner to correct. The first set's `keep` lists were filled from each invoice's product names and the headings the models used to mask; all ten are still drafts until the owner reviews them.

## What comes next

- **Grow the set** beyond invoices: bank statements, contracts exported from Word, CVs, forms, spreadsheets saved as PDF. A dozen documents per kind is a useful start.
- **Use structure before word lists.** Tables already say what a column holds ("Tên hàng hóa", "Đơn giá", "Thành tiền"); classifying columns by their heading, as the spreadsheet page does, can replace the goods-cell and brand rules of 0151 with one rule. The set measures whether it does.
- **Judge models on the set.** The pack format allows replacing a model (packs/README.md); candidate models, or one fine-tuned on business documents, can now be compared by leaks and over-masks on real documents instead of by impression.

## Verified

The first run, with the drafts: 10 documents in 13 s, nothing not read, leaked or over-masked. With the goods-cell rule of 0151 switched off, the same run reported 31 over-masked product names and 5 unlisted masks across all ten invoices, each by value; with the rule restored it returned to zero and listed each value that left its bucket. `pnpm test:models` passes unchanged through the shared runtime (19/20, the same known miss).

# 0153 — A synthetic document set with its answers written for it

Date: 26 October 2026. Status: implemented. Owner: "adding documents and checking them is time consuming, please research any public documents for us?", then, after the research found none usable, "Build the synthetic document generator: invoices, bank statements, contracts and forms in several layouts, as PDF and Word, with their hide/keep lists written automatically."

## Why synthetic

No public Vietnamese set of business documents with the private values marked exists. MC-OCR has photographed receipts with almost no personal data and no confirmed licence; Vietnamese NER corpora (VLSP, PhoNER) are news sentences; Meddies PII v2 is machine-generated and non-commercial; court judgments carry real people's partly hidden data, which must not enter a test set. A generator gives realistic layouts with invented people, so every expectation is exact by construction, nothing needs review, and the set can be public with the code. The owner's private set (0152) stays as the check that the generator resembles reality.

## What it is

- `desktop/tests/documents/data.mjs`: a seeded random source and invented data: Vietnamese names (with title, sex, birth date), 12-digit CCCDs shaped by province and year, phones in three spellings, e-mails, tax codes, account numbers, addresses old and new style, companies in Title Case or capitals, household businesses, banks, goods with units (brands in capitals, Title Case dishes), amounts and amounts in words.
- `kinds.mjs`: nine layouts in four kinds, each a layout-neutral model that records every value it places as `hide`, `keep` or `ignore` (may go either way: a bank's name, a CCCD's issue date and place, reference numbers):
  - **Invoices**: supermarket VAT (nine columns, blank rows, total), household business (CCCD as tax code, "MST/CCCD chủ hộ"), services (a person as buyer).
  - **Bank statements**: two column layouts over two pages, with transaction text as banks print it (unaccented capitals, "CT DEN", "chuyen tien den TK", salary, QR payments, top-ups).
  - **Contracts**: rental and labour, with the national header, parties with CCCD details, clauses naming people, accounts and addresses in prose, and signatures.
  - **Forms**: a CV form (two-column fields, family and work tables) and an application letter in prose.
- `render-pdf.mjs` lays the model out on A4 with pdf-lib: wrapped paragraphs, "Label: value" fields with the wrap under the value, tables whose cells wrap and sit centred in their row, header rows repeated after a page break, signatures, "Trang i/n". `render-docx.mjs` writes the same model as a minimal Word file (paragraphs, tabs between fields, bordered tables with a merged total row, borderless signature table).
- `pnpm -C desktop documents:generate [folder]` writes each layout as PDF and Word plus a second PDF with other values, 27 documents in about 3 s, into `desktop/artifacts/documents` (not committed: the same seed writes the same bytes), with `<file>.expect.json` beside each. `pnpm -C desktop eval:documents desktop/artifacts/documents` measures them; `ignore` lists keep the report to what matters.
- `tests/synthetic-documents.test.mjs` (in `pnpm test`, no models) checks that a seed always writes the same bytes and that the reader reads every value placed, in PDF and Word: the generator is also a reader regression test.

## Fonts

Each PDF embeds one complete Vietnamese font, as real documents do: **Be Vietnam Pro** (OFL-1.1, designed for Vietnamese) and **Noto Serif** (OFL-1.1), from `@expo-google-fonts/be-vietnam-pro` 0.4.1 and `@expo-google-fonts/noto-serif` 0.4.2 (packages MIT, fonts OFL-1.1; development only, nothing ships in the app). Noto Serif is embedded whole, because pdf-lib's subsetter drops glyphs from it. The split Noto Sans subsets of the earlier fixtures made pdf.js break words where the font switched; these do not.

## First measurement

See [the evaluation](../evaluations/2026-10-26-synthetic-documents.md): the reader read every value in all 27 documents; detection leaked 29 values and over-masked 85, in a few families that point at structure rather than words. Invoice PDFs, which the fixes of 0151 targeted, are clean.

# 0178 — Restore codes of replaced files are kept 30 days, within 256 MB

Date: 31 October 2026. Decision 0177 limited replaced texts' restore codes and left spreadsheets and documents until the app quits. The owner chose the file plan from a measured proposal.

## Measured

On the app's own masking code (`maskTables`, `maskParagraphs`, the shipping pack), in V8:

- **Spreadsheets carry all the size.** Every hidden cell with a distinct value is one finding, about 280 bytes of heap. A 6-hidden-column customer list of 10,000 rows is 11.7 MB by `tableBytes` (14 MB of heap); 100,000 rows is 103 MB (127 MB).
- **Documents are small.** The real evaluation documents hold 9–12 findings, about 2 KB each; a synthetic 300-page document about 1.5 MB, 1,300 pages about 6 MB.
- **`tableBytes` undercounts the heap by 1.2–1.7×** (object overhead), so a budget in it costs about a quarter more in real memory. It stays the measure: it is cheap and consistent.

## What

- **Files have their own limits**, beside the texts' and not mixed with them: a replaced spreadsheet or document table goes **30 days** after its session was made (history's default keep period, decision 0143; an AI's file can come back days later), and past **256 MB** of file tables the oldest go first.
- **The newest replaced file is never dropped for size**, even alone over the budget: its result is the one most likely still to come.
- Listed sessions are untouched, as in 0177. The rules are `staleTables` and `keptTableLimits` in `src/core/quick-actions.ts`, run where 0177's are.
- **Effect.** Codes from a forgotten file read as unknown, as after quitting. The privacy page's storage table says so.

## Not chosen

- Keeping the newest N files: N invoices are kilobytes, N large sheets over a gigabyte, so it bounds nothing without a size cap too.
- Keeping files until quit and warning in "Gần đây" when they grow: no loss, but memory stays unbounded and it adds a message. Can be added later if a user loses a large sheet.

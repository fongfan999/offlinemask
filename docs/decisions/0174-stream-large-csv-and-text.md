# 0174. Large CSV and text files are streamed

Date: 29 October 2026. Status: decided by the owner.

## Context

The app keeps to a memory budget ([0173](0173-no-limits-only-estimates.md)). Measured in Chromium 152, the engine of Windows' WebView2, the page and all its workers share one JavaScript heap of about 4 GB, so the budget cannot go above 3 GB on any machine. Opened whole, a CSV needs about 12 times its size, which puts the ceiling near 250 MB per file. The folder flow ([0171](0171-mask-a-whole-folder.md)) also kept every masked cell of every file until saving, so a large folder of small files could reach the same ceiling. The owner: banks need to mask whole folders, and 3 GB is not enough. Options weighed were streaming, moving file reading to Rust, and opening extra windows for extra heaps. The owner chose streaming for this release, with Rust later if people still hit limits.

## Decision

- **CSV, .txt and .md files are read a piece at a time** (`core/stream.ts`, `core/sheet/csv-stream.ts`): about 4 MB of the file is in memory at once.
  - **Encoding:** chosen on the first piece the way `decodeText` chooses for a whole file.
  - **CSV:** rows come from an incremental reader. Quoted fields with delimiters, line breaks and doubled quotes are handled, and the rows match Papa Parse on the same text.
  - **Text:** whole lines are kept together, so no value is cut between pieces.
- **In a folder these formats are always streamed**, at every step:
  - **Survey:** finds a CSV's header (within the first 30 rows, as before), its first rows to choose columns by, and the characters per column for the estimate.
  - **Masking:** feeds each piece's scanned cells or lines to the detector and keeps only the folder's table of values and codes, plus how often each code occurs in the file.
  - **Saving:** reads the file again and writes the masked copy piece by piece through the fs plugin's `open`, `write` and `close`.
  - **How a streamed copy is masked:** every found value, except those the person chose to keep, becomes its code wherever it stands as a whole word in a scanned cell or line, as the text page already does ([0004](0004-text-processing.md)). A hidden column's cell becomes the code of its whole value.
  - **Other formats:** Word, PDF, OpenDocument and Excel files in a folder are opened whole as before, within the budget.
- **A single CSV or text file too large to open whole on its page** (dropped on home, the spreadsheet or document page, the text box, or sent from the Finder service) opens on the folder page as a one-file job. It is masked the same way, and the long-job note calls it "Tệp này". Files that fit still open on their own page, which keeps its preview, history and restore.
- **No memory setting.** The budget is a quarter of the machine, between 1 and 3 GB, and refusals for the formats still opened whole say to split the file ([0173](0173-no-limits-only-estimates.md)).
- **Permissions.** `fs:allow-open`, `fs:allow-write` and `core:resources:allow-close` are added, used only inside the folder the person picks for saving (the dialog's scope). The privacy page says CSV and text files are read and written piece by piece; `tests/privacy-contract.test.mjs` checks both.

## Measured

On 29 Oct 2026, in the Chromium preview without the recognition pack, a generated 377 MB CSV of 4.5 million rows was tested. Its columns were a date, a hidden phone column and a scanned notes column with emails.

| Step | Time | Peak JavaScript heap |
|---|---|---|
| Survey | 12 s | – |
| Masking | 18 s | 77 MB |
| Writing the copy | 24 s | 137 MB |

The copy was correct, and the same value got the same code throughout. Opened whole, the same file would have needed about 4.5 GB and been refused.

## Consequences

- The model's pace, not memory, is now what limits a large scanned column: about 2 000 characters a second ([0171](0171-mask-a-whole-folder.md)). Hidden columns and rule-only fields (email, phone, account) are fast.
- A large file is saved into a new folder ("<tên> (OfflineMasked)") like a folder's files, not through a save dialog.
- Excel files are still opened whole. A sheet has at most 1 048 576 rows; if banks hit the ceiling with workbooks, the same approach applies to the sheet XML, or reading moves to Rust.
- Values found in one cell are masked in every scanned cell of a streamed file where they appear as whole words, which may hide a little more than the model marked. This trade-off is already accepted for the text page.

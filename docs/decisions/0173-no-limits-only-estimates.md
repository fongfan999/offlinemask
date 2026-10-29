# 0173. No limits, only estimates

Date: 29 October 2026. Status: decided by the owner.

## Context

Each kind of job had its own ceiling, picked when it was built: a text up to 50 000 characters ([0004](0004-text-processing.md)), a spreadsheet up to 20 MB and 100 000 rows ([0076](0076-spreadsheet-files.md)), a Word or OpenDocument file up to 20 MB ([0078](0078-word-documents.md), [0084](0084-opendocument-text.md)), a PDF up to 20 MB and 300 pages ([0149](0149-text-pdf-documents.md)), and a folder up to 5 000 files with each file up to 20 MB ([0171](0171-mask-a-whole-folder.md)). Over a ceiling the file was refused with "Hãy chia nhỏ…". Only the folder said up front how long it would take, and only the folder warned about a long job. The owner asked how to test the long cases across every screen and chose one simple rule instead: "remove all the limits, and show the estimation, and show the warning if it exceeds the threshold".

## Decision

- **No size, row, page, length or file-count limit.** Text of any length is accepted when pasted or opened from a file. Spreadsheets, Word, OpenDocument and PDF files of any size open. A PDF of any page count opens. A folder takes every supported file in it, whatever its size or count.
- **One estimate everywhere.** `composables/jobTime.ts` gives the seconds for a job: the characters the model will read, at 2 000 a second plus 5 seconds to load the model ([0171](0171-mask-a-whole-folder.md)'s measured pace), or 20 times quicker without the recognition pack. After a run of more than 20 000 characters on any page, the pace that run kept replaces the assumed one for the rest of the launch, in RAM only. What is counted:
  - **Text:** its length.
  - **Document:** the text of every paragraph.
  - **Spreadsheet:** the cells of columns set to "Quét nội dung", plus the lines above the header. The count follows the column choices.
  - **Folder:** the same counts for each of its files.
- **Shown beside the start button.** `JobTime` puts "🕒 Khoảng N phút trên máy này" in the footer of step 1. On a spreadsheet, document or folder it always shows. On a text it shows from one minute up, since short texts take a moment.
- **One warning over an hour.** `LongJobNote` appears above the content when the estimate passes an hour: "<Văn bản / Tài liệu / Bảng tính / Thư mục> này khá lớn. Cần khoảng N giờ trên máy này. Bạn vẫn có thể bắt đầu…", with the suggestion of a machine kept for OfflineMask (no contact, no price). The job can always start.
- **ODS trailing rows.** ODS files often end with one empty row repeated a million times. The 100 000-row ceiling used to stop that from becoming a million-row grid. `odsGrid` now keeps empty rows only between rows with text, so the rows a sheet actually has come through at any count.

## Consequences

- Memory is the remaining bound. A very large workbook, document or PDF is read whole into the webview or a worker, and on a small machine it can fail to open or slow the machine. The limits had also stood in for that. If it happens on real files, the answer is streaming or a measured memory guard, not the old ceilings.
- The drop zones no longer say "tối đa 20 MB", and the "too-large", "too-many-rows" and "too-many-pages" errors and their messages are gone.
- The 1-hour threshold and the 2 000 characters a second are measurements from one Apple-silicon Mac; slower machines correct themselves after their first large run.
- Testing: generated files make each case. Use a text of about 7.2 million characters, a CSV with a sentence column of about 80 000 rows, or a folder of such files, for the warning. A 12 000-row sentence column shows a few minutes. Use the native engine (`pnpm -C desktop desktop:dev:native`) with the pack installed; without the pack the estimate is 20 times shorter.

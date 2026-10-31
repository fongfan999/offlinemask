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
- **One warning over ten minutes.** `LongJobNote` appears at the top of step 1 on every page, under the stepper and above the text box, table or file list, when the estimate passes ten minutes (`longJobSeconds`; first an hour, which the owner found far too long): "<Văn bản / Tài liệu / Bảng tính / Thư mục> này khá lớn. Cần khoảng N phút trên máy này. Bạn vẫn có thể bắt đầu…", with the suggestion of a machine kept for OfflineMask (no contact, no price). The job can always start. It is one folded line, "🕒 <…> này khá lớn, cần [khoảng N phút] trên máy này ›", the time set apart in a pill so it is what the eye finds; the rest opens on a click (the owner found the full note too much above every large file). Opened, it holds one line, "Gợi ý: …", the machine kept for OfflineMask; a line saying the job can still start was tried and dropped as one thing too many, since the start button already says so.
- **ODS trailing rows.** ODS files often end with one empty row repeated a million times. The 100 000-row ceiling used to stop that from becoming a million-row grid. `odsGrid` now keeps empty rows only between rows with text, so the rows a sheet actually has come through at any count.
- **The app limits its own memory.** The old ceilings had also kept a large file from taking the machine's memory. In their place OfflineMask keeps to a budget of its own: a quarter of the machine's memory, between 1 and 3 GB (`core/memory.ts`, from the machine's figure that also sizes the folder's workers). Before a file is read, its need is estimated, and a file that needs more is refused with the figures: two lines, what happened and what to do: "Tệp này cần khoảng 4,7 GB bộ nhớ, quá mức OfflineMask tự giới hạn trên máy này (3 GB)." / "Hãy chia nhỏ tệp rồi thử lại." The "Không mở được tệp này" card shows them as two lines; a list of files runs them together.
  - **Measured.** Generated files were opened the way the app opens them (Node, 29 Oct 2026). Peak memory per byte was:
    - a CSV, about 9–11 times its size;
    - text, about 3 times;
    - a workbook, 12–14 times its unzipped XML;
    - a Word document, about 11 times its unzipped XML.
    The factors are rounded up to 12, 4, 15 and 13. An .xls, not measured, counts as 15.
  - **Zipped formats** (xlsx, ods, docx, odt) count by their unzipped size, read from the zip's central directory without inflating anything. Their compressed size says little: a 2 MB workbook needed 340 MB.
  - **PDF** cannot be judged by size, since a scan and a text PDF of the same size need very different amounts. Its own bytes count three times up front. While its pages are read, every character extracted counts 50 bytes (measured: about 95 MB per 1.9 million characters), and reading stops with "PDF này cần nhiều bộ nhớ hơn mức OfflineMask tự giới hạn…" past the budget.
  - **A folder** opens files side by side, one per worker. Each file is checked against its share of the budget, and one that does not fit is not opened. Before masking, those files are named at the top of step 1, in one folded warning line like the long-job note, "ⓘ 1 tệp không mở được, sẽ không được ẩn ›", which opens to each path and its reason; they were first listed at the foot of the page, under the open spreadsheet groups, where the owner did not see them.
  - **No setting.** A folded Cài đặt › Nâng cao first offered other shares ("Ít", "Mặc định", "Nhiều", "Tối đa"). Once the web view's ceiling below was measured, most machines got the same 3 GB from every choice, so the owner removed it. The budget is automatic, and refusals end with "Hãy chia nhỏ tệp rồi thử lại." Large CSV and text files are streamed instead of refused ([0174](0174-stream-large-csv-and-text.md)).

- **The web view's ceiling.** Windows, where most people using the app are, runs it in WebView2, which is Chromium. Measured in Chromium 152 (29 Oct 2026): the JavaScript heap is about 4 GB, and the page and all its workers share it. One worker reached 3 GB alone, and two at 1,8 GB each ran, but two at 2,5 GB each took the whole page down, on a 16 GB machine. A budget over that cannot be kept, so every choice stops at 3 GB, leaving the rest for the app itself (`engineCeiling` in `core/memory.ts`). A folder's workers share those 3 GB. The macOS web view (WebKit) was not measured and gets the same ceiling.
- **Tested.** A generated PDF stops with code "memory" once its text passes the allowance (`tests/pdf.test.mjs`). A folder with a refused file masks the rest and lists the refused file in its review. On Windows in Vietnamese, the system reports a taken folder name as "đã tồn tại", so a taken name is recognised by its error code (17 on macOS and Linux, 80 or 183 on Windows), not by the English word.

## Consequences

- The budget is an estimate from generated files on one machine. A file of an unusual shape can still need more than predicted. If that happens on real files, re-measure the factor rather than shrink the budget.
- The drop zones no longer say "tối đa 20 MB", and the "too-large", "too-many-rows" and "too-many-pages" errors and their messages are gone.
- The 2 000 characters a second is a measurement from one Apple-silicon Mac; slower machines correct themselves after their first large run.
- Testing: generated files make each case. For the warning, use a text of about 1.2 million characters, or a CSV whose sentence column has about 13 000 rows, or a folder of such files. For a memory refusal, use a CSV larger than the budget divided by 12 (about 170 MB on an 8 GB machine). Use the native engine (`pnpm -C desktop desktop:dev:native`) with the pack installed; without the pack the estimate is 20 times shorter.

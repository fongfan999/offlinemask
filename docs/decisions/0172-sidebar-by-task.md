# 0172 — The sidebar by task: hide, then get the full version back

Date: 29 October 2026. Status: on the branch `redesign-task-first`, so it can be dropped in one step. The owner asked for the sidebar "and everything" to be easy for people who are not technical, without being bound to the accepted layout.

## Why

The sidebar listed formats: Văn bản, Bảng tính, Tài liệu, Thư mục, with file extensions under each ("XLSX, XLS, ODS, CSV") and a faded "Hình ảnh · Sắp có". People think in what they want done ("hide the names in this contract"), not in which kind of file they hold; whether a PDF is a Tài liệu is a question the app can answer. The home box already took every format and opened the right page, so the format entries were a second, harder way to start. The step people find hardest to grasp, putting the real names back into the AI's answer, was step 3 inside whichever page the text had been masked on, reachable only through that page.

## What changes

- **Two tasks.** The sidebar starts with "Ẩn thông tin riêng" (Tệp, thư mục, chữ), which is home, and "Nhận lại bản đầy đủ" (Từ câu trả lời của AI), a new page. Both are the website's own step names, so the app uses the words its visitors already read. The format entries and the coming-soon image entry go. The text, spreadsheet, document and folder pages are unchanged inside; files still open on the right one.
- **What is open.** Below the tasks, with a passcode, "Lịch sử" as before. Without one the list is "Đang mở": the results of this launch, which live in RAM and replace each other per format as before (decision 0072), plus a folder being masked with its status ("Đang ẩn · 40%"). Before, without a passcode the format entries were the way back to a result; with them gone the list is. It says nothing about saving, and nothing new is stored (decision 0071's rule stands; only the list's visibility changes).
- **Home is the one start, in the website's voice.** The heading is the website's tagline, "AI không nên biết bạn đang nói về ai.", with the same cobalt italic serif and hand-drawn swash, over its subtitle ("Ẩn thông tin riêng trước khi hỏi AI, nhận lại bản đầy đủ khi AI trả lời."). Under it, two of the website's chips, a struck-out value beside its code (Phong Phan → [TEN_1_4e8c]), replace the three-panel illustration: one look explains what a "mã" is. The start box follows: drop a file or a folder, or click to choose a file; under it "Chọn cả thư mục", "Gõ hoặc dán chữ" (an empty text page, for people who do not know ⌘V) and "Xem thử với ví dụ". Below, the website's three steps (01 Ẩn thông tin riêng · 02 Hỏi AI như mọi khi · 03 Nhận lại bản đầy đủ) as it lists them, a mono number and a rule rather than boxes, the third linking to the new page. Sidebar items have a 14 px radius instead of a pill, since a task name may wrap.
- **"Nhận lại bản đầy đủ".** A pasted reply is restored with every alias this launch knows: each private session's table, kept in RAM by quick actions even after it was replaced (the same tables Ẩn nhanh restores with), and a masked folder's. Aliases carry their run's scope, so nobody has to say which text, file or folder the reply is about, and an alias of nothing known is kept and named, never guessed (PRD FR-09). A returned file (Word, OpenDocument, Excel, CSV, .md, .txt) is restored the same way with the existing returned-file code, which now takes any alias table (`openReply`), and saved with the usual "OfflineUnmasked" name. Before anything is masked the page says so and leads to "Ẩn thông tin riêng". Step 3 inside each page stays for people already there.
- **Words.** "Báo lỗi" becomes "Báo lỗi hoặc góp ý"; sidebar subtitles are words, not extensions. Settings keep their headings: they are already plain, and the pack's name is pack data (`desktop/packs/<id>.json`), not code.

## Found on the way

The folder run's `review` and new `findings` computeds tested the non-reactive alias book before the reactive totals; read while no folder was masked, they never subscribed to the totals and stayed empty. They now read the totals first.

## Not done

- A sample session's aliases are not in the restore page's tables, as they are not in Ẩn nhanh's: "Xem thử với ví dụ" restores on its own page's step 3.
- The restore page shows a returned file's counts but no preview of it.
- "mã thay thế" stays the app's word for an alias throughout; renaming it is a copy pass of its own.

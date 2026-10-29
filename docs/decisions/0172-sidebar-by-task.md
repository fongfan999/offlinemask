# 0172 — One home for the whole job: hide, then get the full version back

Date: 29 October 2026. Status: on the branch `redesign-task-first`, so it can be dropped in one step. The owner asked for the sidebar "and everything" to be easy for people who are not technical, without being bound to the accepted layout.

## Why

The sidebar listed formats: Văn bản, Bảng tính, Tài liệu, Thư mục, with file extensions under each ("XLSX, XLS, ODS, CSV") and a faded "Hình ảnh · Sắp có". People think in what they want done ("hide the names in this contract"), not in which kind of file they hold; whether a PDF is a Tài liệu is a question the app can answer. The home box already took every format and opened the right page, so the format entries were a second, harder way to start. The step people find hardest to grasp, putting the real names back into the AI's answer, was step 3 inside whichever page the text had been masked on, reachable only through that ## What changes

- **One sidebar entry.** The format entries and the coming-soon image entry go; the sidebar has "Trang chủ", then the list below. A first version gave the two tasks an entry each ("Ẩn thông tin riêng", "Nhận lại bản đầy đủ"); the owner preferred one entry, with both on home. The text, spreadsheet, document and folder pages are unchanged inside; files still open on the right one.
- **What is open.** Below "Trang chủ", with a passcode, "Lịch sử" as before. Without one the list is "Đang mở": the results of this launch, which live in RAM and replace each other per format as before (decision 0072), plus a folder being masked with its status ("Đang ẩn · 40%"). Before, without a passcode the format entries were the way back to a result; with them gone the list is. It says nothing about saving, and nothing new is stored (decision 0071's rule stands; only the list's visibility changes).
- **Home in the website's voice.** The heading is the website's tagline, "AI không nên biết bạn đang nói về ai.", with the same cobalt italic serif and hand-drawn swash, over its subtitle. Two of the website's chips, a struck-out value beside its code (Phong Phan → [TEN_1_4e8c]), replace the three-panel illustration: one look explains what a "mã" is.
- **Two tabs, the website's step names.** Under the hero a large switch: "Ẩn thông tin riêng" and "Nhận lại bản đầy đủ". The first is a large drop target (280 px, a file or a folder, or click to choose a file) with "Chọn cả thư mục", "Gõ hoặc dán chữ" (an empty text page, for people who do not know ⌘V) and "Xem thử với ví dụ" beneath. A list of the three steps sat under it for a day; the owner found it dull, and the two tabs say the same.
- **Nhận lại bản đầy đủ.** A pasted reply is restored with every alias this launch knows: each private session's table, kept in RAM by quick actions even after it was replaced (the same tables Ẩn nhanh restores with), and a masked folder's. Aliases carry their run's scope, so nobody has to say which text, file or folder the reply is about, and an alias of nothing known is kept and named, never guessed (PRD FR-09). A returned file (Word, OpenDocument, Excel, CSV, .md, .txt) is restored the same way with the existing returned-file code, which now takes any alias table (`openReply`). Before anything is masked the tab says so and leads back to the first tab. Pasting anywhere on home (outside a field) a text with known aliases opens this tab with it, so the user need not choose; other text still opens the text page. Step 3 inside each page stays for people already there.
- **Words.** "Báo lỗi" becomes "Báo lỗi hoặc góp ý". Settings keep their headings: they are already plain, and the pack's name is pack data (`desktop/packs/<id>.json`), not code.

code.

## Found on the way

The folder run's `review` and new `findings` computeds tested the non-reactive alias book before the reactive totals; read while no folder was masked, they never subscribed to the totals and stayed empty. They now read the totals first.

## Not done

- A sample session's aliases are not in the restore tab's tables, as they are not in Ẩn nhanh's: "Xem thử với ví dụ" restores on its own page's step 3.
- The restore tab shows a returned file's counts but no preview of it.
- "mã thay thế" stays the app's word for an alias throughout; renaming it is a copy pass of its own.

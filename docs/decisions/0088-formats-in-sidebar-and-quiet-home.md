# 0088 — File types in the sidebar, plain-text drops, no "ready" strip

Date: 14 October 2026. Status: owner feedback on [0087](0087-upcoming-formats-in-sidebar.md): "on the sidebar, add supported file format for each option", "“Dán vào” no one will understand", and asking whether "Gói nhận diện đã sẵn sàng." looks weird on the home page.

## Decisions

- **Sidebar.** Each format names the files it opens on a small monospace line beneath its label: Văn bản "TXT, MD", Bảng tính "XLSX, XLS, ODS, CSV", Tài liệu "DOCX, ODT", Hình ảnh (coming) "JPG, PNG". PDF needs no second line. The three entries are now built from one list in `AppSidebar.vue`.
- **Văn bản card.** "Email, tin nhắn" / "Dán vào, TXT" becomes "Dán email, tin nhắn" / "TXT, MD": pasting is said in plain words, and the type line lists only file types.
- **The text box takes a file.** Listing TXT is honest only if the text page opens one. A `.txt` or `.md` dropped on the text box becomes the draft, with the same checks as the Tài liệu handoff ([0083](0083-plain-text-files-open-in-text.md)). Those checks now live once in `useMaskingRun().openTextFile`: 50 000 characters, not empty, not while a text is being masked. Another file type dropped there gets "Ô này nhận tệp .txt hoặc .md. Mở tệp Excel ở Bảng tính, tệp Word ở Tài liệu." Text dragged from another app is still inserted by the browser as before. The placeholder reads "Nhập, dán văn bản hoặc kéo thả tệp .txt vào đây…". `decodeText` moved to `src/core/decode-text.ts`, so the text page does not import the spreadsheet module.
- **No ready strip on the home page.** Once the pack is installed, the home page has nothing to ask, and "Gói nhận diện đã sẵn sàng." was noise in the middle of the page. The strip now shows only while there is something to do: download, progress, paused or error. Cài đặt still shows the pack's status. Its styles (`.pack-ready`) are removed.

## Verified

`pnpm lint`, `pnpm typecheck` and `pnpm test` (258) pass, with a test for `openTextFile`: it accepts a file, and refuses long, empty and busy cases while keeping the draft. In the in-app browser at 1024 × 768 in light mode, the sidebar shows the type lines, aligned and legible, and the cards fit on one row. A `.txt` dropped on the text box became the draft, and a dropped `.xlsx` showed the redirect message. The ready state was not seen in the browser (no pack installed there); it renders nothing by construction.

# 0083 — A dropped .txt or .md file opens on the text page

Date: 14 October 2026. Status: chosen by the owner ("go with option 2") after asking whether Tài liệu should support .txt.

## Decision

Plain text is not a second document format. The Văn bản page already masks it, with its own per-finding review. A `.txt` or `.md` file dropped on (or chosen in) Tài liệu therefore opens on Văn bản, its content pasted into the draft and ready to mask. It is not masked automatically: the user still sees the text and presses "Ẩn thông tin". Before, the drop zone answered with "Chỉ hỗ trợ tệp .docx…", a dead end.

- The text is decoded like CSV files ([0076](0076-spreadsheet-files.md)): UTF-8 with or without BOM, then Windows-1258. `decodeText` also now reads UTF-16 with a BOM (Notepad's "Unicode", Excel's "Unicode text"), which CSV files benefit from too.
- Texts longer than the text page's 50 000 characters, and files over four bytes per allowed character, are refused on Tài liệu with "Tệp văn bản dài hơn 50.000 ký tự. Hãy chia nhỏ rồi dán từng phần vào trang Văn bản."; an empty file gets the existing empty message. While a text is being masked the file is refused rather than replacing that draft.
- The drop zone's hint still names only `.docx`; the handoff is a convenience, not a third format.

The file-error line under drop zones is now 13 px, the size of the hint text, instead of body size (owner: "the error is a little too big").

## Verified

`pnpm lint`, `pnpm typecheck` and `pnpm test` pass (243, with a decoding test). In the browser preview, a dropped `.txt` opened on Văn bản with its text pasted, and a 60 000-character `.md` stayed on Tài liệu with the length message.

# 0160 — One restore step for text, spreadsheets and documents

Date: 26 October 2026. Status: implemented; checked in the Vite preview. Owner's review: step 3 differed between file types "from UI/UX to copies".

## Problem

- The text page opened step 3 with "Dán câu trả lời của AI vào đây. Mã thay thế của văn bản này…", and the box under it said "Dán câu trả lời của AI vào đây…" again.
- A spreadsheet's or document's "Câu trả lời dạng chữ" tab reused that line, so it spoke of "văn bản này" on a spreadsheet, as did its "not found" and "kept as is" notes.
- The "Tệp AI trả về" tab had no line at all; the drop zone's hint carried part of it ("mã thay thế được đổi lại thành thông tin thật") without "ngay trên máy bạn".
- The note under the card said three different things: "Đã sao chép. … dán vào ô này", "Đã lưu tệp đã ẩn. Gửi tệp này cho AI; khi có tệp trả về, mở ở bước Khôi phục" (read at step 3 itself) and, for a PDF, "Dán vào AI; … dán ở bước Khôi phục".

## Decision

- Every step 3 opens with the same line, `RestoreIntro`: the restore mark and "Mã thay thế của {văn bản | bảng tính | tài liệu} này được đổi lại thành thông tin thật, ngay trên máy bạn." It sits above the pasted-reply box and above the returned-file drop zone alike. What to do is said once, by the box: the placeholder or the drop zone's title.
- The drop zone's hint lists the accepted formats, as step 1's does.
- `RestorePanel` takes the page's `subject`, so its notes name a spreadsheet or document correctly.
- The note after step 2 has one shape: what was done, where to send it ("công cụ AI bạn dùng (ChatGPT, Claude, Gemini…)"), and "rồi đưa … vào bước Khôi phục", which reads right on step 2 and step 3.
- "Sao chép bản khôi phục" becomes "Sao chép bản đã khôi phục", matching the "Bản đã khôi phục" label and "Tải tệp đã khôi phục".

Not changed: step 2's own label ("Sao chép sang AI" for text, "Tải về và gửi AI" for files), since the action differs. No privacy fact changes.

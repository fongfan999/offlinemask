# 0162 — Step 2 says the same things on every page

Date: 26 October 2026. Status: implemented; checked in the Vite preview at 1280×900. Owner's request after 0161: review step 2 for consistency.

## Problem

- **History offer.** The text page asked "Muốn xem lại văn bản này sau?" (0071) with "Để sau" and "Đặt mật mã". Spreadsheets and documents said "Giữ ứng dụng mở để khôi phục tệp này sau." with no "Để sau", and showed the offer again even after the user had dismissed it on the text page. The same markup was copied into three pages.
- **History status.** Only the text page's footer said "Đã lưu vào lịch sử." (or, in the browser preview, "Bản xem trước: không lưu lịch sử."). File pages said nothing, at step 2 or step 3.
- **Subtitle.** "Đọc lại bản đã ẩn, rồi sao chép để gửi AI." against "Đọc lại rồi tải tệp đã ẩn về để gửi AI."

## Decision

- One `KeepOffer` component on all three pages: "Muốn xem lại {văn bản | bảng tính | tài liệu} này sau?", "Đặt mật mã để lưu vào lịch sử trên máy này; nếu không, đóng ứng dụng sẽ mất bảng mã thay thế.", with "Để sau" and "Đặt mật mã". The second sentence keeps the file pages' warning, which holds for text too. "Để sau" hides it on every page for the rest of the run.
- The history status line is `vault.savedNote` and shows in the footer of step 2 and step 3 on every page.
- File subtitles read "Đọc lại bản đã ẩn, rồi tải về để gửi AI."

Not changed, because the content differs rather than the wording:
- The text page reviews in place (masked/original switch, "Sửa văn bản", select to hide, the "Đã ẩn … · Xem thay đổi" list); files show a preview and the "Kiểm tra trước khi tải" list.
- Counts use the natural unit: "ô" for cells, "chỗ" for document passages, "mục" for text.
- The main action: "Sao chép và tiếp tục" for text, "Tải tệp đã ẩn" for files (PDF also has "Sao chép").

No privacy fact changes: nothing new is stored, and the offer still only stores after a passcode is set.

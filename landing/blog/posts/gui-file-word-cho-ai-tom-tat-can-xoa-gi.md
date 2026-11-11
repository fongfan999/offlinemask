---
title: Gửi file Word cho AI tóm tắt: cần xóa gì trước khi tải lên?
description: Làm trên bản sao, chấp nhận hoặc bỏ các thay đổi đang theo dõi, xóa ghi chú, dọn thuộc tính file, rồi thay họ tên, CCCD, số điện thoại bằng mã trước khi tải lên.
date: 2026-11-11
---

Trước khi tải một file Word lên ChatGPT, Claude hay Gemini để tóm tắt, hãy làm trên **một bản sao** và dọn hai lớp thông tin. Lớp thứ nhất là những thứ bạn không nhìn thấy khi đọc: thay đổi đang theo dõi (track changes), ghi chú bên lề, chữ bị ẩn, đầu trang và chân trang, tên tác giả trong thuộc tính file. Lớp thứ hai là thông tin riêng trong chính nội dung: họ tên, số CCCD, số điện thoại, số tài khoản, địa chỉ. Phần nào AI không cần để tóm tắt thì xóa, phần nào cần để hiểu "ai làm gì" thì thay bằng mã như `[TEN_1]`. Dưới đây là cách làm từng bước.

## Vì sao tải cả file Word lại lộ nhiều hơn dán một đoạn chữ?

Khi dán một đoạn văn vào khung chat, bạn thấy hết những gì mình gửi. Khi tải lên cả file .docx, AI nhận **toàn bộ file**, và một file Word thường mang theo nhiều thứ hơn phần bạn đang đọc trên màn hình:

- **Thay đổi đang theo dõi**: đoạn đã xóa vẫn còn trong file cho đến khi bạn chấp nhận hoặc bỏ thay đổi. Một câu như "giảm lương anh Hùng xuống 12 triệu" đã gạch đi vẫn có thể đi theo file.
- **Ghi chú (comment)**: lời trao đổi nội bộ bên lề, kèm tên người viết.
- **Đầu trang, chân trang**: hay có tên công ty, tên người soạn, số điện thoại liên hệ.
- **Chữ bị ẩn**: chữ được định dạng là ẩn sẽ không hiện khi đọc, nhưng vẫn nằm trong file.
- **Thuộc tính file**: tên tác giả, người sửa cuối, tên công ty, tên mẫu.
- **Tên file**: ví dụ "Bien_ban_ky_luat_Tran_Van_Hung.docx" đã nói đủ chuyện.

Vì vậy việc đầu tiên là dọn những phần ẩn, rồi mới đến thông tin trong nội dung.

## Bước 1: Lưu một bản sao và đặt tên trung tính

Mở file, chọn **File > Save As** (Lưu thành) và đặt tên không chứa tên người, ví dụ "Bien_ban_hop_thang_11.docx". Từ đây chỉ sửa trên bản sao này. Bản gốc giữ nguyên để bạn đối chiếu sau.

## Bước 2: Xử lý thay đổi đang theo dõi và ghi chú

Vào thẻ **Review** (Xem lại):

1. Bấm **Accept > Accept All Changes and Stop Tracking** (Chấp nhận tất cả thay đổi và ngừng theo dõi) nếu bản hiện tại là bản bạn muốn tóm tắt. Nếu muốn quay về nội dung trước khi sửa thì dùng **Reject** (Từ chối) thay vì Accept.
2. Bấm **Delete > Delete All Comments in Document** (Xóa tất cả ghi chú trong tài liệu). Nếu ghi chú có ý cần giữ, hãy chép ý đó vào nội dung trước, không kèm tên người viết.

Sau bước này, file chỉ còn đúng những chữ bạn nhìn thấy.

## Bước 3: Dùng Document Inspector để dọn phần ẩn

Word trên Windows có sẵn **Document Inspector** (Kiểm tra tài liệu): vào **File > Info > Check for Issues > Inspect Document**, đánh dấu các mục cần kiểm tra rồi bấm **Inspect**. Theo [trang hỗ trợ của Microsoft](https://support.microsoft.com/en-us/office/remove-hidden-data-and-personal-information-by-inspecting-documents-presentations-or-workbooks-356b7b5d-77af-44fe-a07f-9aa4d085966f), với Word công cụ này tìm:

- Ghi chú, các bản sửa (revisions), phiên bản và chú thích viết tay.
- Thuộc tính file và thông tin cá nhân, như tên người dùng và tên mẫu.
- Đầu trang, chân trang và hình mờ (watermark).
- Chữ được định dạng ẩn và đối tượng được đặt là không hiển thị.
- Dữ liệu XML tùy chỉnh lưu trong file.

Ở mục nào muốn xóa, bấm **Remove All**. Microsoft lưu ý hai điều: nên chạy công cụ trên bản sao vì dữ liệu đã xóa không phải lúc nào cũng lấy lại được, kể cả bằng Undo; và công cụ không phát hiện được chữ bị giấu bằng cách khác, ví dụ chữ màu trắng trên nền trắng hay chữ cỡ rất nhỏ, cũng như đối tượng bị che sau đối tượng khác.

Cẩn thận với mục đầu trang, chân trang: nếu chúng chứa số hiệu văn bản hay tiêu đề AI cần biết, hãy sửa tay thay vì xóa hết.

Các bước trên là của Word trên Windows. Trên Word cho Mac và các ứng dụng khác như LibreOffice, tên menu khác nhau; nếu không tìm thấy công cụ tương tự, hãy tự mở phần thuộc tính file (File > Properties) và xóa tên tác giả, tên công ty.

## Bước 4: Thay thông tin riêng trong nội dung bằng mã

Giờ đến phần chính. Hãy tự hỏi: để tóm tắt, AI cần biết gì? Thường là **ai làm việc gì, khi nào, bao nhiêu**, chứ không cần số CCCD hay số điện thoại. Giả sử bạn có biên bản họp (thông tin hư cấu):

> Ngày 05/11, anh Trần Văn Hùng (CCCD 001090012345, điện thoại 0912 345 678) trình bày việc chậm giao hàng cho Công ty Minh Phát. Chị Nguyễn Minh Anh đề nghị hoàn 15.000.000 đồng vào tài khoản 0071 0004 56789 trước ngày 20/11.

Bạn có thể đổi thành:

> Ngày 05/11, anh `[TEN_1]` trình bày việc chậm giao hàng cho `[CONGTY_1]`. Chị `[TEN_2]` đề nghị hoàn 15.000.000 đồng vào tài khoản `[STK_1]` trước ngày 20/11.

Cách làm:

1. **Xóa hẳn** những gì không phục vụ việc tóm tắt: ở đây là số CCCD và số điện thoại.
2. **Thay bằng mã** những gì cần để hiểu câu chuyện: tên người, tên công ty, số tài khoản. Dùng **Home > Replace** (Thay thế, phím tắt Ctrl+H) để thay một lần cho cả file, ví dụ thay "Trần Văn Hùng" bằng `[TEN_1]`.
3. **Giữ một mã cho một người.** Nếu anh Hùng lúc là `[TEN_1]` lúc là `[TEN_3]`, bản tóm tắt sẽ tưởng là hai người. Nhớ thay cả cách gọi tắt như "anh Hùng" hay "Hùng".
4. **Giữ nguyên** ngày tháng, số tiền, nội dung công việc: đó là thứ AI cần để tóm tắt đúng.
5. Ghi bảng đối chiếu (`[TEN_1]` = Trần Văn Hùng...) vào một file riêng trên máy bạn, không tải lên AI.

Khi nhận bản tóm tắt, bạn tra bảng đối chiếu để đổi mã về tên thật.

## Bước 5: Soát lại lần cuối

Trước khi tải lên, dò nhanh những chỗ hay sót:

- Bảng biểu, hộp văn bản (text box), chú thích cuối trang (footnote).
- Chữ ký, khối "Người lập", "Người duyệt" ở cuối văn bản.
- Hình ảnh: ảnh chụp CCCD, ảnh chụp màn hình có tên hay số điện thoại. Không có công cụ thay chữ nào sửa được chữ nằm trong ảnh; xóa ảnh nếu AI không cần.
- Đường liên kết: một liên kết email vẫn chứa địa chỉ email dù chữ hiển thị là "liên hệ".

Mẹo: bật nút **Show/Hide** trên thẻ **Home** (hình chữ P ngược, Hiện/Ẩn ký hiệu định dạng) để thấy chữ ẩn và khoảng trống lạ.

## Có cách nào nhanh hơn làm tay không?

Với một biên bản hai trang, làm tay như trên mất chừng mười phút. Với hợp đồng hay báo cáo dài hàng chục trang, nhiều tên người lặp lại, việc dò tay dễ sót.

[OfflineMask](../) là ứng dụng miễn phí làm việc này ngay trên máy bạn, không cần mạng. Bạn mở file DOCX hoặc ODT; ứng dụng tự tìm email, số điện thoại, số tài khoản, CCCD, mã số thuế..., và cả họ tên, địa chỉ, tên tổ chức khi cài gói tiếng Việt. Bạn xem lại rồi xuất một bản đã ẩn, định dạng của tài liệu được giữ nguyên, cùng một người luôn mang cùng một mã kiểu `[TEN_1_4e8c]`. Khi AI trả lời, bạn dán câu trả lời vào lại OfflineMask, các mã tự đổi về thông tin thật. Bảng đối chiếu không rời khỏi máy bạn.

OfflineMask tìm được phần lớn thông tin riêng chứ không phải tất cả, nên hãy luôn xem lại bản đã ẩn trước khi gửi. Các bước dọn ghi chú, thay đổi đang theo dõi và thuộc tính file ở trên vẫn nên làm, vì chúng là thói quen tốt với bất kỳ file nào bạn gửi ra ngoài.

Nếu tài liệu của bạn là hợp đồng, bài [Nhờ AI soạn hợp đồng mà không lộ tên, CCCD của các bên](./nho-ai-soan-hop-dong-khong-lo-ten-cccd) có ví dụ chi tiết hơn. Với file Excel, xem [Cách ẩn thông tin cá nhân trong file Excel trước khi gửi AI phân tích](./an-thong-tin-ca-nhan-trong-file-excel-gui-ai).

## Tóm lại

- Luôn làm trên bản sao, đặt tên file không chứa tên người.
- Chấp nhận hoặc bỏ hết thay đổi đang theo dõi, xóa ghi chú, rồi chạy Document Inspector để dọn thuộc tính file, đầu trang, chân trang và chữ ẩn.
- Xóa hẳn những gì AI không cần; thay tên người, tên công ty, số tài khoản bằng mã nhất quán; giữ nguyên ngày tháng và số liệu.
- Giữ bảng đối chiếu mã trên máy bạn, không tải lên AI.
- Soát lại bảng, hộp văn bản, hình ảnh, liên kết và khối chữ ký trước khi gửi.

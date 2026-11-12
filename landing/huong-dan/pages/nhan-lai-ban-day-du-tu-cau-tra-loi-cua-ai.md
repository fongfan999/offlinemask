---
title: Đổi mã trong câu trả lời của AI về lại thông tin thật
description: Dán câu trả lời hoặc đưa file AI trả về vào OfflineMask: mọi mã thay thế tự đổi về họ tên, số tài khoản thật, ngay trên máy bạn.
date: 2026-11-12
order: 6
---

Bạn đã ẩn thông tin, gửi cho AI, và AI trả lời bằng những mã như `[TEN_1_5102]` hay `[STK_1_5102]`. Để có lại bản đầy đủ, mở [OfflineMask](../), chọn thẻ **Nhận lại bản đầy đủ** trên trang chủ và dán câu trả lời vào. Mọi mã còn nguyên được đổi về thông tin thật, ngay trên máy bạn; bấm **Sao chép bản đã khôi phục** là xong. Với file AI trả về, kéo file vào và bấm **Lưu tệp đã khôi phục**.

## Khôi phục một câu trả lời dạng chữ

1. Sao chép câu trả lời của AI.
2. Trong OfflineMask, mở thẻ **Nhận lại bản đầy đủ**, chọn **Câu trả lời dạng chữ** và dán vào ô **Dán câu trả lời của AI vào đây...**. Thật ra bạn có thể dán ở bất cứ đâu trên trang chủ: nếu đoạn dán có mã ứng dụng biết, nó tự chuyển sang thẻ này.
3. Ứng dụng báo "Đã khôi phục N mã thay thế" và hiện bản đã khôi phục.
4. Bấm **Sao chép bản đã khôi phục**. Còn câu trả lời khác? Bấm **Dán câu trả lời khác**.

Ví dụ, "Chào chị [TEN_1_5102], tiền từ tài khoản [STK_1_5102] đang được hoàn lại" trở thành "Chào chị Nguyễn Minh Anh, tiền từ tài khoản 001234567890 đang được hoàn lại".

## Khôi phục một file AI trả về

Chọn **Tệp AI trả về** và kéo file vào. Ứng dụng nhận Word (.docx, .odt), bảng tính (.xlsx, .xls, .ods, .csv) và file chữ (.md, .txt). Bấm **Lưu tệp đã khôi phục**: file mới mang đuôi `(OfflineUnmasked)`, file AI trả về vẫn giữ nguyên.

Nếu bạn vẫn đang ở trang của file đã ẩn, bước **Khôi phục** ngay trên trang đó làm cùng việc này.

## Làm sao ứng dụng biết mã nào là ai?

Mỗi lần ẩn tạo một bảng mã thay thế, nằm trên máy bạn và không bao giờ được gửi đi. Phần cuối của mã (như `5102`) cho biết nó thuộc lần ẩn nào, nên bạn không cần chọn đúng văn bản: OfflineMask dùng mọi bảng mã nó đang giữ.

Điều đó cũng có nghĩa là **bảng mã phải còn**:

- **Chưa đặt mật mã**: bảng mã nằm trong bộ nhớ, ở mục **Gần đây**, đến khi bạn thoát hẳn ứng dụng. Đóng cửa sổ thì chưa sao, OfflineMask vẫn chạy trên thanh menu (Mac) hoặc khay hệ thống (Windows). Thoát hẳn rồi thì không khôi phục được nữa.
- **Đã đặt mật mã**: những gì bạn ẩn được lưu vào **Lịch sử**, mã hóa trên máy, và khôi phục được cả ngày hôm sau, đến khi tự xóa sau 1, 7, 30 hoặc 90 ngày tùy bạn chọn. Đặt mật mã trong **Cài đặt**; mật mã gồm 6 chữ số, và quên thì phải xóa hết để bắt đầu lại, vì không ai lấy lại được.
- **Thư mục** không được lưu vào lịch sử: hãy khôi phục trước khi mở thư mục khác hoặc thoát ứng dụng.

## Nếu AI sửa hoặc làm mất mã thì sao?

Chỉ mã còn nguyên mới được đổi. OfflineMask không đoán thay bạn:

- Mã vẫn đúng dạng nhưng không thuộc lần ẩn nào trên máy (AI đổi số, hoặc bịa ra mã mới) được giữ nguyên và ứng dụng báo số lượng để bạn xem lại.
- Mã bị AI viết lại khác hẳn (bỏ ngoặc vuông, viết thường) thì nằm nguyên trong văn bản như chữ thường.

Để ít gặp chuyện này, khi hỏi hãy thêm một câu như "Giữ nguyên các mã trong ngoặc vuông". Sau khi khôi phục, đọc lướt một lượt tìm dấu ngoặc vuông còn sót.

## Khôi phục ngay trong ô chat

Trên macOS và Windows, [Ẩn nhanh](./an-nhanh-khi-boi-den-trong-chatgpt) cho bạn bôi đen câu trả lời ngay trong ChatGPT, Claude hay Gemini và bấm nút OfflineMask để khôi phục tại chỗ, không cần sao chép qua lại. Với chữ không sửa được (như câu trả lời của AI), ứng dụng hiện bản xem trước để bạn sao chép.

## Tóm lại

- Thẻ **Nhận lại bản đầy đủ**: dán câu trả lời, hoặc kéo file AI trả về vào.
- Mọi mã còn nguyên tự đổi về thông tin thật; mã bị sửa được giữ nguyên để bạn xem lại.
- Bảng mã chỉ nằm trên máy bạn; thoát ứng dụng khi chưa đặt mật mã là mất.
- Đặt mật mã nếu muốn khôi phục cả sau khi tắt máy.

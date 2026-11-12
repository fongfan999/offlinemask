---
title: Cách ẩn thông tin cá nhân trong file PDF trước khi gửi AI
description: OfflineMask đọc chữ trong PDF ngay trên máy, thay thông tin riêng bằng mã và cho ra bản chữ (Markdown) để bạn sao chép hoặc tải lên AI.
date: 2026-11-12
order: 3
---

Sao kê, hóa đơn, hồ sơ, báo cáo xuất ra PDF thường đầy họ tên, số tài khoản, số điện thoại. Để nhờ AI đọc mà không lộ những thông tin đó, mở file PDF bằng [OfflineMask](../) và bấm **Ẩn toàn bộ tài liệu**. Ứng dụng đọc chữ trong PDF ngay trên máy, thay thông tin riêng bằng mã như `[STK_1_5102]`, rồi cho bạn một **bản chữ đã ẩn** dạng Markdown để sao chép vào AI hoặc tải lên. Khi AI trả lời, đưa câu trả lời vào bước **Khôi phục** để có lại thông tin thật.

## Vì sao bản đã ẩn là chữ, không phải PDF?

Một file PDF chứa nhiều thứ ngoài phần chữ bạn đọc được: ảnh, chữ ký, lớp chữ ẩn, thông tin về người tạo file. Sửa từng chỗ trong PDF mà chắc chắn không sót là việc rất khó. Vì vậy OfflineMask chỉ lấy phần chữ, ẩn nó, rồi viết ra một file mới hoàn toàn: `<tên file> (OfflineMasked).md`. Không có gì từ file gốc đi theo, kể cả ảnh và thông tin của file.

Với AI, bản chữ là đủ: mỗi trang bắt đầu bằng tiêu đề "Trang N", bảng được giữ thành bảng, nên AI vẫn tóm tắt, đối chiếu hay trả lời câu hỏi về nội dung như với PDF.

## Bước 1: Mở file PDF

Kéo file vào cửa sổ OfflineMask, hoặc bấm **Chọn hoặc kéo tệp, thư mục vào đây** trên trang chủ. File dài sẽ hiện tiến độ kiểu "Đang đọc trang 12 / 300"; bạn có thể bấm **Hủy** bất cứ lúc nào.

Một vài trường hợp ứng dụng sẽ báo trước:

- **PDF có mật khẩu**: mở bằng trình đọc PDF, lưu lại một bản không mật khẩu rồi thử lại.
- **PDF dùng phông chữ cũ** (TCVN3, VNI): chữ trong đó chưa đọc được. Hãy mở file gốc (Word chẳng hạn), chuyển sang Unicode rồi xuất PDF lại. Nếu chỉ vài trang dùng phông cũ, ứng dụng báo số trang và bản đã ẩn sẽ thiếu nội dung những trang đó.
- **PDF là ảnh scan**: OfflineMask đọc chữ trong ảnh ngay trên máy. Xem hướng dẫn riêng về [ảnh chụp và PDF scan](./an-thong-tin-trong-anh-chup-va-pdf-scan).

## Bước 2: Ẩn và kiểm tra

Bấm **Ẩn toàn bộ tài liệu**. Xong, bạn có thể chuyển giữa **Xem trước bản đã ẩn** và **Bản gốc** để so.

Trong danh sách **Kiểm tra trước khi tải**, bỏ chọn những gì không cần ẩn (tên ngân hàng, tên một địa danh...). Giá trị bỏ chọn được giữ nguyên ở mọi chỗ.

Nếu PDF có hình ảnh, ứng dụng báo rằng hình ảnh không có trong bản đã ẩn. Khi trong ảnh có chữ AI cần đọc, bạn gõ lại phần đó vào câu hỏi.

Họ tên, địa chỉ và tên công ty chỉ được tự tìm khi đã cài gói nhận diện tiếng Việt. Với sao kê hay hồ sơ, hãy cài gói này (một lần, không bắt buộc) hoặc đọc kỹ phần tên trước khi gửi.

## Bước 3: Gửi cho AI

Có hai cách:

- Bấm **Sao chép** rồi dán thẳng vào ô chat. Cách này hợp với file vừa phải.
- Bấm **Tải tệp đã ẩn (.md)** rồi tải file đó lên AI. Cách này hợp với file dài.

Hỏi như mọi khi, ví dụ: "Liệt kê các giao dịch trên 10 triệu đồng và tổng tiền theo tài khoản nhận. Giữ nguyên các mã trong ngoặc vuông."

## Bước 4: Khôi phục

Ở bước **Khôi phục**, dán câu trả lời của AI vào **Câu trả lời dạng chữ**, hoặc kéo file AI trả về (.md, .txt, .docx hoặc .odt) vào **Tệp AI trả về**. Các mã đổi lại thành số tài khoản, tên thật. Mã nào AI đã sửa thì được giữ nguyên để bạn tự xem lại.

## Tóm lại

- Mở PDF, bấm **Ẩn toàn bộ tài liệu**; mọi việc chạy trên máy bạn.
- Bản đã ẩn là chữ (Markdown): không ảnh, không thông tin của file gốc.
- PDF có mật khẩu hoặc phông chữ cũ cần xử lý trước; PDF scan được đọc chữ trên máy.
- **Sao chép** hoặc **Tải tệp đã ẩn (.md)**, gửi AI, rồi dán câu trả lời vào bước **Khôi phục**.

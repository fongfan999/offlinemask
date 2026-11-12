---
title: Ẩn thông tin riêng trong cả thư mục nhiều file cùng lúc
description: Ẩn một lần cả thư mục Word, PDF, Excel, CSV ngay trên máy: cùng một người mang cùng một mã ở mọi file, còn thư mục gốc được giữ nguyên.
date: 2026-11-12
order: 5
---

Khi cần đưa cho AI cả một bộ hồ sơ (hợp đồng, bảng lương, sao kê, ghi chú), mở từng file một rất mất công. Với [OfflineMask](../), bạn kéo **cả thư mục** vào, xem lại, bấm **Ẩn N tệp** rồi **Lưu thư mục đã ẩn**. Ứng dụng tạo một thư mục mới chứa bản đã ẩn của từng file, ở nơi bạn chọn; thư mục gốc không bị thay đổi. Điểm hay nhất: **cùng một người mang cùng một mã ở mọi file**, nên AI vẫn nối được "[TEN_1_5102]" trong hợp đồng với "[TEN_1_5102]" trong bảng lương.

## Những file nào trong thư mục được ẩn?

- Tài liệu: **DOCX**, **ODT**, **PDF có chữ** (thành bản chữ .md), **TXT**, **MD**.
- Bảng tính: **XLSX**, **XLS** (lưu lại thành .xlsx), **ODS**, **CSV**.

File khác được bỏ qua và liệt kê kèm lý do, ví dụ file .doc cũ (mở bằng Word, lưu lại thành .docx) hay ảnh PNG, JPG. Ảnh và PDF scan chưa được đọc chữ khi ẩn cả thư mục; hãy mở chúng riêng theo hướng dẫn [ảnh chụp và PDF scan](./an-thong-tin-trong-anh-chup-va-pdf-scan). File ẩn của hệ thống và file tạm của Office không được tính.

## Bước 1: Đưa thư mục vào

Kéo thư mục vào cửa sổ OfflineMask, hoặc bấm **Chọn cả thư mục** trên trang chủ. Bạn cũng có thể kéo nhiều file cùng lúc. Ứng dụng liệt kê các file sẽ được ẩn, các file bỏ qua (**N tệp bỏ qua**, bấm để xem lý do) và các file không mở được.

Ở cuối trang có thời gian ước tính trên máy của bạn, ví dụ "Khoảng 3 phút trên máy này". OfflineMask không giới hạn số file hay dung lượng; với việc rất lớn, ứng dụng chỉ báo trước để bạn biết.

## Bước 2: Xem lại trước khi ẩn

Mở từng bảng tính để xem cột nào sẽ được ẩn. Mỗi cột có một lựa chọn: **Giữ nguyên**, **Quét nội dung**, hoặc ẩn cả cột theo loại (họ và tên, số điện thoại, số tài khoản...). Ứng dụng gợi ý sẵn dựa trên tên cột và dữ liệu; các bảng tính có cùng các cột được gom lại để bạn chọn một lần cho cả nhóm.

Xong, bấm **Ẩn N tệp**.

## Bước 3: Kiểm tra và lưu

Danh sách **Những gì đã ẩn** cho biết từng giá trị đã ẩn và nó xuất hiện ở bao nhiêu file. Bỏ chọn những gì không cần ẩn, rồi bấm **Lưu thư mục đã ẩn** và chọn nơi lưu.

Ứng dụng tạo thư mục `<tên thư mục> (OfflineMasked)`, giữ nguyên cấu trúc thư mục con bên trong. Mỗi file mang đuôi `(OfflineMasked)` như khi ẩn từng file. Gửi những file AI cần, không nhất thiết là tất cả.

## File CSV hay file văn bản rất lớn thì sao?

File CSV, TXT, MD rất lớn được đọc dần từng phần thay vì mở cả một lần, nên vẫn ẩn được trên máy văn phòng thông thường. Một file như vậy được mở như một thư mục chỉ có một file, và bản đã ẩn được lưu vào thư mục mới `<tên file> (OfflineMasked)`. File Excel, Word và PDF thì vẫn được mở nguyên cả file.

Nếu một file cần nhiều bộ nhớ hơn mức OfflineMask tự giới hạn trên máy bạn, ứng dụng sẽ nói rõ và gợi ý chia nhỏ file. Nếu bạn thường xuyên phải ẩn rất nhiều tài liệu, hãy cân nhắc dành riêng một máy để chạy OfflineMask.

## Bước 4: Khôi phục câu trả lời

Sau khi lưu, bấm **Sang bước 3: Khôi phục**. Dán câu trả lời của AI, hoặc đưa vào từng file AI trả về, các mã đổi lại thành thông tin thật.

Lưu ý quan trọng: **bảng mã của thư mục không được lưu vào lịch sử.** Nó chỉ nằm trong bộ nhớ đến khi bạn mở một thư mục khác hoặc thoát ứng dụng. Hãy khôi phục câu trả lời của AI trước khi làm vậy.

## Tóm lại

- Kéo cả thư mục vào; Word, PDF có chữ, Excel, CSV, TXT được ẩn, ảnh và file .doc thì bỏ qua.
- Chọn cách xử lý cột cho bảng tính, bấm **Ẩn N tệp**, xem lại, **Lưu thư mục đã ẩn**.
- Cùng một người mang cùng một mã ở mọi file; thư mục gốc giữ nguyên.
- Khôi phục trước khi mở thư mục khác hoặc thoát ứng dụng, vì bảng mã của thư mục không được lưu lại.

---
title: Ẩn họ tên, CCCD trong file Word mà vẫn giữ nguyên định dạng
description: Mở file DOCX hoặc ODT bằng OfflineMask, ẩn toàn bộ tài liệu ngay trên máy, bỏ chọn những gì không cần ẩn rồi tải bản đã ẩn để gửi AI.
date: 2026-11-12
order: 2
---

Muốn nhờ AI rà soát hợp đồng, tóm tắt biên bản hay sửa một lá thư trong file Word mà không lộ tên, số CCCD, số điện thoại của ai? Mở file bằng [OfflineMask](../), bấm **Ẩn toàn bộ tài liệu**, xem lại danh sách, rồi bấm **Tải tệp đã ẩn**. Bạn nhận được một file Word mới, định dạng giữ nguyên, trong đó thông tin riêng đã thành mã như `[TEN_1_5102]`. Gửi file đó cho AI. Khi AI trả file hoặc câu trả lời về, đưa vào bước **Khôi phục** để các mã đổi lại thành thông tin thật.

## Những file nào dùng được?

- **DOCX** (Word) và **ODT** (LibreOffice, OpenOffice).
- File **.doc** đời cũ chưa mở được: hãy mở bằng Word và lưu lại thành .docx trước.

OfflineMask ẩn chữ ở thân văn bản, kể cả trong bảng và hộp văn bản, cùng đầu trang, chân trang, chú thích cuối trang và bình luận. Phần chữ đã xóa nhưng còn lưu trong chế độ theo dõi thay đổi cũng được ẩn. Tên người tạo và người sửa cuối trong thuộc tính file được xóa trống.

## Bước 1: Mở file

Kéo file vào cửa sổ OfflineMask, hoặc bấm **Chọn hoặc kéo tệp, thư mục vào đây** trên trang chủ rồi chọn file. Ứng dụng mở trang tài liệu.

Nếu chưa cài gói nhận diện tiếng Việt, bạn sẽ thấy ứng dụng chỉ đang tìm email, số điện thoại, số tài khoản. Với hợp đồng hay hồ sơ nhân sự, nơi họ tên và địa chỉ là chính, hãy tải gói này trước (một lần, không bắt buộc).

## Bước 2: Ẩn toàn bộ tài liệu

Bấm **Ẩn toàn bộ tài liệu**. Mọi việc diễn ra trên máy bạn; file vài trang thường xong rất nhanh, file dài thì ứng dụng cho biết thời gian ước tính. Xong, bạn thấy dòng **Đã ẩn N chỗ - M mã thay thế** và có thể chuyển giữa **Xem trước bản đã ẩn** và **Bản gốc** để so.

Ví dụ, đoạn "Bên thuê: ông Trần Quốc Bảo, CCCD 079085001122, điện thoại 0987654321" trở thành "Bên thuê: ông [TEN_1_5102], CCCD [CCCD_1_5102], điện thoại [SDT_1_5102]". Thời hạn, tiền cọc, điều khoản phạt được giữ nguyên để AI có đủ nội dung mà làm việc.

## Bước 3: Kiểm tra trước khi tải

Danh sách **Kiểm tra trước khi tải** liệt kê từng giá trị đã ẩn theo loại. Bỏ chọn những gì không cần ẩn, như tên một nhân vật lịch sử hay một địa danh; giá trị bỏ chọn được giữ nguyên ở mọi chỗ trong file.

Hai điều cần biết:

- Với file, bạn chỉ bỏ chọn được, chưa thêm được. Nếu thấy một tên còn sót, hãy sửa trong file gốc, hoặc sao chép đoạn đó sang [trang văn bản](./an-thong-tin-trong-van-ban-truoc-khi-hoi-ai), nơi bạn bôi đen để ẩn thêm.
- **Hình ảnh và đối tượng nhúng không được kiểm tra** và vẫn nằm trong file đã ẩn; ứng dụng sẽ báo khi file có chúng. Ảnh chụp CCCD dán trong hợp đồng chẳng hạn: hãy xóa ảnh trong file gốc trước khi ẩn.

## Bước 4: Tải tệp đã ẩn và gửi AI

Bấm **Tải tệp đã ẩn** và chọn nơi lưu. File mới mang tên kiểu `Hợp đồng thuê nhà (OfflineMasked).docx`, file gốc không bị đổi. Tải file này lên ChatGPT, Claude hay Gemini và hỏi, ví dụ: "Chỉ ra các điều khoản bất lợi cho bên thuê, giữ nguyên các mã trong ngoặc vuông."

## Bước 5: Khôi phục

Ở bước **Khôi phục** của cùng trang:

- Nếu AI trả về một file Word, chọn **Tệp AI trả về**, kéo file vào rồi bấm **Tải tệp đã khôi phục**. Bạn có file `(OfflineUnmasked).docx` với tên thật trở lại đúng chỗ.
- Nếu AI trả lời bằng chữ, chọn **Câu trả lời dạng chữ** và dán vào.

Mã nào AI đã sửa thì được giữ nguyên để bạn xem lại. Xem thêm ở hướng dẫn [nhận lại bản đầy đủ](./nhan-lai-ban-day-du-tu-cau-tra-loi-cua-ai).

## Còn gì nên dọn bằng tay?

OfflineMask lo phần chữ. Trước khi gửi, hãy tự nhìn lại tên file, ảnh trong file và những thứ AI không cần đọc. Bài [Gửi file Word cho AI tóm tắt: cần xóa gì trước khi tải lên?](../blog/gui-file-word-cho-ai-tom-tat-can-xoa-gi) có danh sách kiểm tra đầy đủ.

## Tóm lại

- Mở file DOCX hoặc ODT, bấm **Ẩn toàn bộ tài liệu**.
- Đọc lại, bỏ chọn những gì không cần ẩn; chỗ còn sót thì sửa ở file gốc.
- Xóa ảnh có thông tin riêng trước, vì ảnh trong file Word không được kiểm tra.
- **Tải tệp đã ẩn**, gửi cho AI, rồi đưa kết quả vào bước **Khôi phục**.

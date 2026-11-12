---
title: Cách ẩn thông tin riêng trong văn bản trước khi hỏi AI
description: Dán văn bản vào OfflineMask, xem lại những gì được tìm thấy, ẩn thêm chỗ còn sót, sao chép sang AI rồi đổi mã trong câu trả lời về thông tin thật.
date: 2026-11-12
order: 1
---

Cách nhanh nhất: dán đoạn văn bản vào [OfflineMask](../), bấm **Ẩn thông tin**, đọc lại bản đã ẩn rồi bấm **Sao chép và tiếp tục** để dán sang ChatGPT, Claude hay Gemini. Họ tên, số điện thoại, số tài khoản... đã thành mã như `[TEN_1_5102]`, nên AI vẫn hiểu việc cần làm mà không biết bạn đang nói về ai. Khi AI trả lời, dán câu trả lời vào lại, các mã tự đổi về thông tin thật. Tất cả diễn ra trên máy bạn, kể cả khi không có mạng.

Hướng dẫn này đi qua từng bước với một ví dụ thật ngắn.

## Bạn cần chuẩn bị gì?

- OfflineMask, [tải miễn phí](../#om-download) cho macOS, Windows hoặc Linux. Không cần tài khoản.
- Nếu muốn ứng dụng tự tìm cả **họ tên, địa chỉ, tên tổ chức, số thẻ và mật khẩu**, hãy tải thêm gói nhận diện tiếng Việt (tải một lần, không bắt buộc). Không có gói, OfflineMask vẫn tự tìm email, số điện thoại, số tài khoản, CCCD, hộ chiếu và mã số thuế.

Ví dụ trong bài là một tin nhắn khiếu nại, với thông tin hư cấu:

> Chị Nguyễn Minh Anh, số 0901 234 567, báo đã chuyển 2.500.000 đồng từ tài khoản 001234567890 nhưng chưa nhận được hàng.

## Bước 1: Dán văn bản và bấm Ẩn thông tin

Mở OfflineMask. Ở thẻ **Ẩn thông tin riêng** trên trang chủ, bấm vào ô **Hoặc gõ, dán văn bản vào đây...** rồi dán đoạn văn bản (⌘V trên Mac, Ctrl+V trên Windows). Ứng dụng chuyển sang trang văn bản.

Bấm **Ẩn thông tin**. Vài giây sau bạn thấy bản đã ẩn:

> Chị [TEN_1_5102], số [SDT_1_5102], báo đã chuyển 2.500.000 đồng từ tài khoản [STK_1_5102] nhưng chưa nhận được hàng.

Số tiền được giữ nguyên, vì AI cần nó để trả lời, và nó không cho biết đây là ai.

## Bước 2: Đọc lại, bỏ chọn hoặc ẩn thêm

OfflineMask tìm được phần lớn thông tin riêng, không phải tất cả. Vì vậy hãy luôn đọc lại trước khi gửi:

- Bấm **Xem thay đổi** để thấy từng mục đã ẩn. Mục nào không cần ẩn (tên một nhân vật lịch sử, một địa danh...), bỏ chọn nó; mục đó sẽ được giữ nguyên.
- Thấy tên hay số nào còn sót, **bôi đen** nó trong bản đã ẩn rồi bấm **Ẩn phần đã chọn**.
- Nếu chưa cài gói tiếng Việt, ứng dụng sẽ nhắc rằng tên người chưa được kiểm tra, đôi khi kèm vài tên gợi ý để bạn bấm ẩn. Hãy dò kỹ họ tên trong trường hợp này.

Bạn có thể bấm **Bản gốc** để so lại với văn bản ban đầu bất cứ lúc nào.

## Bước 3: Sao chép sang AI

Bấm **Sao chép và tiếp tục**. Bản đã ẩn nằm trong bộ nhớ tạm, và ứng dụng chuyển sang bước **Khôi phục**. Mở công cụ AI bạn hay dùng, dán vào và hỏi như mọi khi, ví dụ: "Soạn giúp thư trả lời ngắn gọn, lịch sự cho khách này."

AI chỉ thấy mã. Nó sẽ viết kiểu "Chào chị [TEN_1_5102], chúng tôi đã kiểm tra giao dịch từ tài khoản [STK_1_5102]...". Bạn có thể nhắc AI giữ nguyên các mã trong ngoặc vuông; đa số công cụ làm vậy sẵn.

## Bước 4: Nhận lại bản đầy đủ

Sao chép câu trả lời của AI, quay lại OfflineMask và dán vào bước **Khôi phục**. Mọi mã còn nguyên được đổi về thông tin thật: "Chào chị Nguyễn Minh Anh...". Sao chép bản đầy đủ và dùng.

Nếu AI sửa hoặc làm mất một mã, mã đó được giữ nguyên để bạn tự xem lại; OfflineMask không đoán thay bạn. Chi tiết ở hướng dẫn [nhận lại bản đầy đủ](./nhan-lai-ban-day-du-tu-cau-tra-loi-cua-ai).

## Bảng mã thay thế được giữ ở đâu?

Bảng cho biết `[TEN_1_5102]` là ai chỉ nằm trên máy bạn, không bao giờ được gửi đi. Mặc định nó được giữ đến khi bạn thoát hẳn ứng dụng (đóng cửa sổ thì OfflineMask vẫn chạy trên thanh menu hoặc khay hệ thống), ở mục **Gần đây** bên trái. Muốn mở lại văn bản cũ vào hôm sau, hãy **Đặt mật mã** trong Cài đặt: lịch sử khi đó được mã hóa trên máy và tự xóa sau số ngày bạn chọn.

## Mẹo cho câu hỏi tốt hơn

- Giữ lại những gì AI thật sự cần: số tiền, ngày, nội dung vấn đề. Chỉ thông tin cho biết đó là ai mới cần ẩn.
- Cùng một người luôn mang cùng một mã trong một văn bản, nên AI vẫn hiểu "[TEN_1_5102]" ở câu đầu và câu cuối là một người.
- Ngại chuyển qua lại giữa hai cửa sổ? Trên macOS và Windows, [Ẩn nhanh](./an-nhanh-khi-boi-den-trong-chatgpt) cho bạn bôi đen ngay trong ô chat để ẩn tại chỗ.

## Tóm lại

- Dán văn bản, bấm **Ẩn thông tin**, đọc lại bản đã ẩn.
- Bỏ chọn những gì không cần ẩn; bôi đen chỗ còn sót rồi bấm **Ẩn phần đã chọn**.
- Bấm **Sao chép và tiếp tục**, dán vào AI, hỏi như mọi khi.
- Dán câu trả lời vào bước **Khôi phục** để có lại thông tin thật.
- Bảng mã không rời máy bạn; đặt mật mã nếu muốn giữ lịch sử.

---
title: Ẩn thông tin trong ảnh chụp và PDF scan trước khi hỏi AI
description: Ảnh chụp màn hình hay trang giấy scan: OfflineMask đọc chữ trong ảnh ngay trên máy, ẩn thông tin riêng và chỉ đưa phần chữ đã ẩn cho AI.
date: 2026-11-12
order: 4
---

Một ảnh chụp màn hình đơn hàng, một trang biên bản scan, một tấm ảnh đoạn chat: gửi thẳng cho AI là gửi luôn mọi tên, số điện thoại, số tài khoản trong đó. Với [OfflineMask](../), bạn mở ảnh (PNG, JPG) hoặc PDF scan, ứng dụng **đọc chữ trong ảnh ngay trên máy**, thay thông tin riêng bằng mã, rồi cho bạn một bản chữ đã ẩn để gửi AI. Bản thân bức ảnh không đi theo, nên không có gì trong ảnh lọt ra ngoài phần chữ bạn đã xem lại.

## Đọc chữ trong ảnh có gửi ảnh đi đâu không?

Không. Việc đọc chữ chạy hoàn toàn trên máy, không cần mạng và không tải thêm gì: trên macOS 14 trở lên, OfflineMask dùng công cụ nhận dạng chữ có sẵn của hệ điều hành; trên máy khác, ứng dụng dùng bộ đọc chữ nằm sẵn bên trong nó. Ảnh không được lưu lại, và bản đã ẩn chỉ chứa phần chữ. Bạn có thể tự kiểm chứng: tắt Wi-Fi rồi thử. Trang [quyền riêng tư](../privacy) nói rõ hơn.

## Bước 1: Mở ảnh hoặc PDF scan

Kéo file vào cửa sổ OfflineMask, hoặc bấm **Chọn hoặc kéo tệp, thư mục vào đây** trên trang chủ. Ứng dụng nhận:

- Ảnh **PNG** và **JPG**. Ảnh HEIC (ảnh iPhone) hay WebP chưa mở được; hãy chuyển sang JPG trước.
- **PDF scan**, kể cả PDF chỉ có vài trang là ảnh scan, xen giữa các trang có chữ.

Ảnh quá lớn (hơn 25 triệu điểm ảnh) sẽ bị từ chối; thu nhỏ ảnh rồi thử lại. PDF dài hiện tiến độ "Đang đọc trang N / M", mỗi trang scan mất khoảng một giây hoặc hơn tùy máy.

## Bước 2: Ẩn, rồi đọc lại thật kỹ

Bấm **Ẩn toàn bộ tài liệu**. Ứng dụng đọc chữ, tìm thông tin riêng và ẩn.

Đọc chữ trong ảnh có thể sai sót: một chữ số bị đọc nhầm, một dòng mờ bị bỏ qua. Ứng dụng nhắc bạn điều này ngay trên trang, và chỉ rõ trang nào là ảnh scan, trang nào không có chữ đọc được (trang trống hoặc ảnh quá mờ). Vì vậy:

- Chuyển sang **Bản gốc** để so từng đoạn với ảnh thật.
- Trong danh sách **Kiểm tra trước khi tải**, bỏ chọn những gì không cần ẩn.
- Nếu một số điện thoại bị đọc sai đến mức không còn được nhận ra, nó sẽ không được ẩn. Gặp chỗ như vậy, đừng gửi đoạn đó, hoặc gõ lại câu hỏi mà không có nó.

Họ tên và địa chỉ trong ảnh chỉ được tự tìm khi đã cài gói nhận diện tiếng Việt. Bộ đọc chữ thì không cần gói này.

## Bước 3: Gửi phần chữ cho AI

Bấm **Sao chép** để dán vào ô chat, hoặc **Tải tệp đã ẩn (.md)** để tải lên AI. Hỏi như mọi khi: "Tóm tắt khiếu nại này và đề xuất cách trả lời, giữ nguyên các mã trong ngoặc vuông."

Đừng tải ảnh gốc lên kèm theo. Mục đích của cả quy trình là chỉ phần chữ đã ẩn rời khỏi máy bạn.

## Bước 4: Khôi phục

Dán câu trả lời của AI vào bước **Khôi phục** (hoặc kéo file AI trả về: .md, .txt, .docx, .odt). Các mã đổi lại thành thông tin thật.

## Những gì chưa làm được

- Ảnh nằm trong một thư mục khi bạn [ẩn cả thư mục](./an-thong-tin-trong-ca-thu-muc) chưa được đọc chữ; hãy mở từng ảnh riêng.
- Ảnh nằm bên trong file Word không được kiểm tra; ảnh bên trong PDF có chữ không có trong bản đã ẩn.
- Với ảnh chụp giấy tờ tùy thân (CCCD, hộ chiếu...), AI hiếm khi cần đến chúng; cách an toàn nhất vẫn là không gửi.

## Tóm lại

- Mở ảnh PNG, JPG hoặc PDF scan; chữ được đọc ngay trên máy, ảnh không được gửi hay lưu lại.
- Đọc chữ có thể sai: luôn so với **Bản gốc** trước khi gửi.
- Chỉ gửi phần chữ đã ẩn, không gửi kèm ảnh gốc.
- Dán câu trả lời vào bước **Khôi phục** để có lại thông tin thật.

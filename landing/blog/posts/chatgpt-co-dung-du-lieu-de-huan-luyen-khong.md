---
title: ChatGPT có dùng dữ liệu của tôi để huấn luyện không? Tắt ở đâu?
description: Với tài khoản ChatGPT cá nhân, cuộc trò chuyện có thể được dùng để huấn luyện mô hình. Tắt trong Cài đặt > Data controls, và đây là những gì việc tắt không làm được.
date: 2026-10-26
---

Có, nếu bạn dùng tài khoản ChatGPT cá nhân và chưa đổi cài đặt: theo trang trợ giúp của OpenAI, nội dung trò chuyện có thể được dùng để cải thiện (huấn luyện) mô hình. Để tắt, vào **Settings > Data controls**, tắt mục **Improve the model for everyone** rồi bấm **Done**. Việc tắt chỉ áp dụng cho các cuộc trò chuyện mới, và không có nghĩa là OpenAI không lưu gì. Bài này chỉ đường từng bước trên máy tính và điện thoại, rồi giải thích những gì cài đặt này không làm thay bạn.

## Ai đang bị dùng dữ liệu để huấn luyện?

Điều này tùy loại tài khoản:

- **Tài khoản cá nhân** (dùng miễn phí hoặc các gói trả phí cho cá nhân): mục "Improve the model for everyone" có thể đang bật. Nhiều người chưa từng mở phần cài đặt này.
- **Gói dành cho tổ chức** (ChatGPT Business, Enterprise, Edu) và **API**: OpenAI cho biết họ không dùng dữ liệu của các gói này để huấn luyện mô hình theo mặc định. Xem trang [Business data privacy của OpenAI](https://openai.com/business-data/).

Nếu công ty bạn đã mua gói Business hoặc Enterprise, hãy dùng tài khoản công ty cho việc công ty. Nếu bạn đang dùng tài khoản cá nhân để làm việc, đọc tiếp.

## Cách tắt trên máy tính (trang web hoặc ứng dụng)

1. Đăng nhập ChatGPT.
2. Bấm vào tên hoặc ảnh đại diện của bạn ở góc màn hình để mở menu tài khoản.
3. Chọn **Settings** (Cài đặt).
4. Chọn mục **Data controls** (Kiểm soát dữ liệu).
5. Tắt công tắc **Improve the model for everyone** (Cải thiện mô hình cho mọi người).
6. Bấm **Done**.

Nếu giao diện của bạn đang để tiếng Việt, tên các mục sẽ được dịch, nhưng vị trí vẫn như trên. OpenAI thỉnh thoảng đổi tên và vị trí menu; nếu không thấy, hãy xem hướng dẫn mới nhất trên [trang trợ giúp về kiểm soát dữ liệu](https://help.openai.com/en/articles/7730893-data-controls-faq).

## Cách tắt trên điện thoại (iOS, Android)

1. Mở ứng dụng ChatGPT, mở thanh bên (biểu tượng menu).
2. Bấm vào tên hoặc ảnh đại diện của bạn.
3. Chọn **Data controls**.
4. Tắt **Improve the model for everyone**.

Khi đã đăng nhập, cài đặt này gắn với **tài khoản**, nên tắt ở một máy là áp dụng cho các máy khác dùng cùng tài khoản. Nếu bạn dùng ChatGPT mà không đăng nhập, lựa chọn chỉ được lưu trong trình duyệt đó, đổi trình duyệt là phải chọn lại.

OpenAI còn có một cách khác là gửi yêu cầu "Do not train on my content" qua [cổng quyền riêng tư](https://privacy.openai.com/). Làm một trong hai cách là đủ.

## Tắt rồi thì có an toàn chưa?

Tắt là nên làm, nhưng hãy hiểu đúng nó làm gì:

- **Chỉ có hiệu lực từ lúc tắt.** Theo OpenAI, cài đặt này áp dụng cho các cuộc trò chuyện mới. Những gì bạn đã gửi trước đó không tự được rút lại.
- **Không xóa lịch sử.** Tắt không xóa hay ẩn các cuộc trò chuyện đã lưu. Chúng vẫn nằm trong tài khoản, ai mở được tài khoản (người mượn máy, đồng nghiệp dùng chung) vẫn đọc được.
- **Dữ liệu vẫn được gửi lên máy chủ.** Không huấn luyện không có nghĩa là không lưu. Nội dung bạn gửi vẫn được xử lý và lưu trên hệ thống của OpenAI theo chính sách của họ.

### Còn chế độ Temporary Chat (trò chuyện tạm thời)?

Temporary Chat không xuất hiện trong lịch sử và, theo [trang trợ giúp của OpenAI](https://help.openai.com/en/articles/8914046-temporary-chat-faq), không được dùng để cải thiện mô hình. Tuy vậy OpenAI vẫn có thể giữ một bản sao tới 30 ngày vì lý do an toàn. Đây là lựa chọn tốt cho một câu hỏi lẻ, nhưng không phải là "không ai thấy gì".

### Xóa cuộc trò chuyện thì sao?

Khi bạn xóa, cuộc trò chuyện biến mất khỏi tài khoản ngay, và theo [hướng dẫn xóa và lưu trữ trò chuyện](https://help.openai.com/en/articles/8809935-deleting-and-archiving-chats-in-chatgpt), được lên lịch xóa hẳn khỏi hệ thống của OpenAI trong vòng 30 ngày, trừ trường hợp họ phải giữ lại vì lý do bảo mật hoặc pháp lý. Lưu trữ (Archive) thì khác: cuộc trò chuyện chỉ bị cất đi, không bị xóa.

## Một ví dụ: tắt huấn luyện vẫn chưa đủ

Chị Trần Thu Hà, kế toán một công ty nhỏ, đã tắt "Improve the model for everyone". Chị dán vào ChatGPT:

> Soạn giúp tôi email nhắc anh Lê Quốc Bảo (0912 345 678) chuyển khoản 15.000.000 đồng vào tài khoản 0071 0001 23456 trước ngày 30.

ChatGPT sẽ không dùng đoạn này để huấn luyện. Nhưng tên, số điện thoại và số tài khoản của anh Bảo vẫn đã rời máy chị, nằm trong lịch sử tài khoản cho tới khi chị xóa, và nằm trên máy chủ của OpenAI ít nhất một thời gian. Anh Bảo chưa bao giờ đồng ý cho thông tin của mình đi tới đó.

Cách chắc chắn hơn là đừng gửi những thông tin đó ngay từ đầu. AI không cần biết anh Bảo là ai để soạn một email nhắc thanh toán:

> Soạn giúp tôi email nhắc anh [TEN_1] ([SDT_1]) chuyển khoản 15.000.000 đồng vào tài khoản [STK_1] trước ngày 30.

AI trả lời bằng chính các mã đó, chị chỉ cần đổi lại thành thông tin thật trước khi gửi. Bài [Có nên dán thông tin khách hàng vào ChatGPT không?](./co-nen-dan-thong-tin-khach-hang-vao-chatgpt) giải thích kỹ cách làm thủ công.

## Làm việc này nhanh hơn

Thay tay từng tên, từng số với một đoạn ngắn thì được, với email dài hay bảng tính thì dễ sót. [OfflineMask](../) là ứng dụng miễn phí làm việc đó ngay trên máy bạn, không cần mạng:

1. Dán văn bản hoặc mở tệp Excel, Word. Ứng dụng tự tìm số điện thoại, số tài khoản, email, CCCD, mã số thuế…, cả họ tên và địa chỉ nếu bạn cài gói tiếng Việt. Bạn xem lại rồi ẩn.
2. Dán bản đã ẩn vào ChatGPT như mọi khi.
3. Dán câu trả lời vào lại OfflineMask, các mã tự đổi về thông tin thật. Bảng đối chiếu không rời khỏi máy bạn.

OfflineMask tìm được phần lớn thông tin riêng chứ không phải tất cả, nên hãy luôn đọc lại bản đã ẩn trước khi gửi. Ứng dụng cũng không thay cho cài đặt của ChatGPT: tắt huấn luyện và ẩn thông tin là hai việc bổ sung cho nhau.

## Tóm lại

- Tài khoản ChatGPT cá nhân có thể đang cho phép dùng trò chuyện để huấn luyện mô hình; gói Business, Enterprise, Edu và API thì không, theo mặc định.
- Tắt ở **Settings > Data controls > Improve the model for everyone**. Cài đặt theo tài khoản và chỉ áp dụng cho trò chuyện mới.
- Tắt huấn luyện không xóa lịch sử và không ngăn dữ liệu được gửi lên máy chủ. Temporary Chat và chat đã xóa vẫn có thể được giữ tới 30 ngày.
- Cách an toàn nhất vẫn là không gửi thông tin nhận ra được một người: thay họ tên, số điện thoại, số tài khoản bằng mã trước khi dán.

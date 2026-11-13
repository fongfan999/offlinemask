---
title: Chế độ trò chuyện tạm thời của ChatGPT có thật sự không lưu lại?
description: Trò chuyện tạm thời không vào lịch sử, không tạo ký ức, không dùng để huấn luyện, nhưng OpenAI vẫn có thể giữ một bản sao tới 30 ngày trên máy chủ.
date: 2026-11-13
checked: 2026-11-13
---

Không hẳn. Trò chuyện tạm thời (Temporary Chat) của ChatGPT **không hiện trong lịch sử, không tạo hay cập nhật ký ức (Memory) và không được dùng để huấn luyện mô hình** khi nó vẫn là tạm thời. Nhưng theo [trang trợ giúp của OpenAI](https://help.openai.com/en/articles/8914046), OpenAI vẫn có thể giữ một bản sao tới 30 ngày vì lý do an toàn. Nghĩa là nó "không lưu" với bạn và với người mượn máy, chứ không phải "không lưu" ở máy chủ. Bài này giải thích từng điểm, so sánh với chế độ tương tự của Claude và Gemini, và chỉ cách dùng cho đúng.

## Trò chuyện tạm thời làm được gì?

Theo OpenAI, khi bạn mở một cuộc trò chuyện tạm thời:

- **Không vào lịch sử.** Cuộc trò chuyện không hiện ở danh sách bên trái. Rời khỏi rồi thì không mở lại được, trừ khi bạn đã bấm lưu.
- **Không tạo ký ức.** ChatGPT không ghi nhớ hay cập nhật điều gì từ cuộc này vào phần Memory.
- **Không dùng để huấn luyện.** Nội dung không được dùng để cải thiện mô hình chừng nào cuộc trò chuyện còn là tạm thời, dù bạn đã bật hay tắt mục "Improve the model for everyone".

## Vậy cái gì vẫn được lưu?

Đây là phần nhiều người hiểu nhầm.

### Bản sao tới 30 ngày trên máy chủ

OpenAI ghi rõ họ có thể giữ một bản sao của trò chuyện tạm thời **tới 30 ngày vì lý do an toàn**. Nội dung bạn gõ vẫn được gửi lên máy chủ để ChatGPT trả lời, và có thể nằm ở đó một thời gian sau khi bạn đóng cửa sổ.

### Khi bạn bấm lưu

Bạn có thể lưu một cuộc trò chuyện tạm thời vào lịch sử nếu muốn quay lại sau. Khi đó nó trở thành **cuộc trò chuyện bình thường**: hiện trong lịch sử, theo thời hạn lưu thông thường, và theo cài đặt huấn luyện của tài khoản. Một cú bấm lưu vội là mất hết lợi ích của chế độ tạm thời.

### Bản "có cá nhân hóa"

Trước tin nhắn đầu tiên, ChatGPT cho bạn chọn trò chuyện tạm thời có cá nhân hóa (personalized) hay không. Bản có cá nhân hóa **đọc được ký ức và hướng dẫn tùy chỉnh (custom instructions)** bạn đã lưu, chỉ là không ghi thêm. Lựa chọn này không đổi được sau khi đã bắt đầu. Nếu bạn muốn một cuộc trò chuyện "sạch", không dựa vào gì của tài khoản, hãy chọn bản không cá nhân hóa.

### Tài khoản công ty

Với khách hàng Enterprise đủ điều kiện, OpenAI cho biết trò chuyện tạm thời vẫn có trong Compliance API (công cụ lưu trữ, kiểm tra của công ty) trong 30 ngày. Nói cách khác, "tạm thời" không có nghĩa là công ty không xem được.

## Cách mở trò chuyện tạm thời

Trên trang web ChatGPT, theo hướng dẫn của OpenAI:

1. Mở một cuộc trò chuyện mới.
2. Bấm nút **Temporary** (Tạm thời) ở góc trên bên phải.
3. Chọn có cá nhân hóa hay không, rồi gõ câu hỏi.

Trên ứng dụng cho máy Mac, cách bật có thể khác (OpenAI có [hướng dẫn riêng cho ứng dụng macOS](https://help.openai.com/en/articles/9295248)).

## Claude và Gemini có chế độ tương tự không?

Có, và cũng với cùng một lưu ý: không vào lịch sử không có nghĩa là không lưu ở máy chủ.

- **Claude: Incognito chat.** Mở cuộc trò chuyện mới rồi bấm biểu tượng hình bóng ma ở góc trên bên phải. Theo [trang trợ giúp của Claude](https://support.claude.com/en/articles/12260368), cuộc trò chuyện không vào lịch sử, không vào ký ức, không dùng để huấn luyện, nhưng được giữ 30 ngày theo mặc định (gói Enterprise có thể lâu hơn). Nó không lưu lại được, nên cần gì thì chép ra trước khi đóng. Chế độ này không có trong Projects.
- **Gemini: Temporary chat.** Trên gemini.google.com, bấm **Temporary chat** cạnh **New chat** ([hướng dẫn của Google](https://support.google.com/gemini/answer/13275745?hl=en)). Theo [thông báo của Google](https://blog.google/products/gemini/temporary-chats-privacy-controls/), cuộc trò chuyện không hiện trong lịch sử và Gemini Apps Activity, không dùng để cá nhân hóa hay huấn luyện, và được giữ tới 72 giờ để trả lời và xử lý phản hồi nếu bạn gửi.

## Một ví dụ: tạm thời vẫn chưa đủ

Anh Võ Minh Khoa làm nhân sự ở một công ty nhỏ (thông tin hư cấu). Anh mở trò chuyện tạm thời và dán:

> Viết giúp tôi email báo chị Đặng Thu Hương, CCCD 079195001234, số tài khoản 0071 0004 56789, rằng lương tháng 11 được chuyển chậm hai ngày vì lỗi hệ thống.

Đóng cửa sổ xong, lịch sử ChatGPT của anh không còn dấu vết. Người ngồi máy sau không đọc được. ChatGPT cũng không "nhớ" chị Hương. Nhưng tên, số CCCD và số tài khoản của chị đã rời máy anh Khoa, và có thể nằm trên máy chủ của OpenAI tới 30 ngày. Chị Hương chưa từng đồng ý cho thông tin của mình đi tới đó.

AI không cần biết chị Hương là ai để viết email này. Bản dán an toàn hơn:

> Viết giúp tôi email báo chị [TEN_1], CCCD [CCCD_1], số tài khoản [STK_1], rằng lương tháng 11 được chuyển chậm hai ngày vì lỗi hệ thống. Các mã trong ngoặc vuông là thông tin đã được thay, giữ nguyên, không đoán.

Thật ra email báo chậm lương cũng không cần số CCCD. Thông tin nào AI không cần thì bỏ hẳn, thông tin nào cần để câu văn đúng thì thay bằng mã. Anh Khoa đổi mã về thông tin thật trên máy mình rồi mới gửi. Lúc đó, trò chuyện tạm thời hay bình thường thì máy chủ cũng chỉ thấy mã.

## Khi nào nên dùng trò chuyện tạm thời?

Nên dùng khi:

- Bạn dùng chung máy hay chung tài khoản, và không muốn câu hỏi hiện trong lịch sử.
- Bạn hỏi một việc lẻ, không muốn ChatGPT ghi nhớ hay đổi cách trả lời bạn về sau.
- Bạn muốn chắc nội dung không được dùng để huấn luyện, kể cả khi chưa tắt mục đó trong cài đặt.

Đừng coi nó là cách để dán thông tin riêng của người khác. Nó giảm dấu vết ở phía bạn, không giảm những gì đã gửi đi. Muốn tắt huấn luyện cho mọi cuộc trò chuyện, xem bài [ChatGPT có dùng dữ liệu của tôi để huấn luyện không?](./chatgpt-co-dung-du-lieu-de-huan-luyen-khong). Muốn dọn những gì đã lỡ dán, xem [Cách xóa lịch sử trò chuyện trong ChatGPT, Claude và Gemini](./cach-xoa-lich-su-tro-chuyen-chatgpt-claude-gemini).

## Thay mã nhanh hơn với OfflineMask

Với email dài hay bảng tính, thay tay dễ sót. [OfflineMask](../) là ứng dụng miễn phí làm việc này ngay trên máy tính của bạn, không cần mạng:

1. **Ẩn.** Dán văn bản hoặc mở tệp Excel, Word, PDF. Ứng dụng tự tìm email, số điện thoại, số tài khoản, CCCD, mã số thuế, và cả họ tên, địa chỉ khi bạn cài gói tiếng Việt. Bạn xem lại, ẩn thêm chỗ còn sót.
2. **Hỏi AI.** Dán bản đã ẩn vào ChatGPT, Claude hay Gemini, trò chuyện tạm thời hay bình thường đều được.
3. **Khôi phục.** Dán câu trả lời vào lại OfflineMask, các mã tự đổi về thông tin thật. Bảng đối chiếu không rời khỏi máy bạn.

OfflineMask không kết nối với AI nào và tìm được phần lớn chứ không phải mọi thông tin riêng, nên hãy luôn đọc lại trước khi gửi. Xem thêm ở trang [Quyền riêng tư](../privacy).

## Tóm lại

- Trò chuyện tạm thời của ChatGPT không vào lịch sử, không tạo ký ức và không dùng để huấn luyện khi còn là tạm thời.
- OpenAI vẫn có thể giữ một bản sao tới 30 ngày. Bấm lưu thì nó thành cuộc trò chuyện bình thường.
- Bản có cá nhân hóa vẫn đọc ký ức và hướng dẫn tùy chỉnh của bạn; chọn trước tin nhắn đầu tiên.
- Claude (Incognito) giữ 30 ngày, Gemini (Temporary chat) giữ tới 72 giờ.
- Chế độ tạm thời giảm dấu vết ở phía bạn. Để máy chủ không thấy thông tin của ai, hãy thay nó bằng mã trước khi dán.

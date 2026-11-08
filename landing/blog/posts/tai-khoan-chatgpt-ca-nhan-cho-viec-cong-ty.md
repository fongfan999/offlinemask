---
title: Có nên dùng tài khoản ChatGPT cá nhân cho việc công ty không?
description: Không nên đưa dữ liệu công ty vào tài khoản AI cá nhân. Nếu công ty chưa có gói doanh nghiệp, hãy hỏi quy định, tắt huấn luyện và thay thông tin riêng bằng mã.
date: 2026-11-08
---

Tốt nhất là **không**, với bất kỳ việc nào có thông tin của khách hàng, đồng nghiệp hay số liệu nội bộ. Nếu công ty đã mua gói AI dành cho tổ chức (ChatGPT Business hoặc Enterprise, Claude Team hoặc Enterprise, Gemini trong Google Workspace), hãy dùng tài khoản công ty cấp. Nếu công ty chưa có và vẫn cho phép dùng AI, bạn có thể dùng tài khoản cá nhân, nhưng chỉ sau khi đã hỏi quy định, tắt chế độ dùng dữ liệu để huấn luyện, và thay mọi thông tin nhận ra được một người bằng mã trước khi dán.

## Tài khoản cá nhân và tài khoản công ty khác nhau ở đâu?

Hai loại tài khoản chịu hai bộ điều khoản khác nhau, nhất là về việc dữ liệu có được dùng để cải thiện mô hình hay không.

- **ChatGPT.** Với tài khoản cá nhân, nội dung trò chuyện có thể được dùng để huấn luyện mô hình nếu bạn chưa tắt trong cài đặt. Với các gói Business, Enterprise, Edu và API, OpenAI cho biết họ không dùng dữ liệu để huấn luyện theo mặc định ([Business data privacy](https://openai.com/business-data/)).
- **Claude.** Theo [thông báo cập nhật điều khoản của Anthropic](https://www.anthropic.com/news/updates-to-our-consumer-terms), người dùng gói Free, Pro và Max được chọn có cho phép dùng dữ liệu để cải thiện Claude hay không. Nếu cho phép, dữ liệu được giữ tới 5 năm; nếu không, giữ 30 ngày. Các gói Team, Enterprise, Education và API không thuộc điều khoản này.
- **Gemini.** Với tài khoản Google cá nhân, [trang trợ giúp của Google](https://support.google.com/gemini/answer/13594961?hl=en) nói hoạt động của bạn được dùng để cải thiện dịch vụ, kể cả huấn luyện mô hình, một phần cuộc trò chuyện được người thật đọc để đánh giá, và những cuộc đã được đọc có thể được giữ tới ba năm. Chính Google khuyên đừng nhập thông tin bí mật mà bạn không muốn người đánh giá nhìn thấy. Với các phiên bản Google Workspace đủ điều kiện, [Google cho biết](https://knowledge.workspace.google.com/admin/gemini/generative-ai-in-google-workspace-privacy-hub) dữ liệu không được dùng để huấn luyện khi chưa có sự cho phép của khách hàng, và cuộc trò chuyện không do người thật đọc.

Ngoài chuyện huấn luyện, còn một khác biệt dễ bị bỏ qua: tài khoản công ty do công ty quản lý, còn tài khoản cá nhân là của bạn. Mọi thứ bạn dán vào tài khoản cá nhân nằm trong lịch sử của bạn, trên điện thoại, máy tính ở nhà, ở mọi nơi bạn đăng nhập.

Các chính sách này thay đổi khá thường xuyên, nên hãy mở lại các trang trên để xem điều khoản hiện hành.

## Rủi ro thật sự là gì?

Không phải chuyện AI "lấy cắp" dữ liệu. Rủi ro nằm ở những việc rất đời thường:

- **Dữ liệu công ty đi theo bạn về nhà.** Bảng công nợ, danh sách khách hàng bạn đã dán vẫn nằm trong lịch sử trò chuyện, kể cả sau khi bạn nghỉ việc. Công ty không có cách nào thu hồi.
- **Người khác mở được.** Máy tính gia đình, điện thoại cho con mượn, trình duyệt dùng chung: ai mở được tài khoản là đọc được lịch sử.
- **Công ty không biết.** Khi có sự cố, công ty không biết dữ liệu nào đã đi đâu, vì nó nằm trong tài khoản của từng nhân viên.
- **Trách nhiệm pháp lý.** Dán họ tên, số điện thoại, CCCD của khách vào một dịch vụ AI là xử lý dữ liệu cá nhân theo Luật Bảo vệ dữ liệu cá nhân. Bài [Luật Bảo vệ dữ liệu cá nhân nói gì về việc dùng AI ở công ty?](./luat-bao-ve-du-lieu-ca-nhan-dung-ai-cong-ty) đi qua các điều luật liên quan.

Ngược lại, dùng tài khoản cá nhân để hỏi cách viết công thức Excel, sửa câu chữ một thông báo chung hay học một khái niệm kế toán thì gần như không có gì đáng lo, vì trong đó không có thông tin của ai.

## Công ty chưa có gói doanh nghiệp thì làm thế nào?

Năm bước sau giúp bạn vẫn dùng được AI mà không mang dữ liệu công ty theo.

### Bước 1: Hỏi quy định

Hỏi quản lý hoặc bộ phận IT: công ty có cho dùng AI không, dùng công cụ nào, có loại dữ liệu nào tuyệt đối không được đưa vào. Nếu công ty cấm, hãy làm theo.

### Bước 2: Tắt chế độ dùng dữ liệu để huấn luyện

- ChatGPT: **Settings > Data controls**, tắt **Improve the model for everyone**. Chi tiết trong bài [ChatGPT có dùng dữ liệu của tôi để huấn luyện không?](./chatgpt-co-dung-du-lieu-de-huan-luyen-khong).
- Claude: mở phần Privacy Settings của tài khoản và không cho phép dùng dữ liệu để cải thiện Claude.
- Gemini: tắt **Keep Activity**. Theo Google, khi tắt, cuộc trò chuyện vẫn được giữ với tài khoản 72 giờ.

Tắt huấn luyện không có nghĩa là dữ liệu không rời máy bạn. Nội dung vẫn được gửi lên và lưu trên máy chủ của nhà cung cấp một thời gian.

### Bước 3: Thay thông tin riêng bằng mã trước khi dán

Đây là bước quan trọng nhất, vì nó đúng với mọi loại tài khoản. AI cần ngữ cảnh, không cần biết bạn đang nói về ai.

Ví dụ, chị Phạm Thu Trang làm kinh doanh ở một công ty phân phối nhỏ muốn nhờ AI soạn email báo giá (thông tin hư cấu):

> Soạn email gửi anh Hoàng Văn Nam, Công ty TNHH Ánh Dương, số 0903 456 789, báo giá 200 thùng nước rửa chén, giá 185.000 đồng/thùng, giao trước ngày 20/11, chiết khấu 3% nếu thanh toán trong 7 ngày.

Bản dán vào tài khoản cá nhân:

> Soạn email gửi anh [TEN_1], [TO_CHUC_1], số [SDT_1], báo giá 200 thùng nước rửa chén, giá 185.000 đồng/thùng, giao trước ngày 20/11, chiết khấu 3% nếu thanh toán trong 7 ngày. Các mã trong ngoặc vuông là thông tin đã được thay, giữ nguyên, không đoán.

AI vẫn viết được email đầy đủ với "Kính gửi anh [TEN_1]". Chị Trang đổi mã về tên thật trên máy mình rồi mới gửi. Lịch sử trò chuyện trong tài khoản cá nhân chỉ còn mã, không còn tên khách hay số điện thoại.

Nếu giá bán hay chiết khấu cũng là bí mật kinh doanh, hãy hỏi công ty trước khi đưa cả những con số đó vào.

### Bước 4: Xóa khi xong việc

Xong việc thì xóa cuộc trò chuyện, hoặc dùng chế độ trò chuyện tạm thời cho câu hỏi lẻ. Cả hai cách đều không xóa ngay lập tức khỏi máy chủ: ChatGPT có thể giữ tới 30 ngày, Gemini khi tắt Keep Activity giữ 72 giờ. Nhưng lịch sử của bạn sẽ ít thứ để lộ hơn.

### Bước 5: Tách bạch việc riêng và việc công ty

Không dùng chung tài khoản AI với người thân hay đồng nghiệp. Nếu dùng nhiều cho việc công ty, hãy đề xuất với quản lý cân nhắc một gói dành cho tổ chức.

## Có gói doanh nghiệp rồi thì dán gì cũng được?

Không hẳn. Gói doanh nghiệp giải quyết chuyện huấn luyện và quản lý tài khoản, nhưng dữ liệu vẫn được gửi tới máy chủ của nhà cung cấp, thường ở nước ngoài. Nghĩa vụ dùng dữ liệu cá nhân đúng mục đích và trong phạm vi cần thiết vẫn còn nguyên. Thay thông tin riêng bằng mã vẫn là thói quen tốt, dù bạn dùng tài khoản nào.

## Làm nhanh hơn với OfflineMask

Thay tay vài cái tên thì được, với email dài, hợp đồng hay bảng tính trăm dòng thì dễ sót. [OfflineMask](../) là ứng dụng miễn phí làm việc thay mã ngay trên máy tính của bạn, không cần mạng:

1. **Ẩn.** Dán văn bản hoặc mở tệp Excel, Word. Ứng dụng tự tìm email, số điện thoại, số tài khoản, CCCD, mã số thuế, và cả họ tên, địa chỉ, tên tổ chức khi bạn cài gói tiếng Việt. Bạn xem lại, ẩn thêm chỗ còn sót.
2. **Hỏi AI.** Dán bản đã ẩn vào ChatGPT, Claude hay Gemini, bằng tài khoản nào cũng được.
3. **Khôi phục.** Dán câu trả lời vào lại OfflineMask, các mã tự đổi về thông tin thật. Bảng đối chiếu không rời khỏi máy bạn.

OfflineMask không kết nối với AI nào và tìm được phần lớn chứ không phải mọi thông tin riêng, nên hãy luôn đọc lại trước khi gửi. Ứng dụng không thay cho quy định của công ty. Xem thêm ở trang [Quyền riêng tư](../privacy).

## Tóm lại

- Việc có dữ liệu khách hàng, đồng nghiệp hay số liệu nội bộ: ưu tiên tài khoản AI do công ty cấp.
- Tài khoản cá nhân có thể dùng dữ liệu để huấn luyện mô hình, và lịch sử đi theo bạn kể cả khi nghỉ việc.
- Nếu buộc phải dùng tài khoản cá nhân: hỏi quy định, tắt huấn luyện, thay thông tin riêng bằng mã, xóa khi xong việc.
- Gói doanh nghiệp không miễn trách nhiệm với dữ liệu cá nhân; thay mã vẫn là thói quen nên giữ.

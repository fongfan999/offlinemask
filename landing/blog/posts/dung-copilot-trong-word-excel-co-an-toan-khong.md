---
title: Dùng Copilot trong Word, Excel có an toàn với dữ liệu khách hàng?
description: Copilot với tài khoản công ty an toàn hơn tài khoản cá nhân, nhưng dữ liệu vẫn lên máy chủ Microsoft. Hỏi IT, dùng bản sao và thay thông tin khách bằng mã.
date: 2026-11-22
checked: 2026-11-22
---

**Tương đối an toàn nếu bạn dùng Copilot bằng tài khoản công ty cấp, và công ty cho phép**. Microsoft cam kết không dùng câu lệnh, câu trả lời và nội dung tệp để huấn luyện mô hình, với cả gói doanh nghiệp lẫn gói gia đình. Nhưng "không huấn luyện" không có nghĩa là dữ liệu ở yên trên máy bạn: nội dung bạn đưa cho Copilot vẫn được gửi lên máy chủ của Microsoft để xử lý, và lịch sử trò chuyện được lưu lại. Với bảng danh sách khách hàng hay hợp đồng có CCCD, cách chắc chắn nhất vẫn là làm trên một bản sao đã thay thông tin riêng bằng mã.

## Copilot trong Word, Excel làm gì với dữ liệu của bạn?

Khi bạn bấm nút Copilot và gõ "tóm tắt tài liệu này" hay "phân tích bảng này", nội dung tệp cùng câu lệnh được gửi tới dịch vụ AI của Microsoft trên đám mây, rồi câu trả lời được gửi về. Mô hình AI không chạy trên máy tính của bạn.

Microsoft có hai loại Copilot trong Word, Excel, với hai bộ cam kết khác nhau:

- **Tài khoản công ty hoặc trường học (Microsoft 365 Copilot).** Theo [trang Data, Privacy, and Security for Microsoft Copilot](https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-privacy), câu lệnh, câu trả lời và dữ liệu Copilot truy cập không được dùng để huấn luyện mô hình nền tảng. Lịch sử tương tác được lưu, mã hóa, theo hợp đồng giữa Microsoft và công ty bạn, và quản trị viên có thể tìm kiếm, đặt thời hạn lưu cho nó. Với khách hàng ngoài châu Âu, câu lệnh có thể được xử lý ở Mỹ, châu Âu hoặc khu vực khác.
- **Tài khoản cá nhân (Microsoft 365 Personal, Family, Premium).** [Trang trợ giúp về Copilot trong ứng dụng Microsoft 365 cho gia đình](https://support.microsoft.com/privacy/copilot-in-microsoft-365-apps-for-home-your-data-and-privacy) nói câu lệnh, câu trả lời và nội dung tệp khi dùng Copilot không được dùng để huấn luyện mô hình nền tảng. Copilot chỉ dùng nội dung tệp bạn đang mở, hoặc tệp khác bạn yêu cầu nó xem.

Các chính sách này được Microsoft cập nhật khá thường xuyên, nên hãy mở lại hai trang trên để xem điều khoản hiện hành.

## Vậy rủi ro nằm ở đâu?

Không phải ở chuyện huấn luyện. Rủi ro thật sự đời thường hơn nhiều.

### Copilot thấy mọi thứ bạn được quyền xem

Với tài khoản công ty, Copilot có thể tìm trong email, lịch, tin nhắn Teams và tài liệu trên SharePoint, OneDrive mà bạn có quyền xem. Microsoft nói rõ Copilot chỉ đưa ra dữ liệu mà người dùng ít nhất có quyền xem, và nhắc công ty phải phân quyền đúng.

Vấn đề là nhiều công ty chia sẻ tệp khá thoáng. Ví dụ (hư cấu): bảng lương quý 3 bị chia sẻ cho "mọi người trong công ty" từ năm ngoái rồi quên. Giờ một nhân viên hỏi Copilot "tóm tắt các tài liệu về lương thưởng" là Copilot có thể trích ra. Copilot không phá quyền truy cập, nó làm lộ rõ những gì vốn đã chia sẻ sai.

### Dùng tài khoản cá nhân cho tệp công ty

Nếu bạn mở danh sách khách hàng của công ty trên máy cài Microsoft 365 Family của gia đình rồi nhờ Copilot phân tích, dữ liệu đó đi qua tài khoản cá nhân của bạn, ngoài tầm quản lý của công ty. Đây cũng là chuyện đã nói trong bài [Có nên dùng tài khoản ChatGPT cá nhân cho việc công ty không?](./tai-khoan-chatgpt-ca-nhan-cho-viec-cong-ty): cam kết không huấn luyện không giải quyết được việc dữ liệu công ty nằm ở nơi công ty không biết.

### Trách nhiệm với dữ liệu cá nhân vẫn còn nguyên

Đưa họ tên, số điện thoại, CCCD của khách cho một dịch vụ AI là xử lý dữ liệu cá nhân, dù dịch vụ đó tích hợp sẵn trong Word. Bài [Luật Bảo vệ dữ liệu cá nhân nói gì về việc dùng AI ở công ty?](./luat-bao-ve-du-lieu-ca-nhan-dung-ai-cong-ty) đi qua các nghĩa vụ liên quan.

## Dùng Copilot an toàn hơn: 4 bước

### Bước 1: Hỏi IT trước

Hỏi bộ phận IT hoặc quản lý: công ty có cho dùng Copilot không, dùng bằng tài khoản nào, loại dữ liệu nào không được đưa vào. Nếu bạn thấy Copilot tìm ra một tệp mà lẽ ra mình không được xem, hãy báo IT để họ sửa quyền chia sẻ.

### Bước 2: Chỉ đưa cho Copilot đúng phần cần

Muốn Copilot viết công thức tính doanh thu theo khu vực, nó cần cột khu vực và cột doanh thu, không cần cột họ tên, số điện thoại. Hãy tạo bản sao tệp, xóa những cột không cần cho câu hỏi, rồi mới mở Copilot trên bản sao.

### Bước 3: Thay thông tin riêng bằng mã trên bản sao

Những cột vẫn cần giữ để phân tích (như mã khách, tên người phụ trách) thì thay bằng mã nhất quán: cùng một người luôn là cùng một mã. Ví dụ một dòng trong bảng công nợ (hư cấu):

| Khách hàng | Điện thoại | Khu vực | Còn nợ (đồng) |
|---|---|---|---|
| Lê Hoàng Phúc | 0912 345 678 | Đà Nẵng | 12.400.000 |

Trên bản sao gửi Copilot:

| Khách hàng | Điện thoại | Khu vực | Còn nợ (đồng) |
|---|---|---|---|
| [TEN_1] | [SDT_1] | Đà Nẵng | 12.400.000 |

Copilot vẫn tính được tổng nợ theo khu vực, tìm được khách nợ nhiều nhất và soạn được thư nhắc nợ gửi "anh [TEN_1]". Bạn đổi mã về tên thật trên máy mình trước khi gửi thư. Cách làm chi tiết với bảng tính có trong bài [Cách ẩn thông tin cá nhân trong file Excel trước khi gửi AI phân tích](./an-thong-tin-ca-nhan-trong-file-excel-gui-ai).

### Bước 4: Tắt Copilot khi không cần

Với tài khoản cá nhân, theo [hướng dẫn của Microsoft](https://support.microsoft.com/en-us/Privacy/turn-off-copilot-in-microsoft-365-apps), bạn có thể tắt Copilot cho từng ứng dụng:

- **Windows:** trong Word hoặc Excel, vào **File > Options > Copilot**, bỏ chọn **Enable Copilot**, bấm OK rồi mở lại ứng dụng.
- **Mac:** vào menu ứng dụng > **Preferences > Authoring and Proofing Tools > Copilot**, bỏ chọn **Enable Copilot**, rồi mở lại ứng dụng.

Lưu ý từ chính trang đó: phải tắt riêng cho từng ứng dụng, trên từng máy; ẩn biểu tượng Copilot trên thanh công cụ không có nghĩa là đã tắt; và bản web, bản iOS, Android không tắt được theo cách này. Với tài khoản công ty, ô này không có, việc bật tắt do quản trị viên quyết định.

## Thay mã nhanh hơn với OfflineMask

Thay tay vài ô thì được, với bảng vài trăm dòng hay hợp đồng nhiều trang thì dễ sót. [OfflineMask](../) là ứng dụng miễn phí làm việc thay mã ngay trên máy tính của bạn, không cần mạng:

1. **Ẩn.** Mở tệp Excel (XLSX, XLS, CSV) hoặc Word (DOCX). Ứng dụng tự tìm email, số điện thoại, số tài khoản, CCCD, mã số thuế, và cả họ tên, địa chỉ, tên tổ chức khi bạn cài gói tiếng Việt. Bạn xem lại rồi ẩn; bản đã ẩn giữ nguyên định dạng.
2. **Hỏi Copilot.** Mở bản đã ẩn trong Word hoặc Excel và dùng Copilot như bình thường. Muốn làm ngay trong tài liệu đang mở thì trên macOS và Windows có Ẩn nhanh: bôi đen đoạn chữ rồi bấm nút OfflineMask hoặc phím tắt để ẩn tại chỗ.
3. **Khôi phục.** Dán câu trả lời của Copilot vào OfflineMask, các mã tự đổi về thông tin thật. Bảng đối chiếu không rời khỏi máy bạn.

OfflineMask không kết nối với Copilot hay AI nào, và tìm được phần lớn chứ không phải mọi thông tin riêng, nên hãy luôn xem lại trước khi gửi. Nếu Copilot sửa một mã, mã đó được để nguyên để bạn kiểm tra. Xem thêm ở trang [Quyền riêng tư](../privacy).

## Tóm lại

- Microsoft cam kết không dùng câu lệnh, câu trả lời và nội dung tệp trong Copilot để huấn luyện mô hình nền tảng, cả với tài khoản công ty lẫn gói gia đình.
- Nội dung vẫn được gửi lên máy chủ của Microsoft để xử lý, và lịch sử được lưu.
- Với tài khoản công ty, Copilot thấy mọi tệp bạn có quyền xem, nên tệp chia sẻ sai sẽ dễ bị lộ hơn.
- Đừng dùng Copilot trong tài khoản cá nhân cho tệp có dữ liệu khách hàng của công ty.
- Hỏi IT, làm trên bản sao, bỏ cột không cần, thay thông tin riêng bằng mã trước khi nhờ Copilot.

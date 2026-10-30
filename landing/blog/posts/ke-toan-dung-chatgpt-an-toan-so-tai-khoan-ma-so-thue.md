---
title: Kế toán dùng ChatGPT an toàn với số tài khoản, mã số thuế thế nào?
description: AI cần số tiền, ngày và nội dung nghiệp vụ, không cần số tài khoản hay mã số thuế cá nhân. Thay chúng bằng mã nhất quán trước khi dán, giữ nguyên các con số.
date: 2026-10-30
---

Kế toán vẫn dùng ChatGPT, Claude hay Gemini được cho đối chiếu sao kê, nhắc công nợ hay hỏi cách hạch toán, miễn là **không dán số tài khoản, mã số thuế cá nhân và tên người thật**. AI cần số tiền, ngày và nội dung nghiệp vụ, không cần biết ai là ai. Hãy thay số tài khoản, mã số thuế, họ tên bằng mã nhất quán như `[STK_1]`, `[MST_1]`, `[TEN_1]`, giữ nguyên các con số, và giữ bảng đối chiếu trên máy bạn. Bài này chỉ cách làm với ba việc kế toán hay nhờ AI nhất.

## Thông tin nào trong sổ sách kế toán cần ẩn?

Sổ sách kế toán chứa thông tin của nhân viên, khách hàng, nhà cung cấp. Trước khi dán, hãy dò những loại sau:

- **Số tài khoản ngân hàng và tên chủ tài khoản.** Hay nằm ở chỗ ít để ý như nội dung chuyển khoản trên sao kê: "NGUYEN MINH ANH CK TIEN HANG".
- **Mã số thuế cá nhân.** Từ ngày 01/07/2025, cá nhân, hộ gia đình và hộ kinh doanh dùng **số định danh cá nhân (số CCCD 12 số) thay cho mã số thuế**, theo [hướng dẫn trên Báo Điện tử Chính phủ](https://baochinhphu.vn/huong-dan-trien-khai-so-dinh-danh-ca-nhan-chinh-thuc-thay-ma-so-thue-tu-1-7-102250625180154013.htm). Nghĩa là dán mã số thuế của một nhân viên hay một hộ kinh doanh bây giờ thường chính là dán số CCCD của họ.
- **Họ tên, số điện thoại, email** của người nộp tiền, người nhận tiền, người phụ thuộc trong hồ sơ thuế thu nhập cá nhân.
- **Lương, thưởng, khoản vay** gắn với tên một người.
- **Mã số thuế, tên công ty khách hàng.** Không phải dữ liệu cá nhân, nhưng cho biết công ty bạn làm ăn với ai. Có cam kết bảo mật thì ẩn luôn.

Và một nhóm **không bao giờ dán, kể cả đã ẩn**: mật khẩu ngân hàng điện tử, mã OTP, mã PIN chữ ký số, tên đăng nhập phần mềm kế toán. Không việc nào cần AI biết những thứ này.

## Việc 1: Đối chiếu sao kê với công nợ

Giả sử bạn có sao kê tháng 10 và bảng công nợ phải thu (thông tin hư cấu):

| Ngày | Số tiền | Nội dung chuyển khoản |
|---|---|---|
| 03/10 | 12.500.000 | TRAN VAN BINH 0912345678 TT HD 0158 |
| 07/10 | 4.200.000 | CONG TY TNHH AN PHAT CK |
| 15/10 | 8.000.000 | TK 0071000456789 LE THI THU TRA NO |

Câu hỏi của bạn: "Khoản nào khớp với hóa đơn nào, khách nào còn nợ?" AI cần số tiền, ngày, số hóa đơn và **biết khoản tiền nào của khách nào trong bảng công nợ**. Vậy chỉ cần thay danh tính bằng cùng một mã ở cả hai bảng:

| Ngày | Số tiền | Nội dung chuyển khoản |
|---|---|---|
| 03/10 | 12.500.000 | [TEN_1] [SDT_1] TT HD 0158 |
| 07/10 | 4.200.000 | [CTY_1] CK |
| 15/10 | 8.000.000 | TK [STK_1] [TEN_2] TRA NO |

Trong bảng công nợ, Trần Văn Bình cũng phải là `[TEN_1]`, Lê Thị Thu là `[TEN_2]`. Nếu mỗi bảng đánh mã một kiểu, AI không ghép được và sẽ trả lời sai.

Hai lưu ý riêng cho sao kê:

1. **Tên trên sao kê thường viết hoa không dấu** ("LE THI THU"), còn trong sổ là "Lê Thị Thu". Khi tự thay bằng tay, đừng quên dạng này; dùng Find (Ctrl+F) với cả hai cách viết.
2. **Giữ nguyên số tiền và ngày.** Đổi số tiền là AI đối chiếu sai. Số tiền không nhận ra được ai khi đã bỏ tên.

Nếu ngân hàng cho tải sao kê dạng Excel, cách thay cả cột bằng mã nhất quán có trong bài [ẩn thông tin cá nhân trong file Excel](./an-thong-tin-ca-nhan-trong-file-excel-gui-ai).

## Việc 2: Soạn email nhắc công nợ

Đây là việc AI làm tốt và hoàn toàn không cần danh tính:

> Soạn email lịch sự nhắc [TEN_2] thanh toán khoản nợ 15.000.000 đồng của hóa đơn số 0172 đã quá hạn 20 ngày. Đề nghị chuyển vào tài khoản [STK_CTY] trước ngày 10/11. Giọng nhẹ nhàng, giữ quan hệ lâu dài.

AI sẽ viết lại đúng các mã đó trong email, ví dụ "Kính gửi anh/chị [TEN_2]...". Bạn đổi mã về thông tin thật rồi mới gửi.

## Việc 3: Hỏi cách hạch toán, cách tính thuế

Nhiều câu hỏi kế toán **không cần dữ liệu thật nào**. Thay vì dán nguyên phiếu chi, hãy mô tả nghiệp vụ:

> Công ty mua máy in 9.800.000 đồng chưa VAT, thuế suất 10%, thanh toán chuyển khoản. Hạch toán thế nào theo chế độ kế toán doanh nghiệp nhỏ và vừa?

Lưu ý: quy định thuế thay đổi thường xuyên, AI có thể trả lời theo quy định cũ. Hãy kiểm tra lại văn bản hiện hành trước khi ghi sổ hay nộp tờ khai.

## Làm sao để không sót khi tự thay bằng tay?

1. **Làm trên bản sao**, và ghi bảng đối chiếu (`[TEN_1]` = Trần Văn Bình...) ra file riêng, không dán vào AI.
2. **Tìm theo dạng số.** Dò các dãy 9 đến 14 chữ số: đó thường là số tài khoản, số CCCD hay mã số thuế. Dò cả số có dấu cách hoặc dấu chấm ở giữa, như "0071 0004 56789".
3. **Soát những chỗ hay sót**: cột ghi chú, nội dung chuyển khoản, tên file ("Cong_no_Tran_Van_Binh.xlsx"), tên trang tính, chữ ký email.
4. **Dặn AI giữ nguyên mã**: "Các đoạn trong ngoặc vuông là thông tin đã được thay thế, giữ nguyên, không đoán."

Nếu dùng ChatGPT cá nhân cho việc công ty, đọc thêm [ChatGPT có dùng dữ liệu của tôi để huấn luyện không?](./chatgpt-co-dung-du-lieu-de-huan-luyen-khong) để tắt đúng chỗ.

## Công ty có được đưa số liệu kế toán lên AI không?

Hãy hỏi kế toán trưởng hoặc bộ phận pháp chế về quy định của công ty. Về pháp luật, [Luật Bảo vệ dữ liệu cá nhân (Luật số 91/2025/QH15)](https://hatinh.gov.vn/vi/bai-viet/luat-bao-ve-du-lieu-ca-nhan-chinh-thuc-co-hieu-luc-thi-hanh-tu-ngay-112026) có hiệu lực từ ngày 01/01/2026, và số tài khoản, giao dịch ngân hàng hay mã số thuế gắn với một người đều là dữ liệu cá nhân của người đó. Cách an toàn là để thông tin nhận ra được người khác ở lại trên máy bạn ngay từ đầu.

## Làm nhanh hơn với OfflineMask

Với sao kê vài trăm dòng, dò tay từng số rất dễ sót. [OfflineMask](../) là ứng dụng miễn phí làm việc này ngay trên máy bạn, không cần mạng:

1. **Ẩn.** Dán văn bản, hoặc mở file XLSX, XLS, CSV, DOCX. Ứng dụng tự tìm số tài khoản, số thẻ, mã số thuế, CCCD, số điện thoại, email, mật khẩu, và cả họ tên, địa chỉ, tên tổ chức khi bạn cài gói tiếng Việt. Bạn xem lại, ẩn thêm chỗ còn sót, rồi xuất bản đã ẩn, giữ nguyên định dạng bảng. File PDF có chữ bên trong cũng mở được, khi đó bản đã ẩn là văn bản thuần; sao kê dạng ảnh chụp hay bản scan thì chưa hỗ trợ.
2. **Hỏi AI.** Gửi bản đã ẩn cho AI bạn hay dùng. Cùng một người luôn mang cùng một mã, kiểu `[STK_1_4e8c]`, nên AI vẫn đối chiếu được.
3. **Khôi phục.** Dán câu trả lời của AI vào lại OfflineMask, các mã tự đổi về thông tin thật. Bảng đối chiếu không rời khỏi máy bạn.

OfflineMask tìm được phần lớn thông tin riêng chứ không phải tất cả, nên hãy luôn đọc lại bản đã ẩn, nhất là nội dung chuyển khoản viết tắt. Xem cách ứng dụng xử lý dữ liệu ở trang [Quyền riêng tư](../privacy).

## Tóm lại

- AI cần số tiền, ngày và nội dung nghiệp vụ; không cần số tài khoản, mã số thuế cá nhân hay tên người thật.
- Mã số thuế cá nhân giờ là số CCCD, nên ẩn nó như ẩn CCCD.
- Thay danh tính bằng mã nhất quán ở mọi bảng, giữ nguyên số tiền, giữ bảng đối chiếu trên máy.
- Không bao giờ dán mật khẩu ngân hàng, OTP hay mã PIN chữ ký số.
- Câu trả lời của AI về thuế chỉ là gợi ý: kiểm tra lại văn bản hiện hành.

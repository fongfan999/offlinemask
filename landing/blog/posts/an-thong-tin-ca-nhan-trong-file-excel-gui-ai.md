---
title: Cách ẩn thông tin cá nhân trong file Excel trước khi gửi AI phân tích
description: Làm một bản sao, bỏ cột AI không cần, thay họ tên, số điện thoại bằng mã nhất quán và dọn phần ẩn trong file trước khi tải lên ChatGPT hay Gemini.
date: 2026-10-25
---

Muốn nhờ AI phân tích một file Excel có thông tin khách hàng hay nhân viên, hãy làm trên **một bản sao**: xóa những cột AI không cần, thay các cột nhận ra được một người (họ tên, số điện thoại, số tài khoản, CCCD…) bằng mã nhất quán như `KH_001`, dọn trang tính ẩn, ghi chú và thông tin tác giả, rồi mới tải lên. Bảng đối chiếu mã giữ riêng trên máy bạn. Các con số cần phân tích để nguyên, nên AI vẫn tính đúng. Dưới đây là cách làm từng bước.

## Vì sao file Excel dễ lộ hơn một đoạn văn bản

Khi dán một đoạn chữ, bạn nhìn thấy hết những gì mình gửi. Khi tải lên cả một file, AI nhận **toàn bộ file**, kể cả những thứ bạn không để ý:

- Trang tính bị ẩn, dòng và cột bị ẩn, hoặc cột chỉ bị thu hẹp lại.
- Ghi chú (comment, note) trong ô, đầu trang và chân trang.
- Thông tin tác giả, tên công ty trong phần thuộc tính của file.
- Tên trang tính và tên file, ví dụ "Luong_T9_Tran_Thi_Hoa.xlsx".

Ngoài ra, một bảng tính thường chứa thông tin của hàng trăm người cùng lúc. Sót một cột là sót cả trăm số điện thoại, chứ không phải một.

## Bước 1: Xác định AI thật sự cần gì

Trước khi xóa hay thay, hãy viết ra câu bạn định hỏi. Giả sử bạn có file "Đơn hàng tháng 9" với các cột:

| Họ tên | Điện thoại | Địa chỉ | Tỉnh/Thành | Sản phẩm | Số tiền | Ngày |
|---|---|---|---|---|---|---|
| Nguyễn Minh Anh | 0901 234 567 | 12 Lê Lợi, P. Bến Thành | TP.HCM | Nồi chiên | 1.290.000 | 03/09 |
| Trần Văn Bình | 0912 345 678 | 45 Trần Phú | Hà Nội | Máy xay | 850.000 | 05/09 |
| Nguyễn Minh Anh | 0901 234 567 | 12 Lê Lợi, P. Bến Thành | TP.HCM | Máy xay | 850.000 | 21/09 |

Câu hỏi: "Doanh thu theo tỉnh và theo sản phẩm thế nào, khách nào mua lại nhiều nhất?"

Để trả lời, AI cần Tỉnh/Thành, Sản phẩm, Số tiền, Ngày, và cần biết **dòng nào là cùng một khách**. Nó không cần tên thật, số điện thoại hay số nhà. Vậy:

- **Giữ nguyên:** Tỉnh/Thành, Sản phẩm, Số tiền, Ngày.
- **Thay bằng mã:** Họ tên (vì cần đếm khách mua lại).
- **Xóa hẳn:** Điện thoại, Địa chỉ.

Nguyên tắc chung: cột nào không phục vụ câu hỏi thì xóa; cột nào cần để phân biệt người này với người kia thì thay bằng mã; cột số liệu thì để nguyên.

## Bước 2: Thay họ tên bằng mã nhất quán

"Nhất quán" nghĩa là cùng một người luôn có cùng một mã. Nếu Nguyễn Minh Anh ở dòng 1 là `KH_001` nhưng ở dòng 3 thành `KH_003`, AI sẽ tưởng là hai khách và trả lời sai câu "khách nào mua lại".

Cách làm trong Excel, không cần công thức phức tạp:

1. Lưu một bản sao của file. Từ đây chỉ làm trên bản sao.
2. Sao chép cột Họ tên sang một trang tính mới, đặt tên "DoiChieu". Dùng **Data > Remove Duplicates** (Dữ liệu > Loại bỏ trùng lặp) để mỗi tên chỉ còn một dòng.
3. Ở cột bên cạnh, gõ mã cho từng tên: `KH_001`, `KH_002`… (gõ hai ô đầu rồi kéo xuống).
4. Quay lại trang chính, thêm một cột "Mã KH" và dùng VLOOKUP để lấy mã theo tên, ví dụ `=VLOOKUP(A2;DoiChieu!A:B;2;FALSE)` (máy dùng dấu phẩy thì thay `;` bằng `,`).
5. Chọn cột "Mã KH", **Copy** rồi **Paste Values** (Dán giá trị) để cột chỉ còn chữ, không còn công thức trỏ về trang đối chiếu.
6. Xóa cột Họ tên, Điện thoại, Địa chỉ. **Xóa hẳn**, đừng chỉ ẩn: cột bị ẩn vẫn nằm trong file.
7. Chuyển trang "DoiChieu" sang một file riêng để giữ trên máy bạn, rồi xóa nó khỏi bản sao.

Kết quả gửi đi trông như thế này:

| Mã KH | Tỉnh/Thành | Sản phẩm | Số tiền | Ngày |
|---|---|---|---|---|
| KH_001 | TP.HCM | Nồi chiên | 1.290.000 | 03/09 |
| KH_002 | Hà Nội | Máy xay | 850.000 | 05/09 |
| KH_001 | TP.HCM | Máy xay | 850.000 | 21/09 |

Khi AI trả lời "KH_001 mua hai lần, tổng 2.140.000 đồng", bạn tra file đối chiếu là biết đó là ai.

Với cột số tài khoản, số CCCD hay mã số thuế, làm tương tự nếu AI cần phân biệt từng người (`STK_001`…), còn không thì xóa cột.

## Bước 3: Dọn những phần ẩn trong file

Excel có sẵn công cụ **Document Inspector** (Kiểm tra tài liệu) để tìm những thứ ẩn: vào **File > Info > Check for Issues > Inspect Document**, đánh dấu các mục cần kiểm tra rồi bấm **Inspect**. Công cụ sẽ báo ghi chú, thuộc tính file và thông tin cá nhân, đầu trang và chân trang, dòng, cột và trang tính ẩn; bạn bấm **Remove All** ở mục nào muốn xóa. Microsoft khuyên làm việc này trên bản sao, vì dữ liệu đã xóa thường không lấy lại được. Xem hướng dẫn đầy đủ trên [trang hỗ trợ của Microsoft](https://support.microsoft.com/en-us/office/remove-hidden-data-and-personal-information-by-inspecting-documents-presentations-or-workbooks-356b7b5d-77af-44fe-a07f-9aa4d085966f).

Lưu ý: nếu dòng hoặc cột ẩn đang được công thức dùng tới, xóa chúng có thể làm đổi kết quả tính. Hãy hiện chúng lên xem trước khi xóa.

Cuối cùng, tự soát lại vài chỗ công cụ không làm thay bạn:

- Tên các trang tính và tên file có chứa tên người không?
- Cột "Ghi chú" hay "Nội dung" có câu kiểu "khách Minh Anh hẹn giao sau 5h, gọi số 0901…" không? Những cột chữ tự do như vậy rất hay sót.
- Có bảng tổng hợp, biểu đồ hay hình ảnh nào còn hiện tên thật không?

## Có cần làm hết từng ấy bước mỗi lần không?

Với một file nhỏ, dùng một lần, làm thủ công như trên mất chừng mười lăm phút và hoàn toàn ổn. Nhưng nếu tuần nào bạn cũng gửi báo cáo cho AI, hoặc file có cột ghi chú dài, việc dò tay vừa tốn thời gian vừa dễ sót.

[OfflineMask](../) là ứng dụng miễn phí làm việc này ngay trên máy bạn, không cần mạng. Bạn mở file XLSX, XLS, ODS hoặc CSV; ứng dụng tự tìm số điện thoại, số tài khoản, email, CCCD, mã số thuế…, và cả họ tên, địa chỉ khi cài gói tiếng Việt. Bạn có thể ẩn cả cột họ tên, số điện thoại, số tài khoản trong một lần bấm, xem lại, rồi xuất một bản đã ẩn để gửi AI; định dạng của bảng được giữ nguyên. Cùng một người luôn mang cùng một mã, kiểu `[TEN_1_4e8c]`.

Khi AI trả lời, bạn dán câu trả lời vào lại OfflineMask, các mã tự đổi về thông tin thật. Bảng đối chiếu không rời khỏi máy bạn. OfflineMask tìm được phần lớn thông tin riêng chứ không phải tất cả, nên hãy luôn xem lại bản đã ẩn trước khi gửi, nhất là các cột ghi chú. Chưa hỗ trợ PDF và hình ảnh.

Nếu bạn còn băn khoăn có nên đưa dữ liệu khách hàng cho AI hay không, bài [Có nên dán thông tin khách hàng vào ChatGPT không?](./co-nen-dan-thong-tin-khach-hang-vao-chatgpt) giải thích kỹ hơn.

## Tóm lại

- Luôn làm trên bản sao, và viết ra câu định hỏi trước khi sửa file.
- Cột AI không cần thì xóa hẳn; cột cần để phân biệt người thì thay bằng mã nhất quán; cột số liệu để nguyên.
- Đừng chỉ ẩn cột: cột ẩn, trang ẩn, ghi chú và thuộc tính file vẫn đi theo file. Dùng Document Inspector để dọn.
- Giữ bảng đối chiếu mã ở file riêng trên máy bạn, không bao giờ tải nó lên AI.
- Soát lại cột ghi chú, tên trang tính và tên file trước khi gửi.

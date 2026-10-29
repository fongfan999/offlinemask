---
title: Nhờ AI soạn hợp đồng mà không lộ tên, CCCD của các bên
description: AI cần nội dung điều khoản chứ không cần biết các bên là ai. Thay họ tên, CCCD, địa chỉ, số tài khoản bằng mã, nhờ AI soạn, rồi điền lại trên máy bạn.
date: 2026-10-28
---

Bạn có thể nhờ ChatGPT, Claude hay Gemini soạn hoặc sửa hợp đồng mà không đưa tên, số CCCD của ai. Để viết điều khoản thuê nhà, mua bán hay dịch vụ, AI chỉ cần biết **loại hợp đồng, số tiền, thời hạn và các điều kiện**. Họ tên, ngày sinh, số CCCD, địa chỉ thường trú, số điện thoại, số tài khoản của các bên thì thay bằng mã như `[TEN_1]`, `[CCCD_1]` trước khi gửi, rồi đổi lại trên máy bạn khi nhận bản nháp. Bài này chỉ cách làm từng bước với một hợp đồng thuê nhà mẫu.

## Thông tin riêng nằm ở đâu trong một hợp đồng?

Một hợp đồng thông thường gom rất nhiều thông tin cá nhân vào vài chỗ quen thuộc:

- **Phần các bên** ("Bên A", "Bên B"): họ tên, ngày sinh, số CCCD, ngày cấp, nơi cấp, địa chỉ thường trú, số điện thoại, email. Với công ty là tên công ty, mã số thuế, người đại diện.
- **Điều khoản thanh toán**: số tài khoản, tên chủ tài khoản, ngân hàng.
- **Đối tượng hợp đồng**: địa chỉ căn nhà cho thuê, số giấy chứng nhận quyền sử dụng đất, biển số xe...
- **Phần cuối và ngoài nội dung**: tên người ký, người làm chứng, tên file ("HD_thue_nha_Le_Thi_Thu.docx"), ghi chú trong file Word.

Chỉ riêng phần các bên đã đủ để nhận ra chính xác một người.

## Cách 1: Nhờ AI soạn mẫu trống, tự điền sau

Nếu bạn chưa có hợp đồng, cách đơn giản nhất là đừng đưa thông tin các bên ngay từ đầu. Mô tả giao dịch bằng các con số và điều kiện, và yêu cầu AI để chỗ trống cho phần danh tính:

> Soạn hợp đồng thuê nhà ở giữa hai cá nhân. Giá thuê 7.500.000 đồng/tháng, đặt cọc 2 tháng, thời hạn 12 tháng từ ngày 01/11, thanh toán chuyển khoản trước ngày 5 hằng tháng. Bên thuê được ở tối đa 3 người, không nuôi thú cưng. Phần thông tin các bên, địa chỉ căn nhà và số tài khoản để dạng `[...]` để tôi tự điền.

AI có đủ dữ kiện để viết điều khoản; bạn tự điền phần còn lại trên máy mình.

## Cách 2: Sửa một hợp đồng đã có tên thật

Khi bạn đã có bản hợp đồng điền đủ thông tin và muốn AI rà lại hoặc viết thêm điều khoản, hãy làm trên **một bản sao** và thay danh tính bằng mã.

### Bước 1: Thay từng thông tin bằng mã có nghĩa

Giả sử phần đầu hợp đồng của bạn như sau (thông tin hư cấu):

> **BÊN CHO THUÊ (Bên A):** Ông Phạm Quốc Huy, sinh ngày 14/03/1979, CCCD số 079079012345 cấp ngày 10/05/2021 tại Cục Cảnh sát QLHC về TTXH. Thường trú: 27 Nguyễn Trãi, Phường Bến Thành, TP.HCM. Điện thoại: 0903 456 789.
>
> **BÊN THUÊ (Bên B):** Bà Lê Thị Thu, CCCD số 001185067890. Điện thoại: 0987 654 321.
>
> Bên B chuyển tiền thuê vào tài khoản số 0071 0004 56789 tại Vietcombank, chủ tài khoản Phạm Quốc Huy.

Sau khi thay:

> **BÊN CHO THUÊ (Bên A):** Ông [TEN_1], sinh ngày [NGAYSINH_1], CCCD số [CCCD_1] cấp ngày [NGAYCAP_1] tại Cục Cảnh sát QLHC về TTXH. Thường trú: [DIACHI_1]. Điện thoại: [SDT_1].
>
> **BÊN THUÊ (Bên B):** Bà [TEN_2], CCCD số [CCCD_2]. Điện thoại: [SDT_2].
>
> Bên B chuyển tiền thuê vào tài khoản số [STK_1] tại Vietcombank, chủ tài khoản [TEN_1].

Ba điều cần giữ:

1. **Cùng một người, cùng một mã.** Ông Huy là `[TEN_1]` cả ở phần các bên lẫn dòng chủ tài khoản; mã khác nhau thì AI tưởng là hai người.
2. **Mã nói rõ loại thông tin.** `[CCCD_1]`, `[STK_1]` cho AI biết đó là số gì để đặt đúng chỗ.
3. **Giữ nguyên phần nội dung.** Số tiền, thời hạn, tên ngân hàng không nhận ra được ai, và AI cần chúng để soạn đúng.

Ghi bảng đối chiếu (`[TEN_1]` = Phạm Quốc Huy...) ra một file riêng trên máy bạn, và không bao giờ dán bảng này vào AI.

### Bước 2: Soát những chỗ hay sót

Thông tin của các bên thường lặp lại ngoài phần đầu: trong điều khoản bàn giao ("căn nhà tại 27 Nguyễn Trãi..."), phụ lục, danh sách người ở cùng, đầu trang, tên file, và nhất là phần chữ ký, nơi tên được viết lại bằng chữ in hoa: "PHẠM QUỐC HUY". Chữ in hoa rất dễ lọt qua khi dò bằng mắt.

Nếu gửi cả file Word, hãy dọn ghi chú, Track Changes và thông tin tác giả bằng **File > Info > Check for Issues > Inspect Document**, cách dùng như trong bài [ẩn thông tin cá nhân trong file Excel](./an-thong-tin-ca-nhan-trong-file-excel-gui-ai).

### Bước 3: Dặn AI giữ nguyên mã

Thêm một câu vào yêu cầu để AI không tự "sửa" mã:

> Các đoạn trong ngoặc vuông như [TEN_1], [CCCD_1] là thông tin đã được thay thế. Giữ nguyên chúng, không đoán, không đổi định dạng. Hãy rà soát hợp đồng dưới đây, chỉ ra điều khoản còn thiếu về tiền cọc và chấm dứt hợp đồng trước hạn, rồi viết lại các điều đó.

### Bước 4: Đổi mã về thông tin thật

Dán bản nháp vào Word, dùng **Find and Replace** (Ctrl+H) đổi từng mã theo bảng đối chiếu, rồi tìm ký tự `[` để chắc không còn mã nào sót. Để ý cả chỗ AI viết mã khác đi, như `[Ten_1]`.

## AI soạn xong thì ký được chưa?

Chưa nên. AI có thể viết điều khoản không hợp với quy định hiện hành hoặc tình huống của bạn, nhất là với nhà đất, lao động hay vay tiền. Hãy đọc lại từng điều, và với giao dịch lớn thì nhờ luật sư xem trước khi ký.

Giữ kín thông tin các bên cũng không chỉ là thói quen tốt: [Luật Bảo vệ dữ liệu cá nhân (Luật số 91/2025/QH15)](https://hatinh.gov.vn/vi/bai-viet/luat-bao-ve-du-lieu-ca-nhan-chinh-thuc-co-hieu-luc-thi-hanh-tu-ngay-112026) có hiệu lực từ ngày 01/01/2026. Nếu bạn soạn hợp đồng cho khách hay cho công ty, hãy hỏi bộ phận pháp chế xem được đưa gì lên công cụ AI bên ngoài.

## Làm nhanh hơn với OfflineMask

Với hợp đồng nhiều trang có phụ lục, dò tay từng số CCCD, từng lần tên xuất hiện rất dễ sót. [OfflineMask](../) là ứng dụng miễn phí làm việc này ngay trên máy bạn, không cần mạng:

1. **Ẩn.** Mở file hợp đồng DOCX hoặc ODT. Ứng dụng tự tìm số CCCD, số điện thoại, số tài khoản, email, mã số thuế..., và cả họ tên, địa chỉ, tên tổ chức khi bạn cài gói tiếng Việt. Bạn xem lại, ẩn thêm chỗ còn sót, rồi xuất bản đã ẩn; định dạng của file được giữ nguyên. File PDF có chữ bên trong cũng mở được, khi đó bản đã ẩn là văn bản thuần; bản scan và hình ảnh thì chưa hỗ trợ.
2. **Hỏi AI.** Gửi bản đã ẩn cho AI bạn hay dùng. Cùng một người luôn mang cùng một mã, kiểu `[TEN_1_4e8c]`.
3. **Khôi phục.** Dán câu trả lời của AI vào lại OfflineMask, các mã tự đổi về thông tin thật. Bảng đối chiếu không rời khỏi máy bạn.

OfflineMask tìm được phần lớn thông tin riêng chứ không phải tất cả, nên hãy luôn đọc lại bản đã ẩn trước khi gửi. Nếu AI sửa mất một mã, mã đó được để nguyên để bạn tự kiểm tra. Xem cách ứng dụng xử lý dữ liệu ở trang [Quyền riêng tư](../privacy).

## Tóm lại

- AI cần điều khoản, số tiền và thời hạn để soạn hợp đồng, không cần biết các bên là ai.
- Chưa có hợp đồng: nhờ AI soạn mẫu với phần danh tính để trống, tự điền sau.
- Đã có hợp đồng: làm trên bản sao, thay họ tên, CCCD, địa chỉ, số điện thoại, số tài khoản bằng mã nhất quán, giữ bảng đối chiếu trên máy.
- Soát phần chữ ký, phụ lục, tên file; dặn AI giữ nguyên mã.
- Bản nháp của AI chưa phải bản để ký: đọc lại, và nhờ luật sư với giao dịch lớn.

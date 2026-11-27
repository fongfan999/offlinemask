---
title: Luật sư, công chứng viên dùng AI mà vẫn giữ bí mật thân chủ thế nào?
description: Chỉ đưa cho AI phần việc không cần biết thân chủ là ai. Thay họ tên, CCCD, số thửa, số vụ án bằng mã trước khi gửi, và tự kiểm tra mọi điều luật AI dẫn.
date: 2026-11-27
checked: 2026-11-27
---

Luật sư và công chứng viên vẫn dùng được ChatGPT, Claude hay Gemini mà không vi phạm nghĩa vụ giữ bí mật, nếu **chỉ đưa cho AI phần việc không cần biết thân chủ là ai**: tra cứu hướng xử lý, dựng khung văn bản, rà điều khoản, sửa câu chữ. Trước khi dán bất kỳ đoạn hồ sơ nào, hãy thay họ tên, CCCD, địa chỉ, số thửa đất, số vụ án, tên công ty và cả những tình tiết đủ để người khác đoán ra vụ việc bằng mã như `[TEN_1]`, `[THUA_1]`. Sau đó tự đối chiếu mọi điều luật AI dẫn ra với văn bản gốc. Dưới đây là lý do và cách làm từng bước.

## Luật nói gì về bí mật thông tin của thân chủ?

Hai nghề này đều có nghĩa vụ giữ bí mật được ghi thẳng trong luật:

- **Luật sư.** Điều 25 Luật Luật sư hiện hành quy định luật sư không được tiết lộ thông tin về vụ, việc, về khách hàng mà mình biết được trong khi hành nghề, trừ trường hợp khách hàng đồng ý bằng văn bản hoặc pháp luật có quy định khác. Tổ chức hành nghề cũng phải bảo đảm nhân viên của mình không tiết lộ ([bài phân tích trên báo Luật sư Việt Nam](https://lsvn.vn/trach-nhiem-giu-bi-mat-thong-tin-khach-hang-cua-luat-su-1673231959-a126999.html)). Quốc hội đã thông qua Luật Luật sư (sửa đổi) ngày 20/11/2026, [có hiệu lực từ ngày 01/3/2027](https://daibieunhandan.vn/quoc-hoi-thong-qua-luat-luat-su-sua-doi-luat-nuoi-con-nuoi-sua-doi-va-luat-van-ban-quy-pham-phap-luat-sua-doi-10444282.html); từ ngày đó, bạn nên tra lại điều khoản tương ứng trong luật mới.
- **Công chứng viên.** Điểm e khoản 2 Điều 18 [Luật Công chứng](https://datafiles.chinhphu.vn/cpp/files/vbpq/2026/3/50-vbhn-vpqh.pdf) (Luật số 46/2024/QH15) buộc công chứng viên "giữ bí mật về nội dung công chứng, trừ trường hợp được người yêu cầu công chứng đồng ý bằng văn bản hoặc pháp luật có quy định khác". Khoản 11 Điều 36 đặt nghĩa vụ tương tự cho tổ chức hành nghề công chứng.

Ngoài ra, họ tên, CCCD, địa chỉ của thân chủ và các bên là dữ liệu cá nhân theo [Luật Bảo vệ dữ liệu cá nhân](https://congbao.chinhphu.vn/van-ban/luat-so-91-2025-qh15-45578.htm) (Luật số 91/2025/QH15). Bài [Luật Bảo vệ dữ liệu cá nhân nói gì về việc dùng AI ở công ty](./luat-bao-ve-du-lieu-ca-nhan-dung-ai-cong-ty) nói kỹ hơn phần này.

## Dán hồ sơ vào AI có bị coi là "tiết lộ" không?

Luật không nhắc riêng đến AI, và bài này không thay được ý kiến của đoàn luật sư hay hội công chứng nơi bạn sinh hoạt. Nhưng về thực tế, khi bạn dán hồ sơ vào một công cụ AI trên mạng, thông tin đó đã rời khỏi văn phòng và nằm trên máy chủ của một công ty khác. Tùy loại tài khoản và cài đặt, cuộc trò chuyện có thể được lưu lại, thậm chí được dùng để cải thiện mô hình (xem bài [ChatGPT có dùng dữ liệu của tôi để huấn luyện không?](./chatgpt-co-dung-du-lieu-de-huan-luyen-khong)).

Cách nghĩ an toàn nhất: **coi việc dán vào AI như đưa hồ sơ cho một người ngoài đọc**. Nếu bạn không đưa bản đó cho người ngoài, thì cũng đừng dán nó vào AI. Bản đã bỏ hết dấu vết nhận ra thân chủ thì khác: người đọc không biết đang nói về ai.

## Thông tin nào trong hồ sơ nhận ra được thân chủ?

Họ tên và CCCD thì ai cũng nghĩ tới. Hồ sơ pháp lý còn nhiều chỗ khác dễ sót:

- **Danh tính trực tiếp:** họ tên, ngày sinh, CCCD, hộ chiếu, mã số thuế, số điện thoại, email, địa chỉ thường trú.
- **Tài sản:** số thửa, số tờ bản đồ, số giấy chứng nhận quyền sử dụng đất, địa chỉ căn nhà, biển số xe, số tài khoản.
- **Số hiệu của vụ việc:** số thụ lý, số bản án, tên tòa kèm ngày xét xử, số công chứng, số hợp đồng.
- **Tổ chức:** tên công ty, chi nhánh, nhất là công ty nhỏ ở một địa phương.
- **Tình tiết hiếm:** "giám đốc một xưởng gỗ ở Đông Anh ly hôn năm 2026, có hai con sinh đôi" không có tên ai, nhưng người trong vùng đọc là biết.

Phần cuối cùng là phần chỉ người làm nghề mới đánh giá được, vì không công cụ nào biết vụ việc của bạn nổi tiếng đến đâu.

## Cách làm từng bước

### Bước 1: Viết ra câu hỏi trước khi chọn tài liệu

Nhiều việc không cần dán hồ sơ chút nào: "Tranh chấp di sản thừa kế là quyền sử dụng đất, một người thừa kế đang ở nước ngoài, cần lưu ý gì về thủ tục?" AI trả lời được mà không cần biết gia đình nào. Chỉ dán tài liệu khi câu hỏi thật sự cần đến câu chữ của tài liệu đó.

### Bước 2: Làm trên bản sao và thay bằng mã nhất quán

Giả sử bạn cần AI rà một đoạn đơn khởi kiện (thông tin hư cấu):

> Nguyên đơn: bà Trần Thị Hồng Nhung, sinh năm 1968, CCCD 001168034567, trú tại số 12 ngõ 45 Thụy Khuê, Tây Hồ, Hà Nội. Bị đơn: ông Trần Văn Tùng. Di sản là quyền sử dụng thửa đất số 215, tờ bản đồ số 9, giấy chứng nhận số CS 04512.

Sau khi thay:

> Nguyên đơn: bà [TEN_1], sinh năm [NAM_1], CCCD [CCCD_1], trú tại [DIACHI_1]. Bị đơn: ông [TEN_2]. Di sản là quyền sử dụng thửa đất số [THUA_1], tờ bản đồ số [TO_1], giấy chứng nhận số [GCN_1].

Ba điều cần giữ:

1. **Cùng một người, cùng một mã** ở mọi chỗ trong tài liệu, kể cả phần chữ ký viết in hoa.
2. **Giữ quan hệ cần cho lập luận.** Nếu việc hai bên là anh em quan trọng, ghi "[TEN_2] là em ruột [TEN_1]". Họ "Trần" chung thì bỏ, vì AI không cần nó.
3. **Giữ bảng đối chiếu ở file riêng trên máy**, không bao giờ dán bảng này vào AI.

### Bước 3: Câu lệnh rõ ràng

> Đây là đoạn đơn khởi kiện đã thay thông tin bằng mã. Giữ nguyên các mã trong ngoặc vuông. Chỉ ra chỗ trình bày chưa rõ yêu cầu khởi kiện và gợi ý cách viết lại. Khi dẫn điều luật, ghi rõ tên văn bản, số hiệu và điều khoản để tôi đối chiếu.

### Bước 4: Điền lại và kiểm tra

Nhận bản trả lời, đổi mã về thông tin thật trên máy bạn, rồi đọc lại như đọc bản nháp của một thực tập sinh.

## Đừng tin ngay điều luật AI dẫn

AI có thể dẫn văn bản đã hết hiệu lực, nhầm số điều, hoặc bịa ra một điều khoản nghe rất hợp lý. Rủi ro này đặc biệt lớn lúc luật đang thay đổi: Luật Công chứng 2024 đã thay luật năm 2014 từ ngày 01/7/2025, và Luật Luật sư sửa đổi sẽ có hiệu lực từ ngày 01/3/2027. Hãy:

- Mở văn bản gốc cho từng điều luật AI dẫn, xem còn hiệu lực không.
- Không chép nguyên văn lập luận của AI vào văn bản gửi tòa hay gửi khách mà chưa đọc lại.
- Với công chứng viên: nhờ AI dựng khung hợp đồng trống để tự điền, thay vì gửi hồ sơ có giấy tờ tùy thân của người yêu cầu công chứng. Bài [nhờ AI soạn hợp đồng mà không lộ tên, CCCD](./nho-ai-soan-hop-dong-khong-lo-ten-cccd) có ví dụ chi tiết.

## Làm nhanh hơn với OfflineMask

Thay mã bằng tay cho từng hồ sơ dài rất tốn thời gian. [OfflineMask](../) là ứng dụng miễn phí làm việc này ngay trên máy bạn, không cần mạng:

1. **Ẩn.** Dán văn bản hoặc mở tệp DOCX, ODT, PDF, kể cả PDF scan. Ứng dụng tự tìm CCCD, hộ chiếu, mã số thuế, số tài khoản, số điện thoại, email; cài thêm gói tiếng Việt thì nhận ra cả họ tên, địa chỉ, tổ chức. Bạn xem lại và bôi đen để ẩn thêm những gì còn sót, như số thửa hay số vụ án.
2. **Hỏi AI.** Dán bản đã ẩn vào AI bạn hay dùng.
3. **Khôi phục.** Dán câu trả lời vào lại OfflineMask, các mã đổi về thông tin thật. Bảng đối chiếu không rời khỏi máy bạn.

Nói rõ giới hạn: OfflineMask tìm được phần lớn thông tin cá nhân chứ không phải tất cả, và nó không biết tình tiết nào của vụ việc là đủ để người ngoài đoán ra thân chủ. Bước xem lại trước khi gửi vẫn là việc của bạn. Cách ứng dụng xử lý dữ liệu có ở trang [Quyền riêng tư](../privacy).

## Tóm lại

- Luật sư (Điều 25 Luật Luật sư) và công chứng viên (Điều 18 Luật Công chứng) đều phải giữ bí mật thông tin thân chủ, trừ khi được đồng ý bằng văn bản hoặc luật quy định khác.
- Coi việc dán vào AI như đưa hồ sơ cho người ngoài đọc.
- Nhiều câu hỏi không cần hồ sơ; khi cần, làm trên bản sao và thay danh tính, tài sản, số hiệu vụ việc bằng mã nhất quán.
- Tự xem lại những tình tiết hiếm có thể làm lộ thân chủ.
- Đối chiếu mọi điều luật AI dẫn với văn bản gốc còn hiệu lực.

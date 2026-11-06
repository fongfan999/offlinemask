---
title: Ẩn danh dữ liệu và mã hóa giả danh khác nhau thế nào?
description: Ẩn danh là xóa hẳn dấu vết để không ai nhận ra người đó nữa. Mã hóa giả danh là thay tên bằng mã, vẫn đổi ngược được, nên dữ liệu vẫn là dữ liệu cá nhân.
date: 2026-11-06
---

Khác nhau ở chỗ **có quay lại được hay không**. Ẩn danh dữ liệu (anonymization) là thay đổi hoặc xóa thông tin đến mức không ai, kể cả bạn, còn nhận ra đó là người nào. Mã hóa giả danh (pseudonymization) là thay họ tên, số điện thoại... bằng mã như `[TEN_1]`, trong khi bảng đối chiếu mã nào là ai vẫn được giữ ở một chỗ riêng, nên lúc cần vẫn đổi ngược được. Vì vậy dữ liệu đã giả danh thường vẫn bị coi là dữ liệu cá nhân, còn dữ liệu đã ẩn danh thật sự thì không. Bài này giải thích từng khái niệm bằng ví dụ, rồi chỉ ra nên dùng cách nào khi nhờ AI.

Bài viết chỉ để tham khảo, không phải tư vấn pháp lý. Với trường hợp cụ thể, hãy hỏi bộ phận pháp chế hoặc luật sư.

## Ẩn danh dữ liệu là gì?

Ẩn danh là làm cho dữ liệu không còn gắn được với một người cụ thể, và không giữ lại cách nào để gắn lại. Thường người ta làm bằng cách xóa hẳn các cột nhận ra người, gộp số liệu lại, hoặc làm tròn, làm mờ những chi tiết quá riêng.

Ví dụ, một cửa hàng có danh sách khiếu nại (thông tin hư cấu):

> Nguyễn Minh Anh, 0901 234 567, quận Cầu Giấy, Hà Nội, giao chậm 3 ngày.
>
> Lê Quốc Bảo, 0912 345 678, quận 7, TP.HCM, hàng bị móp.

Bản ẩn danh có thể chỉ còn:

> Tháng 10: 12 khiếu nại ở Hà Nội, 9 ở TP.HCM. Giao chậm chiếm 14 trường hợp, hàng hư hỏng 7 trường hợp.

Từ bản này, không ai biết khách nào đã khiếu nại. Đổi lại, bạn cũng không thể dùng nó để viết thư trả lời riêng cho chị Minh Anh nữa. Ẩn danh hợp với báo cáo, thống kê, chia sẻ số liệu ra ngoài, không hợp với việc cần biết "ai".

## Mã hóa giả danh là gì?

Mã hóa giả danh là thay những gì nhận ra một người bằng một mã, rồi cất bảng đối chiếu ở chỗ khác. Dữ liệu vẫn giữ nguyên cấu trúc và nội dung công việc, chỉ thiếu danh tính:

> [TEN_1], [SDT_1], quận Cầu Giấy, Hà Nội, giao chậm 3 ngày.
>
> [TEN_2], [SDT_2], quận 7, TP.HCM, hàng bị móp.

Bảng đối chiếu nằm riêng:

| Mã | Thông tin thật |
| --- | --- |
| [TEN_1] | Nguyễn Minh Anh |
| [SDT_1] | 0901 234 567 |
| [TEN_2] | Lê Quốc Bảo |
| [SDT_2] | 0912 345 678 |

Ai chỉ có bản đã thay mã thì không biết [TEN_1] là ai. Còn bạn, người giữ bảng đối chiếu, đổi ngược lúc nào cũng được.

Lưu ý một chỗ dễ nhầm: "mã hóa" trong "mã hóa giả danh" là **thay bằng mã**, không phải mã hóa bằng mật khẩu (encryption). Dữ liệu được mã hóa bằng mật khẩu thì trông như một chuỗi ký tự vô nghĩa và phải có khóa mới đọc được. Dữ liệu giả danh thì ai cũng đọc được, chỉ không biết đang nói về ai.

## Khác nhau ở những điểm nào?

- **Đổi ngược được không?** Ẩn danh: không. Giả danh: có, nếu có bảng đối chiếu.
- **Còn là dữ liệu cá nhân không?** Ẩn danh thật sự: không. Giả danh: thường vẫn là, vì vẫn còn đường gắn lại với người thật.
- **Còn dùng cho từng người được không?** Ẩn danh: không, chỉ còn số liệu chung. Giả danh: được, mỗi người vẫn là một dòng riêng với một mã riêng.
- **Rủi ro chính là gì?** Ẩn danh: làm chưa tới, vẫn đoán ra người. Giả danh: lộ bảng đối chiếu, hoặc nội dung còn chi tiết đủ để đoán ra người.

## Luật nói gì về hai khái niệm này?

Ở Việt Nam, [Luật Bảo vệ dữ liệu cá nhân](https://congbao.chinhphu.vn/van-ban/luat-so-91-2025-qh15-45578.htm) (Luật số 91/2025/QH15, hiệu lực từ 01/01/2026) dùng từ **khử nhận dạng**. Khoản 11 Điều 2 định nghĩa đó là "quá trình thay đổi hoặc xóa thông tin để tạo ra dữ liệu mới không thể xác định hoặc không thể giúp xác định được một con người cụ thể", và khoản 1 cùng điều nói "dữ liệu cá nhân sau khi khử nhận dạng không còn là dữ liệu cá nhân". Phần giải thích từ ngữ của luật không có mục riêng cho mã hóa giả danh.

Mấu chốt nằm ở chữ "không thể". Nếu công ty bạn vẫn giữ bảng đối chiếu và đổi mã về tên thật được, thì công ty vẫn xác định được người đó. Vì vậy thay tên bằng mã chưa chắc đã được coi là khử nhận dạng theo nghĩa của luật, như bài [Luật Bảo vệ dữ liệu cá nhân nói gì về việc dùng AI ở công ty](./luat-bao-ve-du-lieu-ca-nhan-dung-ai-cong-ty) đã lưu ý.

Quy định bảo vệ dữ liệu chung của châu Âu ([GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj)) nói thẳng hơn. Điều 4 khoản 5 định nghĩa giả danh là xử lý dữ liệu sao cho không còn gắn được với một người cụ thể nếu không dùng thêm thông tin bổ sung, và thông tin bổ sung đó phải được cất riêng, có biện pháp bảo vệ. Đoạn mở đầu 26 nói dữ liệu đã giả danh, mà gắn lại được với người thật nhờ thông tin bổ sung, thì nên được coi là thông tin về một người xác định được; còn các nguyên tắc bảo vệ dữ liệu không áp dụng cho thông tin ẩn danh.

Hai bộ luật dùng chữ khác nhau, nhưng ý chung giống nhau: **còn đường quay lại người thật thì vẫn phải cẩn thận như với dữ liệu cá nhân**.

## Thay tên bằng mã đã đủ an toàn chưa?

Chưa chắc. Ngoài họ tên và số điện thoại, nhiều chi tiết khác gộp lại cũng đủ để đoán ra một người. Ví dụ:

> [TEN_1], trưởng phòng kế toán chi nhánh Đà Nẵng, 52 tuổi, vừa nghỉ thai sản về.

Tên đã thay, nhưng ở một công ty vừa phải, chức danh cộng với chi nhánh, tuổi và chuyện riêng là đủ để đồng nghiệp biết ngay đó là ai. Trước khi gửi, hãy tự hỏi: một người trong ngành đọc đoạn này có đoán ra được không? Nếu có, hãy bỏ hoặc nói chung đi những chi tiết AI không cần, như "một trưởng bộ phận" thay cho chức danh và chi nhánh cụ thể.

## Khi nhờ AI, nên chọn cách nào?

Tùy việc bạn cần AI làm:

1. **Cần số liệu chung** (báo cáo tháng, xu hướng khiếu nại, so sánh doanh thu theo vùng): ẩn danh. Gộp số liệu trước, gửi AI bảng tổng hợp, không gửi danh sách từng người.
2. **Cần làm việc với từng người** (soạn thư trả lời khách, viết nhận xét nhân viên, sửa hợp đồng): giả danh. AI cần biết có một người với hoàn cảnh cụ thể, không cần biết tên thật. Bạn nhận câu trả lời có mã, rồi đổi mã về tên thật trên máy mình.
3. **Dù chọn cách nào**: giữ bảng đối chiếu trên máy bạn, không dán nó vào AI; cùng một người luôn dùng cùng một mã; bỏ những chi tiết đủ để đoán ra người; và đọc lại trước khi gửi.

Bài [có nên dán thông tin khách hàng vào ChatGPT](./co-nen-dan-thong-tin-khach-hang-vao-chatgpt) có thêm mẹo đặt mã khi làm thủ công.

## OfflineMask thuộc loại nào?

[OfflineMask](../) làm **mã hóa giả danh**, ngay trên máy tính của bạn. Ứng dụng tự tìm email, số điện thoại, số tài khoản, số thẻ, CCCD, hộ chiếu, mã số thuế, mật khẩu, và cả họ tên, địa chỉ, tên tổ chức khi bạn cài gói tiếng Việt, rồi thay bằng mã như `[SDT_1_4e8c]`. Bạn xem lại, ẩn thêm chỗ còn sót, dán bản đã ẩn vào AI, rồi dán câu trả lời vào lại để các mã tự đổi về thông tin thật.

Bảng đối chiếu ở lại trên máy bạn và không bao giờ được gửi đi; ứng dụng chạy cả khi không có mạng. Chi tiết lưu gì, ở đâu có ở trang [Quyền riêng tư](../privacy).

Cần nói rõ: vì giữ bảng đối chiếu để đổi ngược, đây không phải ẩn danh. OfflineMask tìm được phần lớn chứ không phải mọi thông tin nhận ra một người, và không tự viết lại những chi tiết như chức danh hay hoàn cảnh riêng, nên hãy luôn đọc lại bản đã ẩn trước khi gửi.

## Tóm lại

- Ẩn danh: xóa hoặc gộp dữ liệu đến mức không ai nhận ra người nào, không quay lại được.
- Mã hóa giả danh: thay danh tính bằng mã, giữ bảng đối chiếu riêng, đổi ngược được.
- Theo Luật Bảo vệ dữ liệu cá nhân, chỉ dữ liệu không thể xác định được người cụ thể mới không còn là dữ liệu cá nhân; dữ liệu giả danh thường vẫn là.
- Nhờ AI làm số liệu chung thì ẩn danh; làm việc với từng người thì giả danh, giữ bảng đối chiếu trên máy bạn.
- Thay mã rồi vẫn phải đọc lại, bỏ những chi tiết đủ để đoán ra người.

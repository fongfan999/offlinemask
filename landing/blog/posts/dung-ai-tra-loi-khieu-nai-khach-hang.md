---
title: Dùng AI trả lời khiếu nại khách hàng mà không lộ số điện thoại
description: AI cần biết khách gặp chuyện gì để soạn thư trả lời, không cần số điện thoại hay địa chỉ. Thay chúng bằng mã trước khi dán, rồi đổi lại trên máy bạn.
date: 2026-11-04
---

Bạn vẫn nhờ ChatGPT, Claude hay Gemini tóm tắt và soạn thư trả lời khiếu nại được, mà không đưa số điện thoại của khách. Để viết một lời xin lỗi đúng mực, AI chỉ cần biết **khách gặp chuyện gì, đã chờ bao lâu và công ty đề nghị gì**. Số điện thoại, họ tên, địa chỉ giao hàng, email thì thay bằng mã như `[SDT_1]`, `[TEN_1]` trước khi dán, rồi đổi lại trên máy bạn khi nhận bản nháp. Cái khó là số điện thoại trong khiếu nại hay nằm ở những chỗ không ngờ. Bài này chỉ ra những chỗ đó và cách làm từng bước.

## Vì sao khiếu nại dễ lộ thông tin hơn bạn nghĩ?

Một khiếu nại hiếm khi là một câu gọn gàng. Nó thường là cả một đoạn chat dán từ Zalo hay Messenger, một email có chữ ký, hoặc một phiếu trong phần mềm chăm sóc khách hàng. Trong đó, số điện thoại có thể xuất hiện:

- **Ở chữ ký email** hoặc dòng cuối tin nhắn: "Có gì gọi em 0901 234 567".
- **Trong lúc khách bực**, viết liền hoặc chèn dấu chấm, dấu cách: "0901.234.567", "+84 901 234 567", "sdt 0901234567 nhé".
- **Ở phần đầu đoạn chat** khi bạn sao chép cả cuộc trò chuyện, cùng tên tài khoản của khách.
- **Trong thông tin giao hàng** đi kèm địa chỉ: "Giao 12 Lê Lợi, P. Bến Thành, người nhận chị Hà 0912 345 678".
- **Trong ảnh chụp màn hình** đơn hàng hay tin nhắn mà khách gửi kèm.

Theo [Nghị định 356/2025/NĐ-CP](https://pbgdpl.cantho.gov.vn/quy-dinh-ve-danh-muc-du-lieu-ca-nhan-co-ban-va-danh-muc-du-lieu-ca-nhan-nhay-cam) hướng dẫn Luật Bảo vệ dữ liệu cá nhân (cùng có hiệu lực từ ngày 01/01/2026), họ tên, số điện thoại, nơi ở và địa chỉ liên hệ đều là **dữ liệu cá nhân cơ bản**. Khách đưa số điện thoại để được giao hàng và được gọi lại, không phải để số đó nằm trong lịch sử trò chuyện của một dịch vụ AI.

## AI cần gì để soạn thư trả lời khiếu nại?

Trước khi dán, hãy chia nội dung khiếu nại thành ba nhóm:

| Nhóm | Ví dụ | Làm gì |
|---|---|---|
| Nhận ra khách | Họ tên, số điện thoại, email, địa chỉ, tên tài khoản Zalo, Facebook | Thay bằng mã |
| Nội dung sự việc | Sản phẩm, lỗi gặp phải, số ngày giao chậm, số tiền, khách muốn gì | Giữ nguyên |
| Chuyện riêng không liên quan | "Mua cho mẹ đang nằm viện", "con tôi bị dị ứng" | Viết lại chung chung nếu AI không cần |

Nhóm thứ hai là thứ AI cần để viết đúng. Nhóm thứ ba dễ bị bỏ qua nhất, vì nó nằm trong câu chữ chứ không phải một dãy số để dò.

## Ví dụ: từ tin nhắn khách đến thư trả lời

Giả sử khách gửi qua Zalo đoạn sau (thông tin hư cấu):

> Shop ơi tôi là Trần Thu Hà, đặt nồi chiên ngày 25/10, mã đơn DH-1025-0417, đến nay đã 9 ngày chưa nhận được. Gọi hotline 3 lần không ai nghe. Tôi cần hàng trước thứ 7 để biếu bố mẹ, không được thì hoàn tiền 1.290.000 cho tôi. SĐT tôi 0912.345.678, giao 45 Trần Phú, Hà Đông, Hà Nội.

### Bước 1: Thay danh tính bằng mã

Bản gửi AI:

> Khách [TEN_1], đặt nồi chiên ngày 25/10, mã đơn [MA_1], đến nay đã 9 ngày chưa nhận được. Gọi hotline 3 lần không ai nghe. Khách cần hàng trước thứ 7 để làm quà, không được thì yêu cầu hoàn tiền 1.290.000 đồng. SĐT [SDT_1], giao tới [DIACHI_1].

Đã làm ba việc:

1. **Thay họ tên, số điện thoại, địa chỉ bằng mã.** Mã có tên loại (`SDT`, `DIACHI`) để AI biết đó là gì và đặt đúng chỗ trong thư.
2. **Thay luôn mã đơn hàng.** Mã đơn không phải số điện thoại, nhưng ai có quyền tra hệ thống đều tìm ra khách từ nó. AI không cần mã thật để xin lỗi.
3. **Giữ nguyên sự việc**: 9 ngày, 3 cuộc gọi, hạn thứ 7, số tiền. Đó là những gì làm cho thư trả lời đúng và có tâm.

Ghi bảng đối chiếu (`[TEN_1]` = Trần Thu Hà, `[SDT_1]` = 0912 345 678...) ra chỗ riêng trên máy, không dán vào AI.

### Bước 2: Viết yêu cầu rõ ràng cho AI

> Bạn là nhân viên chăm sóc khách hàng của một cửa hàng đồ gia dụng. Hãy viết tin nhắn Zalo trả lời khiếu nại dưới đây: xin lỗi chân thành, không đổ lỗi cho đơn vị vận chuyển, đưa ra hai lựa chọn (giao hỏa tốc trước thứ 7 miễn phí, hoặc hoàn tiền trong 24 giờ), dưới 120 chữ, xưng "shop", gọi khách là "chị". Các đoạn trong ngoặc vuông là thông tin đã được thay thế, giữ nguyên, không đoán.
>
> (dán bản đã thay mã ở trên)

Câu cuối rất quan trọng: không có nó, AI đôi khi tự bịa ra một cái tên hay bỏ mất mã.

### Bước 3: Đổi mã về thông tin thật, đọc lại rồi mới gửi

AI sẽ trả lời kiểu "Shop chào chị [TEN_1], shop thành thật xin lỗi vì đơn [MA_1] đến nay vẫn chưa tới tay chị...". Bạn đổi từng mã theo bảng đối chiếu, rồi tìm ký tự `[` để chắc không sót mã nào. Đọc lại một lượt: lời hứa trong thư (hoàn tiền trong 24 giờ, giao trước thứ 7) phải là điều công ty bạn thật sự làm được. AI viết rất trôi chảy, kể cả những lời hứa bạn không có quyền đưa ra.

## Còn khi phải tổng hợp hàng trăm khiếu nại?

Cuối tháng, nhiều nhóm chăm sóc khách hàng muốn nhờ AI phân loại khiếu nại theo nguyên nhân hay tìm vấn đề lặp lại. Khi đó bạn thường xuất một file CSV hay Excel từ phần mềm quản lý. Hãy làm trên bản sao:

- **Xóa hẳn** cột số điện thoại, email, địa chỉ nếu câu hỏi không cần đến chúng.
- **Thay cột họ tên bằng mã nhất quán** nếu bạn cần biết khách nào khiếu nại nhiều lần.
- **Giữ cột nội dung**, nhưng nhớ rằng đây là cột chữ tự do, nơi khách hay tự gõ số điện thoại vào. Phải dò cả cột này, không chỉ cột "SĐT".

Cách thay cả cột bằng mã trong Excel có trong bài [ẩn thông tin cá nhân trong file Excel](./an-thong-tin-ca-nhan-trong-file-excel-gui-ai).

## Mẹo dò số điện thoại khi làm bằng tay

1. **Tìm theo đầu số, không theo cả số.** Dùng Find (Ctrl+F) với "09", "03", "07", "08", "+84", "84" để bắt cả số viết liền, có dấu chấm hay dấu cách.
2. **Soát đầu và cuối đoạn chat.** Tên tài khoản, chữ ký và câu "gọi em số..." thường nằm ở đó.
3. **Đừng dán ảnh chụp màn hình thẳng vào AI.** Ảnh đơn hàng hay ảnh chat thường có số điện thoại, địa chỉ của khách. Hãy gõ lại phần cần thiết thành chữ.
4. **Dùng tài khoản AI công ty cấp** nếu có. Nếu bạn dùng ChatGPT cá nhân, đọc [ChatGPT có dùng dữ liệu của tôi để huấn luyện không?](./chatgpt-co-dung-du-lieu-de-huan-luyen-khong) để tắt đúng chỗ.

## Làm nhanh hơn với OfflineMask

Mỗi ngày trả lời vài chục khiếu nại, dò tay từng số rất dễ sót. [OfflineMask](../) là ứng dụng miễn phí làm việc này ngay trên máy bạn, không cần mạng:

1. **Ẩn.** Dán đoạn chat hay email khiếu nại vào. Ứng dụng tự tìm số điện thoại, email, số tài khoản, số thẻ, CCCD..., và cả họ tên, địa chỉ khi bạn cài gói tiếng Việt. Bạn xem lại, bôi đen để ẩn thêm chỗ còn sót như mã đơn hàng, rồi sao chép bản đã ẩn. File CSV, Excel xuất từ phần mềm quản lý cũng mở được, giữ nguyên định dạng. Ảnh chụp màn hình (PNG, JPG) và PDF scan được đọc chữ ngay trên máy; bản đã ẩn khi đó chỉ có chữ, không có ảnh.
2. **Hỏi AI.** Dán bản đã ẩn vào AI bạn hay dùng. Cùng một khách luôn mang cùng một mã, kiểu `[SDT_1_4e8c]`.
3. **Khôi phục.** Dán thư trả lời của AI vào lại OfflineMask, các mã tự đổi về thông tin thật. Bảng đối chiếu không rời khỏi máy bạn.

Trên macOS và Windows còn có Ẩn nhanh: bôi đen tin nhắn ngay trong ứng dụng bạn đang dùng rồi bấm nút OfflineMask hoặc phím tắt để ẩn và khôi phục tại chỗ, khỏi chuyển qua lại.

OfflineMask tìm được phần lớn thông tin riêng chứ không phải tất cả, và không viết lại câu chữ thay bạn: chuyện riêng của khách vẫn còn nguyên trong bản đã ẩn. Nếu AI sửa mất một mã, mã đó được để nguyên để bạn tự kiểm tra. Hãy luôn đọc lại trước khi gửi. Xem cách ứng dụng xử lý dữ liệu ở trang [Quyền riêng tư](../privacy).

## Tóm lại

- AI cần sự việc, thời gian và đề nghị của công ty để soạn thư trả lời khiếu nại; không cần số điện thoại, họ tên hay địa chỉ của khách.
- Thay chúng bằng mã có tên loại như `[SDT_1]`, `[TEN_1]`, thay cả mã đơn hàng, và dặn AI giữ nguyên mã.
- Số điện thoại hay nằm ở chữ ký, đầu đoạn chat, thông tin giao hàng, cột nội dung và ảnh chụp màn hình: dò kỹ những chỗ đó.
- Đổi mã về thông tin thật trên máy bạn, và đọc lại lời hứa trong thư trước khi gửi khách.

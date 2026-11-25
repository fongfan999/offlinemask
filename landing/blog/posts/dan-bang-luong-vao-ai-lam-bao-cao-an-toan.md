---
title: Dán bảng lương vào AI để làm báo cáo: rủi ro và cách làm an toàn
description: Đừng dán nguyên bảng lương. Tổng hợp theo phòng ban trên máy rồi chỉ gửi bảng tổng; nếu AI cần từng dòng, bỏ họ tên, CCCD, số tài khoản và thay bằng mã.
date: 2026-11-25
checked: 2026-11-25
---

Muốn nhờ ChatGPT, Claude hay Gemini viết báo cáo lương, bạn **không cần dán nguyên bảng lương**. Phần lớn báo cáo chỉ cần số đã tổng hợp: tổng quỹ lương theo phòng ban, số người, mức tăng so với tháng trước. Hãy tổng hợp bằng PivotTable ngay trên máy, rồi chỉ gửi bảng tổng đó cho AI viết nhận xét. Khi AI thật sự cần từng dòng, làm trên bản sao: xóa họ tên, CCCD, mã số thuế, số tài khoản, ghi chú; thay bằng mã nhân viên nhất quán; giữ nguyên các con số. Và luôn kiểm tra lại số liệu trên Excel, vì AI có thể tính sai. Dưới đây là cách làm từng bước.

## Dán nguyên bảng lương vào AI có gì đáng lo?

Một bảng lương gom trong cùng một file gần như mọi thứ về từng nhân viên: họ tên, CCCD, mã số thuế, số tài khoản, mức lương, phụ cấp, khoản khấu trừ, người phụ thuộc. Theo [Luật Bảo vệ dữ liệu cá nhân](https://congbao.chinhphu.vn/van-ban/luat-so-91-2025-qh15-45578.htm) (Luật số 91/2025/QH15, hiệu lực từ ngày 01/01/2026), dữ liệu cá nhân là "dữ liệu số hoặc thông tin dưới dạng khác xác định hoặc giúp xác định một con người cụ thể". Mức lương nằm cạnh một cái tên là dữ liệu cá nhân của người đó.

Ba rủi ro thực tế:

- **Lộ một lần là lộ cả công ty.** Một đoạn chat bị đọc trộm, một tài khoản AI dùng chung, một ảnh chụp màn hình gửi nhầm nhóm: thứ lọt ra là lương của tất cả mọi người, không phải một người.
- **Lương là chuyện tế nhị trong nội bộ.** Nhiều công ty coi bảng lương là thông tin mật, chỉ vài người được xem. Dán nó vào một dịch vụ bên ngoài có thể đã vượt quy định của chính công ty bạn.
- **Dữ liệu ở lại phía nhà cung cấp.** Tùy loại tài khoản và cài đặt, cuộc trò chuyện có thể được lưu, thậm chí được dùng để cải thiện mô hình. Bài [ChatGPT có dùng dữ liệu của tôi để huấn luyện không?](./chatgpt-co-dung-du-lieu-de-huan-luyen-khong) chỉ chỗ tắt.

Tin tốt là để viết một báo cáo lương, AI hầu như không cần biết ai nhận bao nhiêu.

## Báo cáo lương thật ra cần những gì?

Hãy viết ra câu bạn định hỏi trước. Những yêu cầu hay gặp:

- "Tóm tắt quỹ lương tháng 10 theo phòng ban, so với tháng 9."
- "Phòng nào có chi phí làm thêm giờ tăng mạnh nhất? Gợi ý nguyên nhân cần kiểm tra."
- "Viết đoạn nhận xét ngắn cho báo cáo gửi ban giám đốc."

Cả ba đều trả lời được bằng **số đã cộng theo nhóm**. Không câu nào cần họ tên hay số tài khoản.

## Cách 1: Tổng hợp trên máy, chỉ gửi bảng tổng

Đây là cách an toàn nhất, vì thông tin từng người không rời khỏi máy bạn.

1. Mở bảng lương, chọn một ô bất kỳ trong bảng, vào **Insert > PivotTable** (Chèn > PivotTable) và đặt PivotTable ở trang tính mới.
2. Kéo cột "Phòng ban" vào **Rows**.
3. Kéo "Tổng thu nhập", "Làm thêm giờ" vào **Values** (mặc định là Sum, tức tính tổng).
4. Kéo cột "Mã NV" vào **Values** một lần nữa và đổi sang **Count** để đếm số người.
5. Chép PivotTable sang một trang tính mới bằng **Paste Values** (Dán giá trị), để bảng gửi đi chỉ còn số, không còn liên kết về dữ liệu gốc.

Kết quả trông như sau (số liệu hư cấu, đơn vị triệu đồng):

| Phòng ban | Số người | Tổng thu nhập T9 | Tổng thu nhập T10 | Làm thêm giờ T10 |
|---|---|---|---|---|
| Kinh doanh | 12 | 254,0 | 268,5 | 9,2 |
| Kho vận | 8 | 121,6 | 139,4 | 21,8 |
| Kế toán | 4 | 72,0 | 72,0 | 0,0 |
| Khác | 3 | 66,0 | 66,0 | 0,0 |

Câu lệnh gửi kèm:

> Đây là bảng tổng hợp quỹ lương theo phòng ban, đơn vị triệu đồng. Viết đoạn nhận xét khoảng 150 chữ cho báo cáo gửi ban giám đốc: tổng quỹ lương thay đổi thế nào, phòng nào tăng nhiều nhất và vì sao có thể như vậy, cần kiểm tra thêm điều gì. Không tự tính lại các con số đã có.

### Cẩn thận với nhóm quá nhỏ

Bảng tổng cũng có thể lộ lương của một người. Nếu phòng Pháp chế chỉ có một nhân viên, dòng "Pháp chế: 1 người, 35 triệu" chính là lương của người đó, và ai trong công ty cũng biết đó là ai. Luật nói đến cả thông tin "giúp xác định" một người, không chỉ họ tên.

Cách xử lý: gộp những nhóm chỉ có một vài người vào dòng "Khác", như ví dụ trên, hoặc chỉ gửi tổng toàn công ty cho phần đó. Cũng đừng chia nhỏ quá mức kiểu "phòng ban + chức danh + thâm niên", vì càng chia nhỏ, mỗi ô càng dễ chỉ còn một người.

## Cách 2: Khi AI cần xem từng dòng

Có lúc bạn cần AI soi từng người, ví dụ tìm những dòng có thu nhập tăng bất thường so với tháng trước. Khi đó, làm trên **một bản sao** của file:

1. **Xóa hẳn** các cột họ tên, CCCD, mã số thuế, số tài khoản, số điện thoại, người phụ thuộc, ghi chú. Xóa chứ không ẩn: cột bị ẩn vẫn nằm trong file.
2. **Thay mã nhân viên nội bộ bằng mã mới** như `NV_01`, `NV_02`, giữ bảng đối chiếu ở file riêng trên máy. Mã nội bộ cũ có thể tra ngược trong phần mềm nhân sự.
3. **Viết chung hơn những cột dễ nhận ra người**: "Trưởng phòng Kế toán" thành "Quản lý", ngày vào làm thành số năm thâm niên.
4. **Giữ nguyên các cột số**: lương cơ bản, phụ cấp, làm thêm giờ, khấu trừ.

Bản gửi đi:

| Mã | Nhóm | Thu nhập T9 | Thu nhập T10 | Làm thêm giờ T10 |
|---|---|---|---|---|
| NV_07 | Nhân viên | 14,2 | 19,8 | 5,4 |
| NV_08 | Nhân viên | 13,9 | 14,1 | 0,6 |
| NV_15 | Quản lý | 28,0 | 28,0 | 0,0 |

Khi AI trả lời "NV_07 tăng 39%, chủ yếu do làm thêm giờ", bạn tra file đối chiếu là biết đó là ai. Cách thay cả cột bằng mã nhất quán bằng VLOOKUP và cách dọn trang tính ẩn, ghi chú, thuộc tính file có trong bài [ẩn thông tin cá nhân trong file Excel](./an-thong-tin-ca-nhan-trong-file-excel-gui-ai).

## Đừng để AI làm phép tính cuối cùng

AI viết nhận xét tốt nhưng có thể cộng sai, làm tròn sai hoặc đọc nhầm cột, nhất là với bảng dài. Vài thói quen giúp tránh sai:

- **Tự tính số trên Excel**, chỉ nhờ AI diễn giải. Nếu cần công thức mới, nhờ AI viết công thức với số ví dụ, rồi bạn chép vào file thật.
- **Đối chiếu tổng** trong bản nháp của AI với tổng trong file gốc trước khi gửi báo cáo.
- **Tỷ lệ bảo hiểm, thuế thu nhập cá nhân thay đổi theo thời gian**, và AI có thể trả lời theo quy định cũ. Bài [nhân sự dùng AI viết đánh giá, tính lương](./nhan-su-dung-ai-viet-danh-gia-tinh-luong) nói thêm về chuyện này.

## Làm nhanh hơn với OfflineMask

Nếu tháng nào cũng phải làm sạch bảng lương trước khi gửi AI, [OfflineMask](../) là ứng dụng miễn phí làm phần thay mã ngay trên máy bạn, không cần mạng:

1. **Ẩn.** Mở file XLSX, XLS, ODS hoặc CSV. Ứng dụng tự tìm số tài khoản, CCCD, mã số thuế, số điện thoại, email, và cả họ tên khi bạn cài gói tiếng Việt. Bạn xem lại, bôi đen để ẩn thêm chỗ còn sót, rồi xuất bản đã ẩn, giữ nguyên định dạng bảng. Cùng một người luôn mang cùng một mã, kiểu `[TEN_1_4e8c]`.
2. **Hỏi AI.** Gửi bản đã ẩn cho AI bạn hay dùng.
3. **Khôi phục.** Dán câu trả lời của AI vào lại OfflineMask, các mã tự đổi về thông tin thật. Bảng đối chiếu không rời khỏi máy bạn.

Cần nói rõ giới hạn: OfflineMask tìm được phần lớn thông tin nhận ra một người chứ không phải tất cả, và nó không tổng hợp số liệu hay gộp nhóm nhỏ thay bạn. Chức danh hiếm, phòng ban chỉ có một người vẫn là việc bạn tự xem lại. Cách ứng dụng xử lý dữ liệu có ở trang [Quyền riêng tư](../privacy).

## Tóm lại

- Phần lớn báo cáo lương chỉ cần số đã tổng hợp: làm PivotTable trên máy, chỉ gửi bảng tổng cho AI.
- Gộp những nhóm chỉ có một vài người, vì tổng của một người chính là lương của người đó.
- Khi AI cần từng dòng: làm trên bản sao, xóa họ tên, CCCD, mã số thuế, số tài khoản, ghi chú; thay bằng mã mới; giữ nguyên số liệu.
- Giữ bảng đối chiếu mã ở file riêng trên máy, không tải lên AI.
- Tự tính và đối chiếu số trên Excel; để AI diễn giải, không để AI quyết định con số cuối cùng.

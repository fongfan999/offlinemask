---
title: Làm sao biết một ứng dụng có thật sự chạy offline?
description: Đừng chỉ tin lời quảng cáo. Tắt mạng rồi dùng thử, theo dõi kết nối của ứng dụng khi có mạng, đọc trang quyền riêng tư và xem mã nguồn nếu có.
date: 2026-11-23
checked: 2026-11-23
---

**Bạn không cần tin lời quảng cáo, vì có thể tự kiểm tra trong vài phút.** Cách đơn giản nhất: tắt Wi-Fi rồi dùng thử, xem ứng dụng có làm được việc chính không. Nhưng chạy được khi mất mạng chưa có nghĩa là không bao giờ gửi gì đi, nên bước thứ hai là bật mạng lại và theo dõi xem ứng dụng kết nối tới đâu, bằng công cụ như LuLu hay Little Snitch trên Mac, Resource Monitor trên Windows, OpenSnitch trên Linux. Cuối cùng, đọc trang quyền riêng tư của ứng dụng để đối chiếu với những gì bạn thấy. Ba bước khớp nhau thì bạn có thể yên tâm hơn nhiều.

## "Chạy offline" thực ra có thể mang nhiều nghĩa

Khi một ứng dụng ghi "offline" hay "xử lý trên máy", lời đó có thể mang những nghĩa khác nhau:

- **Làm được việc khi không có mạng**, nhưng khi có mạng thì vẫn đồng bộ, gửi thống kê sử dụng hoặc báo lỗi tự động.
- **Xử lý nội dung trên máy**, nhưng vẫn gửi đi một vài thông tin khác, như phiên bản ứng dụng hay loại máy.
- **Không gửi gì cả**, chỉ dùng mạng khi bạn tự bấm tải hay mở một liên kết.

Với công việc có thông tin của khách hàng, đồng nghiệp hay học sinh, điều bạn cần biết là nội dung mình đưa vào có rời khỏi máy hay không, và khi nào. Ba bước dưới đây giúp trả lời câu hỏi đó.

## Bước 1: Tắt mạng rồi dùng thử

Tắt Wi-Fi, rút dây mạng (nếu có), rồi mở ứng dụng và làm đúng việc bạn định làm. Hãy dùng dữ liệu mẫu, không dùng dữ liệu thật. Ví dụ (hư cấu), dán đoạn này vào:

> Chị Nguyễn Minh Anh, số điện thoại 0901 234 567, email minhanh@example.com, cần đổi lịch hẹn sang thứ Sáu.

Sau đó kiểm tra:

- Ứng dụng có mở được không, hay đòi đăng nhập, đòi "kết nối để tiếp tục"?
- Việc chính (ẩn thông tin, tóm tắt, chuyển định dạng...) có chạy hết không, hay chỉ một phần?
- Có tính năng nào báo lỗi mạng không? Tính năng đó thường là phần gửi dữ liệu đi.

Nếu ứng dụng làm trọn việc khi không có mạng, việc xử lý nội dung đúng là diễn ra trên máy bạn. Nhưng chưa xong: một ứng dụng có thể làm việc bình thường khi mất mạng, rồi gửi dữ liệu khi có mạng trở lại. Vì thế cần bước 2.

## Bước 2: Bật mạng lại và theo dõi kết nối

Các công cụ dưới đây cho bạn thấy ứng dụng nào đang kết nối tới địa chỉ nào. Trong lúc theo dõi, hãy dùng ứng dụng như thật (vẫn với dữ liệu mẫu), để mở trong vài phút, rồi đóng lại và mở lại.

### Trên Mac

- **[LuLu](https://objective-see.org/products/lulu.html)** của Objective-See: miễn phí, mã nguồn mở, chặn và báo khi một chương trình định tạo kết nối ra ngoài mới. Thông báo ghi tên chương trình và nơi nó định kết nối tới, bạn chọn cho phép hay chặn.
- **[Little Snitch](https://www.obdev.at/products/littlesnitch/index.html)** của Objective Development: có bản dùng thử, sau đó trả phí. Ngoài thông báo cho phép hay chặn, nó có màn hình Network Monitor liệt kê kết nối theo từng ứng dụng, máy chủ và lượng dữ liệu.

### Trên Windows

**Resource Monitor** có sẵn trong Windows. Mở nó bằng cách nhấn phím Windows, gõ `resmon` rồi Enter, sau đó chọn thẻ **Network**. Phần đầu liệt kê các tiến trình đang dùng mạng; đánh dấu ô của ứng dụng bạn muốn xem để các phần bên dưới chỉ hiện kết nối của nó, kèm địa chỉ nó đang nói chuyện. [Bài hướng dẫn của Microsoft](https://techcommunity.microsoft.com/blog/askperf/using-resource-monitor-to-troubleshoot-windows-performance-issues-part-1/375008) mô tả công cụ này kỹ hơn.

### Trên Linux

**[OpenSnitch](https://github.com/evilsocket/opensnitch)** là tường lửa ứng dụng mã nguồn mở, cho bạn quyết định ứng dụng nào được kết nối ra ngoài, tương tự Little Snitch.

### Đọc kết quả thế nào?

- **Không có kết nối nào** khi bạn dùng ứng dụng: dấu hiệu tốt nhất.
- **Có kết nối, nhưng đúng lúc bạn bấm tải bản cập nhật, tải thêm gói dữ liệu hay mở một liên kết**: thường là bình thường, miễn trang quyền riêng tư có nói rõ.
- **Có kết nối tự động tới máy chủ lạ**, nhất là ngay sau khi bạn dán hay mở tệp: hãy dừng dùng ứng dụng với dữ liệu thật cho tới khi biết nó gửi gì.

Lưu ý: một số ứng dụng chạy giao diện bằng thành phần web có sẵn của hệ điều hành, và thành phần đó có thể tự kiểm tra cập nhật cho chính nó. Nếu thấy kết nối như vậy, hãy xem tên tiến trình trong công cụ theo dõi và đối chiếu với trang quyền riêng tư của ứng dụng.

## Bước 3: Đọc trang quyền riêng tư và đối chiếu

Một trang quyền riêng tư đáng tin thường nói cụ thể: ứng dụng dùng mạng trong những trường hợp nào, kết nối tới đâu, gửi đi gì, lưu gì trên máy và trong bao lâu. Những câu chung chung như "chúng tôi coi trọng quyền riêng tư của bạn" mà không có chi tiết thì chưa nói được gì.

Đặt danh sách đó cạnh những gì bạn thấy ở bước 2. Nếu công cụ theo dõi bắt được kết nối mà trang không nhắc tới, hãy hỏi nhà phát triển trước khi dùng tiếp.

Nếu ứng dụng công khai mã nguồn, người có chuyên môn (hoặc bộ phận IT của công ty bạn) có thể đọc để kiểm tra thêm. Bạn không cần tự đọc mã: việc mã được công khai cho thấy ai cũng có thể soi lời hứa của nhà phát triển.

## Ví dụ: tự kiểm tra OfflineMask

[OfflineMask](../) là ứng dụng miễn phí thay tên, số điện thoại, số tài khoản... bằng mã trên máy bạn trước khi bạn hỏi AI, rồi đổi mã về thông tin thật khi bạn dán câu trả lời vào lại. Bạn có thể dùng chính ba bước trên để kiểm tra nó:

1. **Tắt Wi-Fi**, mở OfflineMask, dán đoạn mẫu về chị Nguyễn Minh Anh ở trên. Ứng dụng thay số điện thoại và email bằng mã như `[SDT_1_4e8c]`; họ tên được nhận diện khi bạn đã cài gói tiếng Việt. Dán lại đoạn có mã, mã được đổi về thông tin thật. Tất cả chạy khi không có mạng.
2. **Bật mạng và theo dõi** bằng LuLu, Little Snitch hay Resource Monitor trong lúc ẩn và khôi phục.
3. **Đối chiếu với [trang Quyền riêng tư](../privacy)**. Trang này liệt kê bốn trường hợp ứng dụng dùng mạng, đều do bạn bấm: tải ứng dụng, tải gói tiếng Việt trong Cài đặt, bấm một liên kết, và gửi báo lỗi trên trình duyệt. Ngoài ra không có kết nối nào khác: không tự cập nhật, không báo lỗi tự động, không thống kê. Trên Windows, trang cũng nói trước rằng thành phần WebView2 của hệ điều hành có thể tự kết nối tới edge.microsoft.com để kiểm tra cập nhật cho chính nó; kết nối đó không mang nội dung bạn đưa vào. Mã nguồn của OfflineMask công khai trên GitHub.

OfflineMask không kết nối với ChatGPT hay AI nào: bạn tự dán bản đã ẩn sang đó. Ứng dụng tìm được phần lớn chứ không phải mọi thông tin riêng, nên hãy luôn xem lại bản đã ẩn trước khi gửi.

Nếu bạn đang cần thuyết phục sếp hay bộ phận IT cho dùng một công cụ như vậy, kết quả của ba bước này là bằng chứng tốt để đưa vào đề xuất. Bài [Công ty cấm dùng ChatGPT: đề xuất cách dùng an toàn với sếp thế nào?](./cong-ty-cam-dung-chatgpt-de-xuat-voi-sep) có gợi ý cách viết đề xuất đó.

## Tóm lại

- "Offline" có thể chỉ có nghĩa là chạy được khi mất mạng, chưa chắc là không bao giờ gửi gì đi.
- Tắt mạng rồi dùng thử với dữ liệu mẫu để xem việc chính có chạy trên máy không.
- Bật mạng lại và theo dõi kết nối: LuLu hoặc Little Snitch trên Mac, Resource Monitor trên Windows, OpenSnitch trên Linux.
- Đối chiếu với trang quyền riêng tư: một trang đáng tin nói rõ khi nào dùng mạng, kết nối tới đâu, gửi gì.
- Kết nối tự động tới nơi không được nhắc tới là lý do để dừng lại và hỏi nhà phát triển.

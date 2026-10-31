---
title: Có nên dán thông tin khách hàng vào ChatGPT không?
description: Dán họ tên, số điện thoại, số tài khoản của khách vào ChatGPT có rủi ro gì, và cách vẫn nhờ AI làm việc mà không để lộ thông tin của ai.
date: 2026-10-25
---

Câu trả lời ngắn: **không nên dán nguyên văn**. Nhưng bạn cũng không cần bỏ AI. Cách an toàn là thay những gì nhận ra được một người (họ tên, số điện thoại, số tài khoản, CCCD...) bằng mã trước khi gửi, để AI vẫn hiểu việc cần làm mà không biết bạn đang nói về ai. Bài này giải thích vì sao, và làm thế nào cho nhanh.

## Chuyện gì xảy ra khi bạn dán vào ChatGPT

Khi bạn bấm gửi, nội dung rời khỏi máy bạn và được xử lý trên máy chủ của nhà cung cấp AI. Từ lúc đó, việc dữ liệu được giữ bao lâu, ai được xem và có dùng để huấn luyện mô hình hay không là do chính sách của họ và cài đặt tài khoản của bạn quyết định, không còn do bạn nữa.

Vài điều nên biết về ChatGPT bản dành cho cá nhân:

- **Lịch sử trò chuyện được lưu** trong tài khoản cho đến khi bạn xóa. Ai mở được tài khoản đó (đồng nghiệp dùng chung, người mượn máy) đều đọc được.
- **Nội dung có thể được dùng để cải thiện mô hình**, trừ khi bạn tắt tùy chọn này trong phần cài đặt dữ liệu. Nhiều người chưa từng mở phần cài đặt đó.
- **Gói doanh nghiệp có điều khoản khác**, nhưng nhiều người vẫn dùng tài khoản cá nhân cho việc công ty.

Chính sách cụ thể thay đổi theo thời gian; hãy đọc trang [kiểm soát dữ liệu của OpenAI](https://help.openai.com/en/articles/7730893-data-controls-faq) để biết tài khoản của bạn đang ở chế độ nào. Claude, Gemini và các công cụ khác cũng có trang tương tự.

Điểm mấu chốt: dù nhà cung cấp làm đúng mọi điều họ hứa, **thông tin của khách đã nằm ở một nơi mà khách không đồng ý cho nó nằm**. Đó mới là vấn đề.

## Vì sao đây là chuyện của bạn, không chỉ của IT

Thông tin khách hàng không phải của bạn, cũng không hẳn của công ty. Khách đưa nó cho bạn để làm một việc cụ thể: giao hàng, mở tài khoản, tính lương, giải quyết khiếu nại. Mang nó sang một dịch vụ khác là dùng nó vào việc khác.

Ở Việt Nam, dữ liệu cá nhân được pháp luật bảo vệ, và nhiều công ty có quy định nội bộ cấm đưa dữ liệu khách hàng lên công cụ bên ngoài. Bạn không cần thuộc từng điều luật để hiểu nguyên tắc chung: chỉ chia sẻ thông tin của người khác khi thật sự cần, và chỉ với người cần biết. Nếu có quy định riêng của công ty, hãy hỏi bộ phận pháp chế hoặc IT.

Còn một lý do thực tế hơn: chỉ cần một ảnh chụp màn hình lịch sử trò chuyện lọt ra ngoài là đủ thành chuyện.

## AI có cần biết khách tên gì không?

Gần như không bao giờ. Hãy xem một yêu cầu quen thuộc của bộ phận chăm sóc khách hàng:

> Tóm tắt giúp tôi khiếu nại đơn hàng giao chậm ba ngày của khách Nguyễn Minh Anh, số 0901 234 567, và soạn tin nhắn xin lỗi.

Để tóm tắt và soạn tin, AI cần biết đơn hàng giao chậm ba ngày và khách đang bực. Nó không cần biết khách tên Minh Anh hay số điện thoại là gì. Bản sau làm được đúng việc đó:

> Tóm tắt giúp tôi khiếu nại đơn hàng giao chậm ba ngày của khách [TEN_1], số [SDT_1], và soạn tin nhắn xin lỗi.

AI sẽ trả lời bằng chính những mã đó, ví dụ "Chào chị [TEN_1], chúng tôi xin lỗi vì đơn hàng đến trễ...". Bạn chỉ việc đổi mã về tên thật trước khi gửi cho khách.

Điều này đúng với hầu hết việc văn phòng: tóm tắt email, viết lại thư, phân tích bảng chi phí, soạn hợp đồng theo mẫu. AI cần **ngữ cảnh**, không cần **danh tính**.

## Làm thủ công: được, nhưng dễ sót

Bạn có thể tự thay bằng tay: tìm từng tên, từng số, gõ mã vào, ghi lại mã nào là ai, rồi đổi ngược khi nhận câu trả lời. Với một đoạn ngắn thì ổn. Với một email dài, một bảng tính vài trăm dòng hay một hợp đồng nhiều trang thì dễ sót một số điện thoại ở cuối trang, hoặc nhầm mã khi đổi lại.

Vài mẹo nếu làm thủ công:

1. Dùng mã có nghĩa và đánh số, như `[TEN_1]`, `[SDT_1]`, `[STK_1]`, để AI vẫn hiểu đó là tên, số điện thoại hay số tài khoản.
2. Cùng một người thì luôn cùng một mã, để AI không tưởng là hai người khác nhau.
3. Giữ bảng đối chiếu mã ở chỗ riêng của bạn, không dán nó vào AI.
4. Đọc lại một lượt trước khi gửi, chú ý chữ ký email, số tài khoản trong phần ghi chú và tên trong tiêu đề.

## Cách nhanh hơn: ẩn tự động ngay trên máy

[OfflineMask](../) làm đúng các bước trên, nhưng tự động và chạy hoàn toàn trên máy bạn:

1. **Ẩn.** Dán văn bản hoặc mở tệp Excel, Word. OfflineMask tự tìm email, số điện thoại, số tài khoản, số thẻ, CCCD, mã số thuế..., và cả họ tên, địa chỉ khi bạn cài gói tiếng Việt. Bạn xem lại, bôi đen để ẩn thêm chỗ còn sót, rồi sao chép bản đã ẩn.
2. **Hỏi AI như mọi khi.** Dán bản đã ẩn vào ChatGPT, Claude hay Gemini.
3. **Khôi phục.** Dán câu trả lời của AI vào lại OfflineMask, mọi mã tự đổi về thông tin thật.

Bảng đối chiếu không bao giờ rời máy bạn, và ứng dụng chạy cả khi không có mạng, nên bạn có thể tự kiểm chứng bằng cách tắt Wi‑Fi. Trên macOS và Windows còn có Ẩn nhanh: bôi đen ngay trong ChatGPT rồi bấm một nút để ẩn tại chỗ.

Dù dùng cách nào, hãy luôn đọc lại bản đã ẩn trước khi gửi. Công cụ giúp bạn không sót, nhưng người quyết định cuối cùng vẫn là bạn.

## Tóm lại

- Đừng dán nguyên văn thông tin khách hàng vào ChatGPT hay bất kỳ AI nào chạy trên máy chủ bên ngoài.
- AI cần ngữ cảnh, không cần danh tính: thay tên, số điện thoại, số tài khoản bằng mã là đủ để nó làm việc.
- Làm thủ công được với đoạn ngắn; với email dài, bảng tính hay hợp đồng, hãy dùng công cụ ẩn tự động chạy trên máy.
- Đọc lại trước khi gửi, và dùng gói AI doanh nghiệp nếu công ty bạn có.

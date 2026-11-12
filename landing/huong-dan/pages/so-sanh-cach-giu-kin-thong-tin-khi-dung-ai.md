---
title: So sánh các cách giữ kín thông tin khi dùng ChatGPT, Gemini
description: Gõ lại bằng tay, tắt tùy chọn huấn luyện, dùng bản doanh nghiệp hay ẩn trên máy trước khi gửi: mỗi cách bảo vệ được gì và không bảo vệ được gì.
date: 2026-11-12
order: 8
---

Câu trả lời ngắn: các cài đặt của nhà cung cấp AI (tắt huấn luyện, trò chuyện tạm thời, bản doanh nghiệp) quyết định **họ làm gì với dữ liệu sau khi nhận**. Chỉ có ẩn thông tin trước khi gửi mới khiến **họ tên, số tài khoản, CCCD... không rời khỏi máy bạn**. Hai nhóm cách này không loại trừ nhau: cách an toàn nhất thường là ẩn trước, rồi gửi vào một tài khoản đã được cài đặt cẩn thận. Dưới đây là từng cách, với điểm mạnh và giới hạn của nó.

## Cách 1: Tự xóa hoặc thay bằng tay

Trước khi dán, bạn xóa tên, số điện thoại, hoặc thay bằng "khách A", "khách B".

- **Bảo vệ được**: thông tin bạn đã xóa không đi đâu cả. Không cần công cụ gì.
- **Giới hạn**: chậm, và rất dễ sót ở chữ ký, cột ghi chú, đầu trang. Thay tay khó nhất quán ("khách A" ở đoạn đầu thành "chị A" ở đoạn sau). Khi AI trả lời, bạn phải tự đổi ngược lại từng chỗ.

Hợp với một đoạn ngắn, dùng một lần.

## Cách 2: Tắt tùy chọn huấn luyện hoặc dùng trò chuyện tạm thời

Nhiều công cụ AI cho phép không dùng cuộc trò chuyện của bạn để cải thiện mô hình, hoặc có chế độ trò chuyện không lưu vào lịch sử.

- **Bảo vệ được**: giảm khả năng nội dung của bạn được dùng để huấn luyện hay nằm lâu trong lịch sử tài khoản.
- **Giới hạn**: nội dung vẫn rời khỏi máy bạn và được xử lý trên máy chủ của nhà cung cấp, rồi được giữ theo chính sách của họ. Cài đặt nằm ở từng tài khoản, trên từng thiết bị, và dễ bị quên.

Bài [ChatGPT có dùng dữ liệu của tôi để huấn luyện không?](../blog/chatgpt-co-dung-du-lieu-de-huan-luyen-khong) chỉ chỗ tắt và giải thích những gì cài đặt này làm được.

## Cách 3: Dùng bản dành cho doanh nghiệp

Công ty đăng ký gói doanh nghiệp, với hợp đồng quy định cách nhà cung cấp xử lý dữ liệu.

- **Bảo vệ được**: có cam kết bằng hợp đồng, có người quản trị, phù hợp với quy định nội bộ.
- **Giới hạn**: dữ liệu vẫn được gửi tới nhà cung cấp; cần công ty chi trả và cài đặt; không giúp gì khi bạn dùng một công cụ AI khác ngoài gói đó.

Bài [Có nên dùng tài khoản ChatGPT cá nhân cho việc công ty không?](../blog/tai-khoan-chatgpt-ca-nhan-cho-viec-cong-ty) và bài về [luật bảo vệ dữ liệu cá nhân khi dùng AI ở công ty](../blog/luat-bao-ve-du-lieu-ca-nhan-dung-ai-cong-ty) nói kỹ hơn về khía cạnh này.

## Cách 4: Ẩn trên máy trước khi gửi

Một công cụ chạy trên máy bạn thay thông tin riêng bằng mã trước khi bạn gửi, rồi đổi mã trong câu trả lời về thông tin thật. [OfflineMask](../) làm việc này, miễn phí, cho văn bản, file Word, Excel, PDF và ảnh.

- **Bảo vệ được**: những gì cho biết đó là ai không rời máy bạn, bất kể bạn dùng AI nào và tài khoản cài đặt ra sao. Cùng một người luôn mang cùng một mã, nên AI vẫn hiểu đủ ý. Khi AI trả lời, các mã tự đổi lại.
- **Giới hạn**: công cụ tìm được phần lớn chứ không phải tất cả, nên bạn vẫn cần đọc lại trước khi gửi. Phần nội dung còn lại (số tiền, tình huống, ngày tháng) vẫn được gửi đi: nếu chính nội dung đó là bí mật, như một kế hoạch kinh doanh, thì ẩn tên là không đủ. Đây là cách thay bằng mã có thể đổi lại, khác với ẩn danh hoàn toàn; bài [ẩn danh dữ liệu và mã hóa giả danh khác nhau thế nào](../blog/an-danh-du-lieu-va-ma-hoa-gia-danh-khac-nhau) giải thích sự khác nhau này.

## So sánh nhanh

| Cách | Thông tin riêng rời máy? | Công sức | Tự đổi lại |
| --- | --- | --- | --- |
| Xóa, thay bằng tay | Không, nếu không sót | Nhiều | Không |
| Tắt huấn luyện, trò chuyện tạm thời | Có | Ít (cài một lần) | Không cần |
| Bản doanh nghiệp | Có, theo hợp đồng | Ít với người dùng | Không cần |
| Ẩn trên máy trước khi gửi | Không, nếu không sót | Ít | Có |

## Nên chọn cách nào?

- Làm theo quy định của công ty trước tiên. Nếu công ty đã có bản doanh nghiệp, hãy dùng nó.
- Với thông tin của khách hàng, đồng nghiệp hay người thân, hãy ẩn trước khi gửi, kể cả khi đã tắt huấn luyện: cài đặt chỉ là lớp thứ hai.
- Nếu AI không cần biết đó là ai (hầu hết việc soạn thư, tóm tắt, phân tích), đừng để nó biết.

## Tóm lại

- Cài đặt của nhà cung cấp quyết định họ làm gì với dữ liệu; ẩn trước khi gửi quyết định dữ liệu nào rời máy bạn.
- Làm tay ổn cho đoạn ngắn, nhưng dễ sót và phải tự đổi lại.
- Ẩn trên máy giữ thông tin riêng lại với bạn, với bất kỳ AI nào, nhưng vẫn cần đọc lại.
- Kết hợp: ẩn trước, rồi gửi vào tài khoản đã cài đặt cẩn thận.

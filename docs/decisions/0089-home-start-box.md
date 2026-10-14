# 0089 — One place to start on the home page

Date: 14 October 2026. Status: requested by the owner ("do all") after a review of the home page from a low-tech first-time user's point of view.

## Problems

- To start, a newcomer first had to pick our category (Văn bản, Bảng tính, Tài liệu), while they simply have "this email" or "this file from the bank".
- The pack strip was a filled blue bar under the cards, as loud as the main choices. It said "Tải gói nhận diện (712 MB)…", which read as a required first step.
- The illustration's steps were worded for pasting text only ("Dán, bấm Ẩn thông tin", "Sao chép sang AI").
- There was no way to try the app without one's own data before choosing a page.
- Nothing near the place where people hesitate said that files stay on the computer.

## Decisions

- **Start box.** Directly under the illustration, a one-row drop zone: "Kéo thả tệp hoặc dán văn bản" / "hoặc chọn tệp · Excel, CSV, Word, TXT · dán bằng ⌘V" (Ctrl+V outside Apple systems). It takes any supported file and opens the right page at its first step, with the file already loaded:
  - `.txt`/`.md`: the text page, through the checks shared with the other text paths;
  - spreadsheets: Bảng tính;
  - `.docx`/`.odt`: Tài liệu.

  Pasting text anywhere on the home page opens the text page with it, and a pasted file is treated like a dropped one. PDF and images get "sắp được hỗ trợ", `.doc` gets the save-as-.docx advice, and anything else lists what opens. Unlike the cards, this goes to the first step even without history ([0072](0072-one-screen-without-history.md)): the user just brought new content.
- **Cards are the second way in.** The heading becomes a quieter "Hoặc chọn loại nội dung" (14 px, muted), and the cards are unchanged.
- **Trust and trial, under the box.** "Tệp và văn bản không rời khỏi máy bạn." with a lock, and "Xem thử với ví dụ", which opens the text page with the synthetic sample text, ready to mask.
- **Pack strip as an option.** "Muốn tự ẩn cả họ tên và địa chỉ? Tải thêm gói nhận diện (712 MB, chỉ một lần)." / "Không bắt buộc: email, số điện thoại, số tài khoản đã được ẩn ngay." It is now outlined rather than filled. "Gói nhận diện" stays the app-wide name used in Cài đặt.
- **Illustration copy.** "Bấm Ẩn thông tin", "Gửi bản đã ẩn cho AI", "Đưa câu trả lời của AI vào OfflineMask", so the steps also fit files. The layout, alias and labels stay as accepted ([0066](0066-home-page-honest-and-compact.md)).

## Verified

`pnpm lint`, `pnpm typecheck` and `pnpm test` pass. In the in-app browser:
- at 1024 × 768 (dark), the start box sits above the fold with the cards right below;
- pasting text opened the text page with it;
- a `.csv` opened in Bảng tính, a `.pdf` showed the "sắp được hỗ trợ" message on the home page, and "Xem thử với ví dụ" opened the text page with the sample;
- at 375 × 812, the box wraps cleanly with no horizontal overflow.

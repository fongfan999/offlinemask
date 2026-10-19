# 0099 — A simpler home page, with Ẩn nhanh as the other way in

Date: 19 October 2026. Status: requested by the owner ("the quick mask feature works great so far, please review the homepage again, do we need to improve/simplify anything"), then "Make all three: remove the format cards, add the Ẩn nhanh line, trim the hero line."

## Changes

- **The format cards are gone.** "Hoặc chọn loại nội dung" with Văn bản, Bảng tính and Tài liệu duplicated two other ways to the same pages: the start box ([0089](0089-home-start-box.md)), which takes any supported file or pasted text and opens the right page, and the sidebar entries, which stay (AGENTS.md). The home page now reads: what it does, how it works (the accepted three-step illustration), where to start, and the optional pack notice, which keeps its place under the start box.
- **Ẩn nhanh is mentioned once, under the start box.** In the desktop app, while Ẩn nhanh does not work ([0098](0098-quick-discovery.md)), one quiet line says "Hoặc bôi đen chữ ngay trong ChatGPT, Zalo hay Word để ẩn tại chỗ." with "Bật Ẩn nhanh", which opens Cài đặt › Thao tác nhanh. It disappears once the feature works, and is never shown in the browser preview or where selections cannot be read.
- **"On your machine" is said once at each place.** The hero line ends at "…được đổi thành mã thay thế ngay trên máy bạn."; the start box keeps "Tệp và văn bản không rời khỏi máy bạn."

- **The start box is a little larger** (owner: "should be bigger a little bit"): 120 px tall instead of about 75, with more inner space and a 17 px title, now that it is the page's one action. Same layout; the page still fits one screen at the default window size.

Kept: the heading, the three-step illustration, the start box and its sample link, the pack notice.

## Checked

`pnpm test`, `pnpm typecheck`, `pnpm lint`; the browser preview at desktop and phone widths, light and dark.

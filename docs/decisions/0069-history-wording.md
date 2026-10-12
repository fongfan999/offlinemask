# 0069 — "Lịch sử" instead of "phiên"

Date: 12 October 2026. Status: requested by the owner ("'Phiên' is not a good copy, I think use something 'History' is better, apply globally").

## Decision

User-facing copy calls the saved list **lịch sử** and an entry a **mục** (or, where the context is one text, "văn bản này" / "bản này"). Code identifiers (`Session`, `useSessions`, storage keys) are unchanged, so stored history and the vault format are unaffected. "Phiên bản" (version) is a different word and stays.

| Where | Before | After |
| --- | --- | --- |
| Sidebar heading / empty | CÁC PHIÊN CỦA BẠN / Chưa có phiên nào. | LỊCH SỬ / Chưa có mục nào. |
| Text page actions | Xóa phiên · Phiên mới | Xóa khỏi lịch sử · Tạo mới |
| Text page notes | Phiên mẫu; Kết quả sẽ xuất hiện trong một phiên mới ở thanh bên.; Phiên này vẫn được giữ. | Bản mẫu; Kết quả sẽ được lưu vào lịch sử ở thanh bên.; Bản này vẫn được giữ trong lịch sử. |
| Keep offer | Muốn giữ phiên này cho lần sau? … lưu các phiên … phiên mất | Muốn giữ lại cho lần sau? … lưu lịch sử … lịch sử mất |
| Settings card | Mật mã · Lưu phiên and its sentences | Mật mã · Lưu lịch sử; counts read "… mục trong lịch sử" |
| Lock screen | Các phiên của bạn được mã hóa… / Xóa toàn bộ phiên đã lưu… danh sách trống? | Lịch sử của bạn được mã hóa… / Xóa toàn bộ lịch sử đã lưu… lịch sử trống? |
| Restore panel | … của phiên này | … của văn bản này |
| Vault and storage errors | phiên đã lưu; các phiên mới / các phiên này | lịch sử đã lưu; ẩn thông tin mới / các mục này |

Earlier decision records keep their original wording as history.

## Verification

`pnpm lint`, `pnpm typecheck` and `pnpm test` (204) passed; no user-facing "phiên" remains in `src/` apart from "Phiên bản". The sidebar heading, empty state and text-page actions were read back in the in-app browser after masking the sample text.

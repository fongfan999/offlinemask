# 0071 — History is a passcode feature

Date: 13 October 2026. Status: requested by the owner. Supersedes the sidebar part of the sessions requirement in [product direction](../product-direction.md) and the "Chưa lưu" labels from [0064](0064-optional-passcode.md).

## Problem

Without a passcode the sidebar still listed every masked text under "Lịch sử", so it looked stored, while small labels ("· Chưa lưu", "Chưa lưu trên máy.", "Bản xem trước: lịch sử chỉ nằm trong bộ nhớ") explained memory versus disk. The owner: users do not care where it lives; skipping the passcode, as Settings describes, is their choice not to keep anything, so the app should be straightforward about that.

## Decision

- **No passcode, no history.** The sidebar's LỊCH SỬ list is hidden until a passcode is set (`history` prop on `AppSidebar.vue`, true only when the vault is unlocked); Settings stays anchored at the bottom. "Xóa khỏi lịch sử" is hidden too; "Tạo mới" stays.
- **No storage talk.** The per-item "· Chưa lưu" and the review footer note are gone when there is no passcode. With one, the footer says "Đã lưu vào lịch sử." The browser preview, which has no passcode, says "Bản xem trước: không lưu lịch sử."
- **One opt-in.** The offer after masking reads "Muốn xem lại văn bản này sau? Đặt mật mã để bật lịch sử. Các văn bản bạn ẩn được lưu trên máy này."; once set, "Đã bật lịch sử. Văn bản này có trong thanh bên." Settings: "Đặt mật mã 6 số để bật lịch sử: các văn bản bạn ẩn được lưu trên máy này để mở lại sau."; removing the passcode "xóa … mục trong lịch sử, bỏ mật mã và tắt lịch sử".
- **Unchanged.** Entries are still created in memory during a launch, so setting a passcode later keeps the current work; nothing private is written without a passcode. The vault, its format and the lock screen are unchanged. `AGENTS.md` now says history appears once a passcode is set.

Leaving a masked text without a passcode (for example to download the pack) left no way back to it; [0072](0072-one-screen-without-history.md) fixes that.

## Verification

`pnpm lint`, `pnpm typecheck` and `pnpm test` (208) passed. In the dev build, with the vault state set to "none": no history heading or list, no "Xóa khỏi lịch sử", no footer note or stray icon, and the new offer copy. Switching the state to "unlocked" showed the list with the current entry, no "Chưa lưu", "Xóa khỏi lịch sử", and "Đã lưu vào lịch sử." On disk, the desktop app's data folder held no `sessions.vault` and its web storage held only the sample-history key.

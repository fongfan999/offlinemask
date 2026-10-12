# 0068 — Settings: three cards, shorter copy, destructive actions tucked away

Date: 12 October 2026. Status: requested by the owner ("Do all", after a Settings review).

## Problem

Settings mixed two cards with loose rows and a stray disclosure; "Cài từ tệp" installs a recognition pack but sat under the update tools; the version was only in the sidebar. Without a passcode the vault card showed four sentences and an open two-field form; with one, the wipe button was always visible. The pack card showed two sizes without saying which was which, used "Huỷ"/"xoá" where the app writes "Hủy"/"Xóa", and its uninstall copy was awkward. The topbar crumb repeated the "Cài đặt" heading.

## Decisions

- **Three cards.** Gói nhận diện, Mật mã · Lưu lịch sử (renamed by [0069](0069-history-wording.md)), Ứng dụng. `AppSettings.vue` replaces `ThemeSettings.vue` and `SettingsTools.vue`: Giao diện (the switch from [0067](0067-appearance-setting.md), without its explanatory line) and Cập nhật (Sắp có, "Phiên bản 1.0.0", one policy sentence: "OfflineMask không tự kết nối Internet; bạn chủ động kiểm tra bản mới cho ứng dụng và gói nhận diện."). The manual-only update policy and disabled placeholder are unchanged.
- **Pack card.** "Cài từ tệp" (Sắp có, still a placeholder) moves into the pack card beside "Chi tiết", the renamed "Thông tin gói", which holds attribution and "Gỡ gói". Size: "712 MB" with "Tải một lần · chiếm 1,14 GB trên máy". Uninstall: "Gỡ gói sẽ xóa … khỏi máy. Muốn tự ẩn họ tên và địa chỉ lại, bạn cần tải lại …"; "Hủy".
- **Passcode card.** Without a passcode: "Đặt mật mã 6 số để giữ lịch sử khi mở lại ứng dụng." and a "Đặt mật mã" button; the form opens on request, the forgotten-passcode warning joins the same paragraph, and "Hủy" sits on one row beside the submit button (a slot in `PasscodeSetup.vue`). After the owner's screenshot showed a double paragraph gap and the cancel button wrapping below, the card's description lost its bottom margin and the action row no longer wraps. With a passcode: "Đổi mật mã" and "Bỏ mật mã" disclosures; opening the latter is the first step, "Xóa và bỏ mật mã" the second. Outcomes are no longer a small line at the foot of the card, which the owner missed after changing the passcode: a highlighted strip with a check ("Đã đổi mật mã. Lần sau hãy mở ứng dụng bằng mật mã mới.", and the set-up and removal confirmations) appears under the card title and takes focus, and a successful change closes the "Đổi mật mã" form. Reopening the form clears the strip.
- **Topbar.** Settings shows no crumb; Văn bản and Bảng tính keep theirs.

## Verification

`pnpm lint`, `pnpm typecheck` and `pnpm test` (204) passed. In the in-app browser at 1280 × 1100 (light and dark) and 375 × 812: three cards, no horizontal overflow, the Văn bản crumb intact. The desktop-only vault states (no passcode, form open, unlocked with "Bỏ mật mã" open) were checked by setting the vault state in the dev build; the packaged app was not rebuilt.

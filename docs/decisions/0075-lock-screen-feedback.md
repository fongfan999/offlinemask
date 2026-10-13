# 0075 — Lock screen: phone-like slots, clear errors, no button

Date: 13 October 2026. Status: requested by the owner ("do all", after a lock-screen review). Builds on [0065](0065-six-digit-passcode.md).

## Decision

- **Six slots.** `PasscodeField.vue` draws six slots that fill with a dot as digits are typed, the next one outlined. One real password input covers them (transparent), so keyboard, paste, autofill and screen readers behave as before. The same field is used in Settings and in the offer on the review screen.
- **Wrong passcode.** The slots turn the error colour, the field shakes once (not with reduced motion), "Mật mã chưa đúng." shows in the error colour, and focus returns to the field after it is re-enabled. Typing again clears the error.
- **No button.** The screen unlocks on the sixth digit (Enter still submits). The disabled "Mở khóa" bar is gone; one status line under the slots, which keeps its height, shows "Đang mở…" with a spinner, the error, or "Chỉ nhập số." for 2.5 seconds when a letter or symbol is typed.
- **Copy.** Subtitle "Mở khóa để xem lịch sử của bạn." replaces the storage wording. "Quên mật mã?" now reads "Không có cách lấy lại mật mã. Xóa lịch sử và bỏ mật mã? Không thể hoàn tác." with "Xóa và bỏ mật mã", matching Settings and [0071](0071-history-needs-passcode.md).

The passcode itself, the vault and the forgotten-passcode wipe are unchanged.

## Verification

`pnpm lint`, `pnpm typecheck` and `pnpm test` passed. In the dev build with the vault state set to "locked" and a stubbed wrong unlock: digits fill the slots, a letter shows "Chỉ nhập số." then clears, the sixth digit shows "Đang mở…", then red slots, the shake, the error and focus back in the field; the reset panel shows the new copy, in light and dark. The Settings set-up form shows the slots. The packaged app and real autofill were not exercised.

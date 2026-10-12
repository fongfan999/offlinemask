# 0064 — The passcode is optional, offered after masking

Date: 12 October 2026. Status: accepted by the owner ("passcode should be optional; we don't ask users to create a passcode; when masking we'll show a note if they want to keep sessions").

## Decisions

- **No setup at launch.** The lock page appears only when a passcode already exists. Without one the app opens straight to the home page and private sessions last until the app closes.
- **The offer lives on the review screen.** After a masking run, a private session's review step shows "Muốn giữ phiên này cho lần sau?" with "Đặt mật mã" and "Để sau". "Đặt mật mã" expands a two-field form in place (`PasscodeSetup.vue`); on success the note becomes "Đã lưu. Các phiên của bạn sẽ có sẵn khi mở lại ứng dụng." and every existing and future private session is in the vault. "Để sau" hides the offer for the rest of that launch; it returns next launch. Settings has the same form under "Mật mã ứng dụng" for anyone who wants it later.
- **Honest labels without alarm.** While no passcode exists the sidebar marks private sessions "Chưa lưu" and the review footer says "Chưa lưu trên máy."; once saved they read plain and "Đã mã hóa và lưu trên máy này."
- "Quên mật mã?" and the Settings wipe still delete the vault; afterwards the app is simply back in the no-passcode state, and the offer reappears after the next masking.

This supersedes the first-launch setup of decision 0063; the vault itself is unchanged from 0062.

## Verification

`pnpm lint`, `pnpm typecheck` and `pnpm test` (204) pass. The offer, the in-place setup and the lock screen need the `tauri dev` or packaged app, since the browser preview reports the vault as unavailable and therefore shows neither.

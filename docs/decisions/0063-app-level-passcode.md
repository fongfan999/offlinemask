# 0063 — The passcode is the app's, set on first launch

Date: 12 October 2026. Status: accepted by the owner.

## Owner correction to decision 0062

"Passcode should be the app level; sessions are the first use case we need a passcode for. We don't store sessions in memory; sessions are stored on disk when the passcode is set."

Decision 0062 had made the passcode an opt-in feature of session storage, with a temporary in-memory mode before it. That gave the product two storage modes and a footer that kept explaining the weaker one.

## Decisions

- **First launch creates the passcode.** The lock page has a setup mode: "Tạo mật mã cho OfflineMask", passcode and confirmation, at least four characters. The shell does not render until the passcode exists (vault state `none`) or has been entered (state `locked`). The passcode is the app's; today it protects the encrypted session store, later features that need protection sit behind the same one.
- **No in-memory mode.** With a passcode always present in the desktop app, every private session is on disk from the moment it is created, and the review footer simply says "Đã mã hóa và lưu trên máy này." The sidebar no longer labels private sessions "Tạm thời" or "Đã lưu". The browser preview has no native layer; it keeps sessions in memory for development and says so in the footer.
- **Settings card is "Mật mã ứng dụng".** It changes the passcode or wipes everything ("Xóa dữ liệu và đặt lại mật mã"), after which the setup screen appears again. "Quên mật mã?" on the lock screen does the same wipe and returns to setup with an empty list, as 0062 decided.
- Vault format, crypto and native commands are unchanged from 0062.

## Verification

`pnpm lint`, `pnpm typecheck` and `pnpm test` (204) pass; the native module did not change. The setup and unlock screens need the `tauri dev` or packaged app, since the browser preview reports the vault as unavailable.

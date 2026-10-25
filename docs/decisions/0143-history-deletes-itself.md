# 0143 — History deletes itself

Date: 25 October 2026. Status: requested by the owner. Amends [0062](0062-passcode-vault.md) and [0071](0071-history-needs-passcode.md).

## Problem

History, once a passcode was set, stayed until the user deleted it. The vault holds originals and alias tables, so an entry kept for months is only a liability, and the file grows.

## Decision

- **A keep period, no "forever".** Cài đặt › Mật mã · Lưu lịch sử offers *Tự xóa lịch sử sau* 1 · 7 · 30 · 90 ngày, default 30 (`keepDayChoices` in `core/sessions.ts`). The owner removed a "never" option: nobody remembers what they masked months ago. The choices follow common apps (iMessage and Signal keep 30 days or more, WhatsApp 1/7/90 days, Telegram 1 day/1 week/1 month; 30 days is also the Trash convention).
- **Counted from creation.** An entry goes once `createdAt` is older than the period, whether or not it was reopened, so the rule is simple to state.
- **When it runs.** The app is offline with no background service: expired entries are dropped when the vault is unlocked (`useSessions.load`), then hourly and whenever the window comes back while unlocked (`App.vue`), since the app can sit in the tray for weeks. The debounced vault save writes the shorter list. An open entry that expires returns its page to a new draft.
- **Shortening asks first.** Picking a shorter period that would delete entries shows "N mục cũ hơn X ngày sẽ bị xóa ngay. Không thể hoàn tác." with *Xóa và áp dụng* / *Hủy*; otherwise it applies at once.
- **Where the choice lives.** It is a plain preference in web storage (`offlinemask.history-keep-days`), like the theme; it reveals nothing private. Without a passcode there is no history and no setting.
- Sample sessions never expire; they are fixture references, not private input.

`landing/privacy.html` §3 now states the period, and `privacy-contract.test.mjs` ties it to the code.

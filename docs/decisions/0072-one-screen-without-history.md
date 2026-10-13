# 0072 — Without a passcode: one screen per format, and coming back shows it

Date: 13 October 2026. Status: requested by the owner ("without passcode, users only have one screen/one session, new one will replace the current one. And if users navigate to other screen like settings, when they're back, just show the last screen").

## Decision

- **One at a time.** Without history ([0071](0071-history-needs-passcode.md)), a new result replaces the previous one of the same format: `adoptSession` in `App.vue` removes it before adding the new session. This also holds when the run finishes while the user is on another page.
- **Back to the last screen.** The shell remembers what was last open per format (a draft or a result). The sidebar entries and the home cards go through `openFormat`, which reopens it; "Tạo mới", "Sửa văn bản" and "Ẩn văn bản mới" still start a draft. The sidebar marks Văn bản or Bảng tính as current while its result is open.
- **The screen itself is kept.** `WorkspacePage` sits in a `KeepAlive`, so the step, the original/masked view and a pasted AI reply in step 3 are still there on return. All of it stays in RAM, as before.
- **With a passcode nothing changes.** The format entries open a fresh draft and the history list opens entries.

## Verification

`pnpm lint`, `pnpm typecheck` and `pnpm test` passed. In the browser preview (no passcode): masked the sample, opened step 3 and pasted a reply, went to Cài đặt, then back through the sidebar and through the home card: step 3 with the reply both times. "Tạo mới", away and back: the draft. Masking new text replaced the old result (one entry, new id). Starting a run and leaving for Cài đặt: on return the new result showed at step 2. With the vault state set to unlocked, Văn bản opened a draft and the history item opened the entry.

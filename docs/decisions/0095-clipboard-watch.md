# 0095 — Opt-in clipboard watch

Date: 18 October 2026. Status: requested by the owner as item 5 of the convenience list in [0090](0090-clipboard-quick-actions.md), after the assistant had advised against it. Built opt-in, off by default, with the boundaries below; the PRD's deferred-scope wording is amended accordingly.

**Withdrawn on 19 October 2026.** The owner: "I think this feature should be removed as well, it doesnt make much impact, since they use copy paste a lot, but not always AI". Most copies are not headed for an AI, so a nudge on each one is noise, and the selection circle and ⌘⇧M ([0096](0096-selection-popover.md)) already act on the text the user picks. Removed: the Settings row and its stored preference (a stored value is simply ignored), `src-tauri/src/clipboard_watch.rs` with its commands and event, the `windows-sys` dependency it alone used, the corner card's "Ẩn" offer and its styles, and the tests. OfflineMask again reads the clipboard only when the user asks. The rest of this record is kept as history.

## Behaviour

Cài đặt › Thao tác nhanh › "Theo dõi clipboard", off until the user turns it on. While on, each time text is copied anywhere, OfflineMask checks it on the machine with the built-in rules only (email, phone, account and card numbers, identifiers, no model) and, if something is found, the floating panel flashes "Văn bản vừa sao chép có n thông tin nhạy cảm. Bấm Ẩn thông tin để ẩn trước khi dán." for nine seconds. One click on Ẩn thông tin masks the clipboard; doing nothing changes nothing.

Not offered: the app's own output (the last text it wrote), text that already holds aliases (an AI reply), empty text, anything while the app is locked or busy, and anything longer than the text limit.

## Boundaries

- The native side watches only the clipboard's **change counter** (`NSPasteboard.changeCount` on macOS, `GetClipboardSequenceNumber` on Windows), polled twice a second while the watch is on. It never reads content. Linux has no counter without reading the content, so the watch is reported unsupported there and the switch stays off.
- The content is read once per change, in the main window, with the same plugin call the shortcut uses, and only passed to the rules. Nothing is stored, logged, or kept beyond the check; no session is created by the check itself.
- Turning the watch off stops the notices at once; the thread keeps tracking the counter silently so that turning it back on does not fire for an old change.

## Why this is acceptable despite 0090's advice

0090 ruled out watching the clipboard because it reads everything the user copies. The owner chose it anyway for convenience; the version here narrows that: a user must turn it on, the text never leaves the rules check, and Settings says all of this in plain words ("Tắt mặc định … Không lưu, không ghi lại, không gửi đi đâu."). The PRD's "clipboard interception" line now distinguishes this opt-in, rules-only notice from background interception of content, which stays out of scope.

## Code

`src-tauri/src/clipboard_watch.rs` (`quick_watch_supported`, `quick_watch_clipboard`, the `clipboard-changed` event), `useMaskingRun().probe` (rules-only count, no session), `useQuickActions().clipboardChanged` / `setClipboardWatch`, the `offer` tone in the panel, the Settings row. `windows-sys` 0.60.2 (MIT OR Apache-2.0, already in the tree) is added for the Windows counter.

## Verified

`pnpm lint`, `pnpm typecheck`, `pnpm test` (274 tests; the watch's rules — off by default, nudge only on a find, never on the app's own output, alias text or empty text, unsupported systems keep it off — are unit-tested) and `cargo clippy -D warnings` pass. The native change-counter thread and the Settings switch were not exercised live: the switch sits in the webview, which exposed its accessibility tree only once during this session, and the development app was not running. Windows and Linux were not run.

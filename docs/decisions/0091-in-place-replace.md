# 0091 — ⌘⇧M replaces the selection in place

Date: 18 October 2026. Status: requested by the owner after trying [0090](0090-clipboard-quick-actions.md): "the feature works, but the workflow is not convenient, is that simple to press the shortcut, mask, then replace the selected text". Accepted with the clipboard flow as the fallback.

## Behaviour

Select text in any application and press ⌘⇧M (Ctrl+Shift+M elsewhere):

1. OfflineMask sends one copy chord (⌘C / Ctrl+C) to the front application and waits 160 ms for the clipboard.
2. If the clipboard changed, that is the selection: it is masked or restored as in 0090 and the result is written to the clipboard.
3. One paste chord (⌘V / Ctrl+V) puts the result over the selection. The result stays on the clipboard too, because a read-only selection (an AI reply in a chat) ignores the paste and the user then pastes it where it is needed.
4. The panel flashes "Đã ẩn n thông tin ngay tại chỗ bạn chọn." or "Đã khôi phục n mã thay thế ngay tại chỗ bạn chọn."

If the clipboard did not change (nothing selected, or an application that does not answer ⌘C), the text already on the clipboard is processed exactly as before. The panel's own two buttons never touch the selection: when they are clicked the selection is no longer in the front application.

## Permission and fallback

- **macOS** only lets a process post keystrokes to other applications with the Accessibility permission. The shortcut never opens the system dialog itself; Cài đặt › Thao tác nhanh shows a "Thay ngay tại chỗ" row with "Cấp quyền" while the permission is missing, and that button opens the macOS prompt. The permission is re-read when the window regains focus, so granting it in System Settings takes effect without a restart. Until it is granted, ⌘⇧M keeps the clipboard flow and the first result of the launch adds "Muốn thay ngay tại chỗ? Cấp quyền Trợ năng trong Cài đặt › Thao tác nhanh."
- **Windows** needs no permission. **Linux** works on X11; on Wayland the row says the system does not allow it and the clipboard flow stays.
- Development builds are re-signed on every build, so macOS may ask again after a rebuild. Release builds carry one signature.

## Privacy boundary

Only two chords are ever sent, only inside the handling of the user's own shortcut press. No event tap or key listener is installed, nothing is read from the keyboard, and the clipboard is still read only at that moment. The Accessibility permission technically allows more; the Settings copy says what the app does with it ("Chỉ hai phím đó, chỉ khi bạn nhấn phím tắt"), and the code is the only place to check that claim, as with every other promise this app makes.

## Implementation

- `src-tauri/src/quick_input.rs`: three commands, `quick_input_permission(prompt)`, `quick_copy_selection`, `quick_paste_result`. Before a chord the app waits up to 800 ms for the user's own ⌘ ⇧ ⌃ ⌥ to come up (macOS, through `CGEventSource` flags), then explicitly releases ⇧ and the modifier, presses the modifier, types the letter and releases. With `independent_of_keyboard_state` the chord carries its own flags, so a ⇧ still physically down cannot turn ⌘C into ⌘⇧C (which opens the inspector in browsers).
- `useQuickActions().takeSelection` and the `replaced` flag; the paste happens before the final status is sent, and the panel window is now `focusable: false` as well, so a flash can never take the paste. Measured during 0090's checks: the flash left the front application frontmost.
- Dependencies: `enigo` 0.6.1 (MIT; X11 backend on Linux by default, `NewConError::NoPermission` on macOS without Accessibility) and, on macOS, `core-graphics` 0.25.0 (MIT OR Apache-2.0, already in the tree through Tauri) for the modifier check. Both pinned. Consulted: docs.rs for `enigo::Settings`, `Key`, `NewConError`.

## Verified

`pnpm lint`, `pnpm typecheck`, `pnpm test` (268 tests, 2 new), `cargo check`, `cargo clippy -D warnings` and `cargo fmt --check` pass. In the running macOS dev build without the Accessibility permission: ⌘⇧M still masked the clipboard text, and the front application stayed frontmost through the flash. The in-place path itself (copy chord, paste chord) needs the permission granted to the dev binary and was not exercised in this session; see the note in the commit message.

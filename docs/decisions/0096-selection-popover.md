# 0096 — Selection popover: the panel appears above text selected in other apps

Date: 18 October 2026. Status: requested by the owner after seeing Lark's selection toolbar over a PDF ("why can Lark do this popup easily"), with the platform choice "macOS and Windows backends, X11 later, Wayland unsupported".

## Behaviour

Cài đặt › Thao tác nhanh › "Nút nổi khi bôi đen", off by default. When on, finishing a selection in another application (a drag, or a double or triple click) brings the floating panel up just above the selected text, or above the pointer when the application reports no rectangle, with the usual two buttons and a question: "Ẩn thông tin trong phần vừa chọn?" for ordinary text, "Khôi phục mã thay thế trong phần vừa chọn?" for text that holds known aliases. A click on the button runs the action on that text and pastes the result over the selection, exactly as ⌘⇧M does in place; the result is also on the clipboard. The panel goes away on the next mouse press elsewhere or after nine seconds. Selections that hold aliases from no known session, selections under two characters, or over the text limit, password fields and this app's own windows never trigger it.

## How it works

- **Shared logic** (`src-tauri/src/selection.rs`): the gesture rule (a release at least 4 px from its press, or a multi-click), the text rule (2 to 50 000 characters), the two events to the main window (`selection-made` with text, logical screen rectangle when known, and the pointer; `selection-cleared` on a press) and the two commands. Unit-tested.
- **macOS** (`selection_macos.rs`): a global `NSEvent` monitor for left-button presses and releases. macOS delivers no events of this app itself to a global monitor, and keyboard events are not requested. After a release that counts, a thread waits 160 ms and asks the Accessibility API for the focused element's `AXSelectedText` and, through `AXSelectedTextRange` and `AXBoundsForRange`, the rectangle. Both need the Accessibility permission already requested in [0091](0091-in-place-replace.md); without it nothing is read and Settings says so. Secure text fields are skipped.
- **Windows** (`selection_windows.rs`): a low-level mouse hook (`WH_MOUSE_LL`) on its own thread; presses on this app's windows are ignored, double clicks are recognised with `GetDoubleClickTime`. After a release that counts, a thread asks UI Automation's text pattern of the focused element for the selection's text and bounding rectangles, converted to logical points with the monitor's DPI. Password elements (`CurrentIsPassword`) and this process are skipped. No permission is involved; applications running elevated are shielded by Windows and give no popover.
- **Frontend**: the composable decides the direction, remembers the pending selection until a button or a clear, and the panel adapter places the window above the rectangle, flipping below it at the top edge and clamping to the monitor's work area (`positionAbove`, unit-tested). A programmatic move for a selection does not become the panel's remembered resting position.
- **Linux**: reported unsupported; the switch stays off. X11 can follow through the PRIMARY selection; Wayland offers no way to observe the pointer or read another application's selection, and that is final.

## Privacy

Only mouse-button events are observed, on both platforms; no key event is ever requested or received, so the no-input-logging promise stands and the Settings copy says exactly that. The selected text is read once per gesture and only while the switch is on, kept in memory until the button or the next press, and used for nothing but the question and the action the user then chooses. The PRD's wording is amended to name the popover next to the shortcut and the Services.

## Dependencies

`block2` 0.6.2 and `core-foundation` 0.10.1 (macOS, both already in the tree, MIT OR Apache-2.0); `windows` 0.62.2 (Windows, already in the tree through Tauri, MIT OR Apache-2.0) with the UI Automation, HiDpi, Com, Ole, Gdi and input features; `objc2-app-kit` gains `NSEvent`, `NSScreen` and `block2`. All pinned. Consulted: the vendored `objc2-app-kit` and `windows` sources for the exact signatures (`addGlobalMonitorForEventsMatchingMask:handler:`, `IUIAutomationTextPattern::GetSelection`, `GetBoundingRectangles`, `GetDpiForMonitor`), Apple's Accessibility attribute names.

## Verified

`pnpm lint`, `pnpm typecheck`, `pnpm test` (276 tests, 2 new), `cargo clippy -D warnings`, `cargo fmt --check` and the two Rust unit tests pass on macOS. The Windows backend was type-checked against the `windows` crate for the `x86_64-pc-windows-msvc` target in a throwaway crate (the full crate cannot cross-compile here); it has not run on Windows. On macOS, with the Accessibility permission granted to the development binary and a TextEdit document holding synthetic text: a posted mouse drag across the line made the panel appear within two seconds, and a posted click elsewhere hid it, with TextEdit staying frontmost. That run showed the panel at its resting position rather than above the selection, because the panel's capability lacked `core:window:allow-available-monitors`; the grant is added and placement itself is covered by the `positionAbove` unit test, but the corrected placement was not seen live: after that run the test harness's posted mouse events stopped reaching TextEdit (System Events clicks landed inconsistently and events posted from a helper were dropped), so later drags selected nothing. Two findings from the same session shaped the backend: asking the system-wide Accessibility element for the focused element answers "cannot complete" (-25204) from this process, while the per-application element of the frontmost app answers, so the backend addresses the application by process id; and the test confirmed the same Accessibility route returns the selected text and its rectangle for a keyboard selection. The owner's first check is therefore: turn the switch on, select text in another application, and see the panel just above it.

## Follow-up: the panel no longer activates the app (same day)

The owner's first live run showed the popover in the right place, above a selection in a chat box, but a click on "Ẩn thông tin" brought OfflineMask's main window forward and the result never replaced the selection. On macOS a click on any window of an inactive application activates it, so the chat lost focus and the paste went to OfflineMask.

- **Non-activating panel (macOS).** At startup the panel window's class is swapped from tao's `TaoWindow` to `OfflineMaskQuickPanel`, an `NSPanel` subclass that never becomes key or main, and it gets the non-activating style, `hidesOnDeactivate = false` (a panel otherwise hides whenever its app is inactive, which is always here), floating level behaviour and the full-screen-auxiliary collection behaviour. The swap is skipped if the new class would need more instance memory than the existing window. This is the technique of the `tauri-nspanel` plugin, done directly with `objc2` (`src-tauri/src/panel_macos.rs`) rather than adding a git-only dependency. Windows already gets `WS_EX_NOACTIVATE` from `focusable: false`; not run there.
- **Progress while masking.** After a button press the panel moves to its corner with "Đang ẩn thông tin…" and a thin indeterminate bar along its bottom edge (a gentle pulse with reduced motion), then shows the result and hides.

Verified: lint, typecheck, 276 tests, clippy and rustfmt. In the owner's running dev app, a click inside the visible panel left the frontmost application (a browser) frontmost. The full click-to-replace path is the owner's to confirm: select text in a chat box, click "Ẩn thông tin", and the selection should change in place while the bar runs in the corner.

## Follow-up: a circle that grows on hover (same day)

The owner asked for the popover to be "as small as possible, maybe just a circle, auto change icon depending on the text, hovering for full options, but the full options should be small as well, and follow the app design, like the borders should be radius", and noticed the mask button still used the old logo.

- **One transparent window, four shapes.** The panel window is now transparent with no native shadow and is resized to whatever it shows, plus an 8 px margin for a CSS shadow in the brand's flat style:
  - **circle**: 32 px, cobalt, just above the end of the selection (below it at the top edge of the screen, beside the pointer without a rectangle). It shows the new brush mark when a click will mask and a return arrow when the selection holds known aliases and a click will restore;
  - **one click**: a click on the circle runs its action at once ("the idea is users should 1 click, but have a choice to open the full options version");
  - **hover hint**: hovering the circle shows a short, non-clickable label beside it, "Ẩn thông tin" or "Khôi phục thông tin". A menu with both actions came first, then counted hints ("Ẩn 2 thông tin · Số điện thoại, Email"); the owner dropped both for these two general words;
  - **restore preview**: for read-only text (below), a card in the top-right corner of the screen with the AI's text and the real values back, highlighted, plus "Sao chép" (the common case) and "Mở trong OfflineMask", which opens the session that owns the first alias when it is still known. It stays until one of its buttons or its × is used; the page and the clipboard are untouched until "Sao chép";
  - **toast**: a card with 12 px corners in the corner of the screen for progress (with the moving bar), results and the clipboard watch's nudge (with a small "Ẩn" chip);
  - **full panel**: the kept-on-screen panel, now with 14 px corners and the new mark on its button.
- **Hover without focus.** The window polls the pointer position every 80 ms while it is a circle (to show and fold the hint), because the app is in the background and the webview may not report hover there; `mouseenter` is only a faster path.
- **The new mark everywhere in the panel** (`BrandMark`), including the primary button that still drew the old glyph.
- `pill.html?state=dot|hover|restore|preview|toast|busy|offer|panel` renders one shape with sample text in the browser preview, for design checks without the desktop app. Checked there in light and dark.

Code: `src/PillApp.vue`, placement helpers `dotSpot` and `growFrom` in `src/adapters/quick-panel.ts` (unit-tested), the `action` field on `QuickStatus`, panel styles in `src/style.css`; window `transparent: true`, `shadow: false`; the panel capability gains `set-size`, `cursor-position` and `scale-factor`.

## Follow-up: when the circle appears, and what it does (same day)

The owner: "Dont just show the popover randomly. Writable text (like an input field): Mask -> Replace the text. Readonly text (like answer from AI): Restore -> Show a quick preview at top right corner, with some actions like copy, open the app to view the session", and "mask as much as possible".

- **Editable or not.** The selection event now says whether the text sits in a field the user can type in. macOS asks Accessibility whether the element's `AXValue` or `AXSelectedText` can be written; Windows asks UI Automation for a value pattern that is not read-only. Any doubt counts as read-only, the harmless side.
- **When the circle shows.** In an editable field: for ordinary text (mask, replaced in place) and for text holding known aliases (restore, replaced in place). In read-only text: for known aliases (restore preview), and for plain text only when the built-in rules find something to hide within 400 ms (masked preview); the owner chose this over always showing it, so selecting a sentence on a web page or in a PDF shows nothing. Names or addresses alone in read-only text need the pack and get no circle there; ⌘⇧M still covers them. Aliases of no known session show nothing.
- **Masked preview.** The same top-right card for read-only text being masked: "Đã ẩn n thông tin", the masked copy with each alias highlighted, "Sao chép" and "Mở trong OfflineMask" (the new session). The page and the clipboard stay untouched until "Sao chép".
- **Mask as much as possible.** Quick masking (shortcut, circle, panel, Services) now uses every category the machine can run, the pack's ones included when it is installed, whatever is ticked on the text page; the built-in ones without the pack.
- **Open the session.** A new `quick_show_main` command brings the main window back, and the shell navigates to the session's page.

Verified: lint, typecheck, 280 tests (the show rules, both previews, copy, open, in-place restore and the all-category masking are covered), clippy, the Windows backend type-checked for its target. The preview card and the hints were checked in the browser preview in light and dark. Not yet checked live: the editable/read-only signal in real applications (ChatGPT's input versus its answers, Lark, Notes), which is the owner's first test.

## Follow-up: the circle replaced the text three times (same day)

In ChatGPT's input in Dia the owner got the masked sentence three times in a row, every copy with the same alias. One masking run on text that already held the sentence three times: Chromium's Accessibility API reported the input's selected text repeated. The circle now reads the exact selection at click time with the copy chord (an invisible marker on the clipboard first, the user's clipboard put back after), the same round trip ⌘⇧M uses. The Accessibility text only decides whether the circle shows and in which direction. If the copy chord yields nothing, the result goes to the clipboard instead of over the selection. Regression test: repeated Accessibility text with a single copied selection pastes the single masked sentence.

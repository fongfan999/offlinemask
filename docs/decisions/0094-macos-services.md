# 0094 — macOS Services: text from any app, files from Finder

Date: 18 October 2026. Status: requested by the owner ("we'll build Browser extension later, shall we build the 5 things"), item 4 of the convenience list in [0090](0090-clipboard-quick-actions.md).

## Behaviour

- **Text.** Select text in any macOS application, right-click (or the application menu) › Dịch vụ › "Ẩn thông tin bằng OfflineMask". The text goes through the same action as ⌘⇧M with a given text: ordinary text is masked, text with known aliases restored, and the result is put on the clipboard with the usual panel flash. Nothing is written back into the calling application: a Service that returns text would have to answer synchronously on the main thread, and the detector runs in the webview, which needs that same thread. Paste is one keystroke away; ⌘⇧M remains the in-place path.
- **Files.** Select one or more spreadsheets, Word documents, OpenDocument files, CSV or plain-text files in Finder › Dịch vụ › "Ẩn thông tin tệp bằng OfflineMask". OfflineMask comes to the front and opens the first file on its page exactly as if it had been dropped on the home page; with several files the panel says which one opened. Unsupported types get the home page's own message.

## How

- `src-tauri/Info.plist` declares the two `NSServices` entries (`NSPortName` OfflineMask, `NSMessage` maskText / maskFiles; text takes `public.utf8-plain-text`, files the UTIs of the supported formats). Tauri merges this file into the bundle's Info.plist, so the services exist only in a built `.app`, not under `tauri dev`; macOS registers them when the app is first launched (or `pbs -update`).
- `src-tauri/src/services.rs` (macOS only) defines the provider class with `objc2`'s `define_class!`, reads the string or the file URLs from the pasteboard AppKit passes in, and emits `quick-service` to the main window. The provider is installed with `setServicesProvider` during setup and kept for the process.
- File hand-over: the provider records the paths in `ServiceFiles`; the frontend reads each with `quick_read_service_file`, which serves a path once and only if a Service offered it, so the webview gains no general file access. The bytes become a `File` and go through the same routing as the home page (`src/core/file-kind.ts`, shared now) into the sheet, document or text flow.
- Dependencies: `objc2` 0.6.4, `objc2-foundation` 0.3.2, `objc2-app-kit` 0.3.2 (MIT, already in the tree through Tauri), pinned, macOS target only. Consulted: docs.rs for `define_class!`, `NSPasteboard` and `NSApplication::setServicesProvider`; the Tauri `bundle.macOS.infoPlist` note; Apple's Services keys.

## Privacy

Only the pasteboard AppKit hands to the provider is read, only when the user picks the menu item. The text path keeps the result in memory and on the clipboard like the shortcut; the file path reads the chosen files once. No other pasteboard, file or application state is touched. Windows and Linux have no equivalent for text; the file entry point there stays drag and drop.

## Toolchain note

The `tauri` crate had moved from 2.11.5 to 2.12.4 in the lockfile with the first quick-action commit (e8775bb; `cargo add` re-resolved it), while `@tauri-apps/api` and `@tauri-apps/cli` were still 2.11. `tauri build` refuses that mismatch, so both npm packages are now on the 2.12 line (api 2.12.4, cli 2.12.3), matching the crate. `tauri dev` had tolerated the mismatch, which is why it went unnoticed.

## Verified

`pnpm lint`, `pnpm typecheck`, `pnpm test` (274 tests), `cargo clippy -D warnings` and `cargo fmt --check` pass. A debug bundle (`tauri build --debug --bundles app`, separate target directory, WASM detection) carries both `NSServices` entries in its Info.plist. With that bundle running and a small Swift helper calling `NSPerformService` on a private pasteboard, synthetic data only:

- "Ẩn thông tin bằng OfflineMask" with "Khách Trần Thị B, SĐT 0912345678, mail b@example.com" returned true and left "… SĐT [SDT_1_1eda], mail [EMAIL_1_1eda]" on the general clipboard (the name needs the pack).
- "Ẩn thông tin tệp bằng OfflineMask" with a two-line CSV, while the main window was hidden, returned true; the window came back on screen and its accessibility tree showed the spreadsheet page on `service-test.csv` at step 1 ("Ẩn toàn bộ 1 dòng"). The app did not become the frontmost application in that run; the window was visible behind the caller.

Not covered: the Services menu itself (only the `NSPerformService` path), a release-signed bundle, and the first-launch registration delay macOS sometimes needs before new services appear.

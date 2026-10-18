# 0092 — Background mode: tray icon, hide on close, login item

Date: 18 October 2026. Status: chosen by the assistant when the owner asked "what to build next?" after [0090](0090-clipboard-quick-actions.md) and [0091](0091-in-place-replace.md), to be reviewed once finished. The quick actions only work while OfflineMask is running, and until now closing the window quit the app.

## Decisions

- **Tray / menu bar icon.** The app icon sits in the macOS menu bar (Windows and Linux: the system tray) with "Mở OfflineMask", "Ẩn thông tin trong clipboard", "Khôi phục trong clipboard" and "Thoát OfflineMask". The two clipboard items send the same `quick-command` event as the floating panel's buttons, so the frontend has one handler. On macOS a click opens the menu (the menu bar convention); on Windows and Linux a left click opens the window and a right click the menu. The icon is the coloured app icon; a monochrome template icon for the macOS menu bar is a follow-up.
- **Closing hides.** The main window's close request is intercepted in the frontend (`onCloseRequested`, decision in `useQuickActions`): the window hides, and the panel flashes "OfflineMask vẫn chạy nền: phím tắt và bảng nổi vẫn dùng được. Mở lại hoặc thoát hẳn từ biểu tượng OfflineMask ở thanh menu." (Windows and Linux: "khay hệ thống"). Quitting is the tray's "Thoát OfflineMask" or ⌘Q on macOS. A click on the dock icon reopens the window (`RunEvent::Reopen`), and so does the tray.
- **Khởi động cùng máy.** A checkbox in Cài đặt › Thao tác nhanh › Chạy nền, off by default and always read back from the OS. The login item starts the app with `--background`, which hides the main window during setup so nothing flashes at login; the shortcut and panel are ready at once. macOS uses a Launch Agent, Windows the registry run key, Linux an autostart desktop entry, all through the official plugin.
- **No preference for hide-on-close.** The panel notice explains it the first time, and the tray item is the way out. A "quit on close" option can come if people ask.

## Privacy

Nothing new leaves the machine and nothing new is stored: the login item is an OS setting, and `--background` only changes whether the window shows. The app keeps running after the window closes, which is the point; the tray item says so and offers the exit.

## Dependencies

- `tauri` feature `tray-icon` (core, already in the tree).
- `tauri-plugin-autostart` 2.7.0 and `@tauri-apps/plugin-autostart` 2.7.0 (official, MIT OR Apache-2.0), pinned. Capability: `autostart:allow-enable`, `allow-disable`, `allow-is-enabled`; the main window also gets `core:window:allow-hide` and `allow-show`.

Consulted: the Tauri 2 system-tray guide (`TrayIconBuilder`, `MenuItem::with_id`, `show_menu_on_left_click`, left-click handling) and the autostart plugin guide (`MacosLauncher::LaunchAgent`, launch arguments, permission identifiers).

## Code

`src-tauri/src/background.rs` (tray, `show_main`, `--background`), `lib.rs` (plugin init, hidden start, `Reopen`), the adapter's `onCloseRequested` / `hideMainWindow` / `launchAtLogin`, `useQuickActions().closeToBackground` and `setLaunchAtLogin`, the "Chạy nền" row in `QuickActionSettings.vue`.

## Verified

`pnpm lint`, `pnpm typecheck`, `pnpm test` (269 tests, 1 new), `cargo clippy -D warnings` and `cargo fmt --check` pass. On the macOS dev build, checked through the Core Graphics window list and System Events confined to the OfflineMask process: the menu bar shows a status item; clicking the window's close button hid the window, the process stayed alive, and the panel flashed the notice and hid again; clicking the app's Dock tile brought the window back and frontmost. The tray menu's own items could not be driven through System Events (the menu exposes no accessible items), so "Ẩn thông tin trong clipboard", "Khôi phục trong clipboard" and "Thoát OfflineMask" were not exercised live; they send the same event the panel's buttons do. "Khởi động cùng máy" was not toggled on the development binary, since the login item would point at `target/debug/offlinemask`. Windows and Linux were not run.

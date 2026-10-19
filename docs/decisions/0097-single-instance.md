# 0097 — One running copy: a second launch reopens the first

Date: 19 October 2026. Status: requested by the owner ("Yes, add the single-instance plugin so a second launch reopens the running app"), after asking how closing and quitting should work outside macOS.

## Why

Since [0092](0092-background-mode.md), closing the window leaves OfflineMask running in the tray (menu bar). On macOS, opening the app again only brings the running copy back, because LaunchServices sends the reopen event. On Windows and Linux nothing does that: opening it from the Start menu or a launcher starts a second process. That happens often, since Windows hides new tray icons in the overflow ("^") by default, and two copies would fight over the global shortcut and both write the vault.

## Behaviour

- Launching OfflineMask while it already runs ends the new process at once; the running copy shows its window (and, on macOS, its Dock icon) through `background::show_main`, the same path as the tray's "Mở OfflineMask".
- A second start with `--background` (the login item) changes nothing, so a login start never pops the window up.
- Closing and quitting are unchanged: the close button, Alt+F4 and ⌘W hide to the tray; ⌘Q on macOS and the tray's "Thoát OfflineMask" quit.

## Dependency

`tauri-plugin-single-instance` 2.5.4, pinned with `=` like the other Tauri plugins. Official Tauri plugin from [tauri-apps/plugins-workspace](https://github.com/tauri-apps/plugins-workspace), Apache-2.0 OR MIT, desktop targets only. Its only new crate in the lockfile is itself: it uses `zbus` on Linux and `windows-sys` on Windows, already in the tree. It is registered first in the builder, as its documentation requires. No network access: the copies talk through a local socket (macOS, Linux D-Bus) or a named mutex and window message (Windows).

## Checked

`cargo clippy -D warnings`, `cargo fmt --check`. macOS dev build: with the window hidden, running the binary again exited the new process and brought the first one's window back. Windows and Linux are not run here.

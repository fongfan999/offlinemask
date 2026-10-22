# 0122 — Windows: the circle's own click no longer clears the selection

Date: 22 October 2026. Status: found by a manual test of the 2.0.2 MSIX on a Windows 11 ARM VM (Notepad, Ẩn nhanh on, Ctrl+Shift+M on). Affects every Windows build since the selection popover ([0096](0096-selection-popover.md)).

## Problem

Selecting text in Notepad showed the OfflineMask circle, but clicking it changed nothing: the selection stayed as it was and the result never came back. Ctrl+Shift+M on the same selection replaced it at once.

The main window's log showed why. A click on the circle reached the main window as a command, but `pendingSelection` was already `null`, so `onCommand` fell back to the clipboard-only path: it read the clipboard (no copy chord, no paste) and acted on whatever was there.

The selection had been cleared by the Windows mouse hook. On every left-button press outside OfflineMask's windows it emits `selection-cleared`, and `own_window` decided "outside" by comparing the process of `WindowFromPoint` with ours. Under the pointer, though, is WebView2's render child (`Chrome_RenderWidgetHostHWND`), owned by `msedgewebview2.exe`; only its top-level window ("Tauri Window") belongs to OfflineMask. A click on the circle therefore counted as a click elsewhere and cleared the selection a moment before its own command arrived. For the same reason, selecting text inside OfflineMask's own window showed the circle there.

## Decision

`own_window` takes the root window first (`GetAncestor(…, GA_ROOT)`) and compares that window's process. Clicks on the circle, the panel and the main window are now OfflineMask's own again: they keep the pending selection, and selections inside OfflineMask get no circle.

The shortcut path was unaffected because it reads the selection itself instead of relying on the pending one.

## Not changed

macOS uses an event monitor that already knows its own windows. Nothing about what is observed changes: still left-button presses and releases only, no keys (see `landing/privacy.html`).

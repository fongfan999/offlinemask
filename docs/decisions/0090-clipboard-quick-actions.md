# 0090 — Clipboard quick actions: one shortcut and a floating panel

Date: 18 October 2026. Status: requested by the owner. Watching how people use the app ("open the app, ask AI and open the app again to restore, it's not healthy"), the owner asked for something closer to the small toolbar that appears next to selected text in chat apps, and accepted the recommendation below: a global shortcut plus an always-on-top panel first, the selection-anchored popover later.

## Why not a popover next to the selection

Showing a button beside text selected in another application needs that platform's accessibility API to find the selection and its rectangle (macOS Accessibility permission, Windows UI Automation, nothing reliable on Linux), and Electron apps such as Lark often report no selection at all. It is a later, macOS-first experiment. The two features below need no OS permission beyond the app's own window and the system clipboard, and they work the same on all three platforms.

## Decisions

- **One shortcut, two directions.** `⌘⇧M` (`Ctrl+Shift+M` elsewhere) reads the text on the clipboard, decides what it is and writes the result back:
  - ordinary text is masked with the text page's detector (the categories chosen there; the built-in ones while the pack is missing), and the masked copy replaces the clipboard;
  - text holding aliases of a session seen in this launch is treated as an AI reply and restored, exactly like the restore step (PRD FR-09): only known aliases change, alias-shaped tokens from no known session are left in place and counted;
  - alias-shaped tokens with no known session, an empty clipboard, a locked app, a run already in flight and text over 50 000 characters each give a message and change nothing.

  The flow is copy, shortcut, paste. The app does not press ⌘C or ⌘V for the user: synthesising key events would need the Accessibility permission on macOS and is the kind of hidden input handling this product promises not to do. Each quick mask creates a text session like any other, so it shows in history with a passcode and can be reviewed and corrected on the text page.
- **Floating panel.** Cài đặt › Thao tác nhanh › "Bảng nổi" keeps a 336 × 124 always-on-top window with "Ẩn thông tin" and "Khôi phục" for the clipboard and a one-line outcome. It starts in the bottom-right corner of the primary screen, can be dragged by its header and remembers where it was left. Its close control turns the preference off. Whether or not it is kept, every shortcut result flashes in it for a few seconds, so the user sees what happened without leaving the chat window. The window is not transparent (macOS transparency needs the private API) and does not take focus, so the AI chat keeps the cursor.
- **Settings.** A new "Thao tác nhanh" card between the passcode and app cards: the shortcut (on by default on desktop, with the failure text when another app holds the combination) and the panel (off by default), each one checkbox. The last outcome is repeated under them. The browser preview shows the card disabled with "Chỉ có trên ứng dụng máy tính."
- **Restoring after the screen moved on.** Without a passcode the text page keeps one screen ([0072](0072-one-screen-without-history.md)), so a second quick mask would have lost the first text's alias table. The quick actions keep the alias table of every private session seen in this launch in memory only; it goes when the app closes, and a session the user deletes from history is forgotten at once. Aliases carry a per-session scope, so one lookup across all tables is unambiguous.

## Privacy boundary

The PRD listed "clipboard interception" as deferred. This feature is not that: the clipboard is read only at the moment the user presses the shortcut or a panel button, nothing watches or polls it, and nothing is written anywhere but back to the clipboard and the normal in-memory session (the vault, with a passcode). The PRD wording is amended to say so. The capability files grant the main window `clipboard-manager:allow-read-text`, `allow-write-text` and the three `global-shortcut` commands; the panel window may only show, hide, move and drag itself, follow the theme and exchange the two events with the main window.

## Dependencies

- `tauri-plugin-global-shortcut` 2.4.1 and `@tauri-apps/plugin-global-shortcut` 2.4.1 (official Tauri plugin, MIT OR Apache-2.0; desktop targets only). The shortcut string is Tauri's `CommandOrControl+Shift+M`.
- `tauri-plugin-clipboard-manager` 2.5.0 and `@tauri-apps/plugin-clipboard-manager` 2.5.0 (official, MIT OR Apache-2.0; built on `arboard`). Plain text only; reading an empty or non-text clipboard is treated as empty.

Both are pinned exactly like the dialog and fs plugins. Consulted: the Tauri 2 global-shortcut and clipboard plugin guides, the window customisation guide, and the `WindowConfig` and permission schemas shipped with the installed CLI (`macOSPrivateApi` for transparency, `acceptFirstMouse`, `visibleOnAllWorkspaces`, `core:window:allow-*` identifiers).

## Code

- `src/core/quick-actions.ts`: direction, cross-table restore and the Vietnamese outcome lines; `restore.ts` exports `aliasTokens`.
- `src/composables/useQuickActions.ts`: preferences, the in-memory alias tables, one `act()` for shortcut and panel, registration; `useMaskingRun().maskText` masks text that did not come through the draft and shares `detectSession` with the draft path.
- `src/adapters/quick-actions.ts`: the only module that talks to the two plugins and the inter-window events; `PillApp.vue`, `pill.ts` and `pill.html` are the panel (a second Vite page), `QuickActionSettings.vue` the card.
- `src-tauri`: both plugins registered in `lib.rs`; the `pill` window and the `pill` capability.

## Verified

`pnpm lint`, `pnpm typecheck`, `pnpm test` (266 tests, 8 new) and `cargo check --locked` pass. In the running macOS dev build, with synthetic text only: copying "Khách Nguyễn Văn A, SĐT 0901234567, email test.user@example.com" and pressing ⌘⇧M left "… SĐT [SDT_1_15c8], email [EMAIL_1_15c8]" on the clipboard (the name needs the pack); copying a reply with those aliases and a foreign `[SDT_1_dead]` and pressing ⌘⇧M restored the two known values and kept the foreign token. The Settings card and the panel page were checked in the browser preview in dark mode, at desktop and phone width.

Floating window, checked through the Core Graphics window list of a fresh dev launch (macOS, Apple silicon): the hidden panel moved itself to the bottom-right corner at start, came on screen within 1.5 s of a shortcut press, hid again after the flash, and came back on the next press; the same held when the window was started visible. One earlier dev instance that had been hot-reloaded through the edits while they were being written never showed the panel and could not be reproduced after a fresh launch. The panel's own buttons (panel → main window) were exercised in the unit tests only: a synthetic click on the non-focusable window could not be placed reliably and was not retried. Windows and Linux were not run.

# 0137 — Tray without clipboard actions, no file install, updates by the homepage

Date: 24 October 2026. Status: implemented. The Settings parts and the badge were checked in the Vite preview, and the frontend tray logic is covered by `pnpm test`. The native tray menu was compiled in CI but not opened on a machine. Owner's review before the Microsoft Store submission:
- tray: "Remove this completely, we don't rely on clipboard which will create unexpected behaviors" (the two clipboard items); yes to an Ẩn nhanh check item and a Cài đặt item;
- "remove the file installation option";
- updates: "improve this section by asking them to visit the homepage to check the version";
- "the text in the badges (coming soon) aren't aligned center".

## Decision

### Tray menu

The menu now reads "Mở OfflineMask", "Cài đặt…", then a check item "Ẩn nhanh khi bôi đen", then "Thoát OfflineMask".

- **Clipboard items removed.** "Ẩn thông tin trong clipboard" and "Khôi phục trong clipboard" are gone. They acted on whatever happened to be on the clipboard, out of sight, which is the unexpected behaviour the owner does not want. The circle and ⌘⇧M act on the selection.
- **Ẩn nhanh check item.** It replaces "Bật Ẩn nhanh…" ([0098](0098-quick-discovery.md)), which appeared only while the feature was off and only opened Cài đặt.
  - Its mark mirrors whether Ẩn nhanh works (`quickReady`). The frontend sets it through `quick_tray_state` whenever that changes.
  - A click sends `toggle-quick`, which switches the feature off or on. Without the macOS Accessibility permission it opens Cài đặt, where the permission is granted.
  - The menu toggles the mark by itself on a click, so the frontend sets it again from the real state afterwards.
  - The item is disabled where selections cannot be read (Linux).
- **"Cài đặt…"** sends the existing `settings` command, which opens the window on Cài đặt.

### Settings

- **No "Cài từ tệp".** The placeholder for installing the pack from a downloaded file is removed, with its disabled button and "Sắp có" badge. The pack is installed by "Tải về".
- **Updates.** The disabled "Kiểm tra cập nhật" and its "Sắp có" badge are replaced by "Mở OfflineMask.com". It opens the homepage in the browser on click, the one link the app may open (`opener:allow-open-url`). The text says the app never connects by itself, so it does not announce new versions, and asks people to open OfflineMask.com now and then to compare the newest version with theirs. This supersedes the 10 September direction of a future in-app check. The no-automatic-network rule is unchanged.

### "Sắp có" badge

The capitals sat high and slightly left. The line box kept room below the baseline that capitals never use, and the 0.08em letter-spacing trailed the last letter. The badge now trims its line box to cap height and baseline (`text-box: trim-both cap alphabetic`, supported by WebView2 and current WebKit), uses equal top and bottom padding, and gives the trailing letter-spacing back on the right.

Nothing here changes a privacy fact. The tray now reads the clipboard in no case, and the homepage opens only on the user's click.

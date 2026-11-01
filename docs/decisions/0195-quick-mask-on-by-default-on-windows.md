# 0195 — Ẩn nhanh is on by default on Windows

Date: 1 November 2026. The owner: "quick masking should be turned on by default when the app doesnt need a permission like Mac, ie: Windows".

## Decision

Ẩn nhanh ([0096](0096-selection-popover.md)) was opt-in everywhere. On macOS that stays: the feature needs the Accessibility permission, and asking for it is the user's step ([0098](0098-quick-discovery.md)). Windows reads a selection through the system's UI Automation and asks for nothing, so there the switch now starts on.

- `useQuickActions` reads `offlinemask.quick-popover.v1` with a fallback of `platform === "windows"` instead of `false`. A stored choice, on or off, still wins, so whoever turned it off keeps it off.
- Linux has no selection backend, so the fallback is moot there; it stays off.
- Nothing else changes: the circle still shows only in the AI places ([0135](0135-circle-only-where-ai-is.md)), the tray's check item mirrors it ([0137](0137-tray-and-settings-cleanup.md)), and home's "Bật Ẩn nhanh" line and the one-time card no longer appear on Windows because the feature already works.

## Privacy page

`landing/privacy.html` §5 says the circle is on from the start on Windows and turned on by the user on macOS; its date moves to 1 November 2026.

## Checked

A test in `desktop/tests/quick-actions.test.mjs` starts the composable with empty storage on Windows (on and working), on macOS with and without the permission (off), and on Windows with a stored "off" (off).

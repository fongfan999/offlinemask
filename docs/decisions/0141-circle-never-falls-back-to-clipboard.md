# 0141 — The circle never falls back to the clipboard

Date: 25 October 2026. Status: implemented; covered by `pnpm test`. Found while verifying the Microsoft Store install of 2.1.1. Owner: "Remove the clipboard fallback for the circle so a click without a pending selection does nothing, with a test."

## Problem

A "mask" or "restore" from the circle with no pending selection went to `act(command)`, which read the clipboard and masked (or restored) whatever was on it. The fallback dated from the tray's "Ẩn thông tin trong clipboard" and "Khôi phục trong clipboard". [0137](0137-tray-and-settings-cleanup.md) removed those items, because acting on the clipboard out of sight is unexpected behaviour. Since then the only sender is the circle, so the fallback ran only for a click on a circle whose selection was already gone.

That is what happened during the test. Windows Search came to the front, the poller cleared the selection, and the circle was dismissed. A click that still reached it masked the clipboard, a Microsoft Store link with "VN" hidden as an address, and replaced it with the masked copy.

## Decision

A circle command acts only on the selection it was shown for. With none pending, it dismisses the panel and does nothing else. The clipboard is not read, written or masked.

- ⌘⇧M is unchanged: it reads the selection and does nothing without one.
- The macOS Services pass their own text.
- The selection path, with its borrowed-and-restored clipboard for the paste ([0130](0130-quick-actions-borrow-the-clipboard.md)), is unchanged.

The popover test now ends with a click after the selection was cleared, and checks that nothing is detected, nothing is written to the clipboard and the panel is dismissed. It fails against the old fallback.

# 0127 — Paste only over the selection that was masked

Date: 23 October 2026. Status: reported by the owner on macOS: while the circle's masking ran, switching to another application and selecting text there made the result replace that new text instead of the text that had been masked.

## Problem

The in-place path ([0091](0091-in-place-replace.md), [0096](0096-selection-popover.md)) copies the selection, masks it, then sends the paste chord to whatever application is in front. Masking takes from a fraction of a second (native) to several seconds (WASM, a cold start, a long text). Anything the user did in that time decided where the paste landed: another application, another selection, or a field with the caret somewhere else.

## Decision

Before masking starts, the selection is read through Accessibility (macOS) or UI Automation (Windows), the same read ⌘⇧M uses. Right before the paste it is read again, and the paste is sent only when both reads agree. This check does not touch the clipboard. In applications that report no selection this way, the selection is copied once more instead, with the same marker round trip as the first read, and must equal the masked text.

When the selection changed, nothing is pasted and the result does not go to the clipboard: the user's own clipboard is put back, and the masked text opens in the preview card titled "Vùng chọn đã đổi", in the top-right corner of the screen rather than beside the circle: the user has moved on from that spot (owner, 23 October). Its buttons copy the result or open its session, so the user decides where it goes (owner, 23 October: "don't overuse the clipboard, just show a popup and let users decide").

Read-only text never pastes: its masked copy always opens in the preview card ([0096](0096-selection-popover.md)). That card follows the same rule: when Accessibility reports another selection after masking than before, it opens in the top-right corner rather than beside the circle.

Restoring stays as it was: it runs from tables in memory, with no wait in which the selection could change.

## Limits

The check compares text, not the application. If the user selects the very same text somewhere else while masking runs, the result replaces that copy, which holds the same values.

`landing/privacy.html` describes the check, the fallback copy and the preview.

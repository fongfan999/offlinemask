# 0127 — Paste only over the selection that was masked

Date: 23 October 2026. Status: reported by the owner on macOS: while the circle's masking ran, switching to another application and selecting text there made the result replace that new text instead of the text that had been masked.

## Problem

The in-place path ([0091](0091-in-place-replace.md), [0096](0096-selection-popover.md)) copies the selection, masks it, then sends the paste chord to whatever application is in front. Masking takes from a fraction of a second (native) to several seconds (WASM, a cold start, a long text). Anything the user did in that time decided where the paste landed: another application, another selection, or a field with the caret somewhere else.

## Decision

Right before the paste, the selection is copied once more, with the same marker round trip as the first read. The paste is sent only when that copy is exactly the text that was masked. Otherwise nothing is pasted: the masked text stays on the clipboard and the panel says "Đã ẩn n thông tin · vùng chọn đã đổi nên chưa thay, dán để dùng".

The check costs one copy chord (about 0.2 s) per in-place mask. Restoring stays as it was: it runs from tables in memory, with no wait in which the selection could change.

## Limits

The check compares text, not the application. If the user selects the very same text somewhere else while masking runs, the result replaces that copy, which holds the same values.

`landing/privacy.html` now describes the second copy and the refusal to paste over a different selection.

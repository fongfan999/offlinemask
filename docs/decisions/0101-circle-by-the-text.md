# 0101 — The circle sits by the text, even when an app only reports its field

Date: 19 October 2026. Status: reported by the owner with two screenshots (ChatGPT in Dia, Zalo): "why isnt the circle placement consistent, it's supposed to be around the text".

## Cause

The circle is placed over the end of the selection's rectangle ([0096](0096-selection-popover.md)). macOS gives that rectangle through `AXBoundsForRange` or `AXBoundsForTextMarkerRange`. Probed on the owner's machine, Dia (Chromium) answers both for a selection in ChatGPT's message box with **empty rectangles** (`(0, 982, 0×0)` and `(6, 81, 0×0)`), and setting `AXManualAccessibility` does not change that (`AXEnhancedUserInterface` is not supported). Zalo (Electron) behaves the same way. The code then fell back to the frame of the whole field and put the circle over its right end, far from short text.

## Decision

The native side now says where its rectangle came from and how the selection was made (`field`, `mouse` on the selection event, macOS and Windows alike). The anchor is chosen in one tested place (`selectionAnchor`):

- the selection's own rectangle when the application gives one (native text views, WebKit): unchanged;
- read-only text: the pointer, unchanged;
- only the field's frame, selected with the mouse: the point where the button came up, which is the end of the drag;
- only the field's frame, selected with the keyboard (⌘A, Shift with arrows, ⌘⇧M), or a drag that ended outside the field: the start of the field's first line, top-left, where the text begins, instead of the field's far end.

## Checked

`pnpm test` (299, the anchor rule for each case), `pnpm typecheck`, `pnpm lint`, `cargo clippy -D warnings`, `cargo fmt --check`; the Windows backend type-checked against `x86_64-pc-windows-msvc` in a scratch crate.

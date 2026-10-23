# 0132 — Web editors that Accessibility does not call editable

Date: 23 October 2026. Status: reported by the owner: in Zalo's message box the circle sometimes replaced the text and sometimes opened the "Đã ẩn" card, and the circle did not sit by the text.

## Finding

A temporary log (lengths and flags only) over five attempts showed every selection in Zalo reported as **not editable**, so the click took the read-only path: the masked copy in the card, and the circle by the pointer instead of the text. The copies themselves were fine.

Zalo (Electron) exposes its message box as a focused `AXGroup` (`id=richInput`, class `rich-input`) on which nothing is settable: not `AXValue`, `AXSelectedText` or `AXSelectedTextRange`, and no `AXEditableAncestor`. Its `AXValue` is empty while `AXSelectedText` holds the selection. In Chrome a contenteditable is an `AXTextArea` with `AXSelectedText` settable, so the old test held there. Read-only web text leaves focus on the page itself (`AXWebArea`).

The empty `AXValue` would also have defeated [0131](0131-circle-speed.md)'s paste confirmation, which compared the value before and after.

## Decision

- A focused `AXGroup`, `AXTextArea` or `AXTextField` inside web content (it answers text markers), with `AXFocused` settable and true, counts as editable. Read-only text, where focus stays on the `AXWebArea`, is unaffected.
- A paste has landed when the focused element's value **or its selection** changed; a paste collapses the selection. When neither changes within 400 ms, the result opens in the preview card. So a wrong editability guess costs one paste that does not land, never a false check mark.

## Verified

Zalo, five attempts after the change: every selection editable, every paste confirmed within about 30 ms. Chrome on a test page: a contenteditable still replaced with the clipboard restored; read-only text still opened the card with no paste attempted.

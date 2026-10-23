# 0133 — Windows confirms a paste through UI Automation

Date: 23 October 2026. Status: follow-up to [0131](0131-circle-speed.md) and [0132](0132-web-editors-accessibility-misses.md), which were verified on macOS only.

## Problem

On Windows, `quick_replace_selection` counted a paste as done once the Ctrl+V chord was sent. Chrome was seen on macOS to take the paste chord and insert nothing (0131); on Windows that would show the check mark over unchanged text. And the Windows editability test, a value pattern that is not read-only, would miss the same web editors that 0132 found on macOS, sending them to the preview card.

## Decision

- **A paste must show.** `selection_windows::focused_state` returns the focused element's value (value pattern) and selected text (text pattern), like its macOS namesake. `quick_replace_selection` compares it before and after the chord, every 25 ms for at most 400 ms; when neither changed, the paste counts as dropped and the result opens in the preview card. A paste collapses the selection, so the selected text changes even where the element has no value pattern. When the focused element offers neither pattern (or belongs to OfflineMask), nothing can be seen and the chord is trusted, as before; the circle only offers an in-place replace where a text pattern answered, so this covers mainly Ctrl+Shift+M in applications without UI Automation.
- **Bounded waits.** Each look sets UIA's transaction timeout to 200 ms (`IUIAutomation2`), so a hung application cannot hold the paste for UIA's default 20 s.
- **Editable by the text itself.** A selection is also editable when its text range reports `UIA_IsReadOnlyAttributeId` = false. Chromium sets that attribute from the editable state of the text (contenteditable, including editors that expose no value pattern), Word from the document; read-only web text reports true and stays on the read-only path. A mixed or unsupported answer counts as not editable. As on macOS, a wrong guess now costs a paste that does not land, never a false check mark.
- **Clipboard guard, Windows half** (reviewed; it had only been type-checked):
  - When the clipboard cannot be opened to save it (another application holds it for 200 ms), the restore now leaves it alone. Before, the empty save was "restored" by emptying the user's clipboard.
  - Formats `0x200`–`0x3FF` (`CF_PRIVATEFIRST` to `CF_GDIOBJLAST`) are skipped like the GDI formats: they are handles meaningful only to their owner, not memory blocks.
  - The restored clipboard carries the same three markers as OfflineMask's own writes, so putting the user's copy back does not add a second Win+V history entry or a clipboard-manager record.

macOS is unchanged. No privacy fact changes: the focused field is read only while handling the user's click or shortcut, and nothing is stored.

## Verified

Type-checked and clippy-clean for `x86_64-pc-windows-msvc` in an isolated scratch crate (offline, `windows` =0.62.2 with `Win32_System_Variant` added, stub `tauri`, `enigo` and `selection` modules), as in [0130](0130-quick-actions-borrow-the-clipboard.md). Not run on Windows. To check on the Windows VM, each with an image on the clipboard first and a text with a phone number selected:

| Where | Expect |
| --- | --- |
| Notepad | circle click replaces; the image is back on the clipboard |
| Chrome and Edge, a `<textarea>` | replaces; image back |
| Chrome and Edge, a rich editor (ChatGPT's box, Gmail compose) | circle sits by the text; replaces; image back |
| Chrome, read-only page text | preview card, no paste attempted; image back |
| Zalo message box | replaces (not the card); image back |
| Word | replaces; image back |
| Win+V history | no entry for the masked text, the empty marker or the restored image |

A replace that shows the card where it should have replaced means the confirmation missed the change (the field updated after 400 ms, or UIA reported neither value nor selection); a check mark over unchanged text means the opposite. Either is worth a note of the application.

## Limits

Vector-only clipboard images (`CF_ENHMETAFILE` without a bitmap or PNG alongside) are still not saved. Formats an application renders on demand are rendered while saving, which can take a moment for large Excel copies.

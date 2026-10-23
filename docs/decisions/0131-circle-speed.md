# 0131 — The circle answers at once, and its click reuses the check

Date: 23 October 2026. Status: reported by the owner: "Mask on the app is fast, but via the circle is slow", and the circle appearing only after its 1.5 s check made users think it did not work.

## Measured

On the owner's Mac (`pnpm desktop:dev`, WASM recognition), timed from outside the app:

| | Before | After |
| --- | --- | --- |
| TextEdit, ⌘A → circle | 2.9 s, or none | 0.6 s (1.0 s for names only) |
| TextEdit, click → replaced | never finished | 0.2 s |
| Chrome rich editor, ⌘A → circle | — | 0.6–0.7 s |
| Chrome rich editor, click → replaced | silently not replaced | ≤ 0.4 s, 3 of 3 |

About 0.2 s of each circle time is the test script's own keystroke.

## Why the circle path was slow

1. A keyboard selection was noticed by a 450 ms poll and announced after holding still for one look.
2. The circle waited for the full model check, up to 1.5 s, even when the built-in rules already knew the answer.
3. Every selection started a model check; checks queued, so a click waited behind stale ones. The churn also grew the WASM page until WebKit killed it ([0128](0128-webkit-kills-the-wasm-page.md)): 7.2 GB at 19:35.
4. The click reused the check only for the identical text. Chromium's Accessibility text drops line breaks that its copy keeps, so the click ran the whole detection again.
5. The paste waited 500 ms for the clipboard restore before reporting.

Masking on the Text page has none of these: it runs one detection when asked.

## Decision

- **Rules first.** When the built-in rules find a phone number, an email, an account or ID number, the circle shows at once. Every full detection keeps what the rules find, so the circle cannot promise something the click will not hide. The model check still starts, for the click.
- **One check at a time.** The detector runs one request at a time; a selection replaced before its turn is never checked, and a click waits for the check in flight instead of queueing behind it.
- **Reuse across whitespace.** When the click's exact text differs from the checked text only in whitespace, the check's spans are carried over character for character (`core/detection/carry.ts`), and the built-in rules run again on the exact text, since a line break can change what they match. Any other difference runs a fresh detection.
- **Faster keyboard selections.** The poll is 250 ms.
- **The paste reports at once.** The clipboard restore after a paste runs in the background; the next copy or paste waits for it.

## Chrome dropped pastes

With the click now fast, Chrome took the paste chord (`beforeinput: insertFromPaste`) and then inserted nothing, while the app showed its check mark. Replaying the clipboard sequence outside the app: when the clipboard was put back between Chrome's own copy and the paste, Chrome dropped the paste in 2 of 3 runs; without that restore, 3 of 3 landed. The old flow only worked because a full detection sat between the two.

- A copy that a paste will follow keeps the clipboard borrowed until that paste and puts it back once, afterwards; when no paste comes (nothing found, the selection moved, the preview), `quick_release_clipboard` puts it back, and a 20 s limit does if nothing else does. The user's clipboard is still never left changed, but during a long mask it holds the copied selection.
- On macOS a paste must show in the field's Accessibility value within 400 ms; otherwise it counts as dropped and the result opens in the preview card, instead of a check mark over unchanged text.

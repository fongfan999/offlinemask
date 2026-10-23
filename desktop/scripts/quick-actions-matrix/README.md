# Ẩn nhanh matrix

A release check, run by hand on the owner's Mac: the Ẩn nhanh circle (decisions [0096](../../../docs/decisions/0096-selection-popover.md), [0127](../../../docs/decisions/0127-paste-only-over-the-masked-selection.md), [0130](../../../docs/decisions/0130-quick-actions-borrow-the-clipboard.md)–[0132](../../../docs/decisions/0132-web-editors-accessibility-misses.md)) in each application that matters, timed from outside the app. It is not part of CI: it needs a logged-in GUI session and Accessibility.

For every application in [`apps.mjs`](apps.mjs) that is installed, the matrix opens a window of its own with synthetic text (a name, a phone number, an email, an address; none real), selects the text the way a user would (⌘A, or a triple-click on read-only text), waits for OfflineMask's circle, clicks it and reports:

| Column | Meaning |
| --- | --- |
| Circle | selection keystroke or click → the circle on screen, held still at its spot |
| Result | click → the field's text changed (`replaced`) or the preview card showed (`preview`) |
| Outcome | `replaced`, `preview`, `nothing` (neither within 6 s), `no-circle`, or `error` |
| Stray paste | on the test page, a `paste` or `insertFromPaste` event outside the field, or any paste over read-only text; elsewhere, the field changed although it was not replaced |
| Masked | the replaced text no longer holds the sample's phone, email or name |
| Clipboard back | a generated image put on the clipboard before the case is there again afterwards (within 4 s, since the restore runs after the paste) |

A row passes when the outcome is the expected one, nothing pasted astray, the replacement is masked and the clipboard came back. The run exits non-zero when any row fails.

## Applications

| App | What the matrix opens | Fields |
| --- | --- | --- |
| TextEdit, Word, Pages | a temporary `.rtf` (RTF keeps Vietnamese intact without an encoding prompt) | the document |
| Notes | a new note titled `OfflineMask matrix <time>` | the note |
| Safari | a new window on [`test-page.html`](test-page.html) | textarea, input, contenteditable, read-only text |
| Chrome | a **separate** Chrome on a throwaway `--user-data-dir` in a temp folder, on the same page | the same four |
| Zalo, Messenger, Telegram, Lark | nothing: the owner opens a test conversation | the message box |

Applications that are not installed are listed as skipped. Afterwards the matrix closes the documents and windows it opened (without saving), quits its own Chrome, and deletes its notes, which go to Notes' Recently Deleted; it never closes anything else. Word or Notes stay running if the matrix started them.

**Chat apps.** The matrix never chooses a conversation. For each chat app it stops and asks the owner to open a test conversation (or a note to self), click in its message box and press Enter in the terminal (`s` skips). It then pastes the sample into that box, runs the case, and empties the box with ⌘A and Delete; it checks before each step that focus is still in the same box and does nothing otherwise. It never sends Return. Without a terminal to ask (stdin not a TTY), chat apps are skipped; `--no-chat` skips them outright.

Web pages are read through Accessibility. Chromium builds that tree only when asked, so the matrix sets `AXManualAccessibility` and `AXEnhancedUserInterface` on the browser or Electron app ([0126](../../../docs/decisions/0126-chromium-accessibility-tree.md)) and waits a couple of seconds.

## Running it

1. Start OfflineMask with Ẩn nhanh on: the installed release, or the development app at release speed:

   ```bash
   mise exec -- pnpm -C desktop desktop:dev:native
   ```

   Both show windows owned by `OfflineMask` (the bundle name, and the `OfflineMask` binary under `target/debug`); `--owner <name>` overrides it.

2. Give the terminal you run from Accessibility (System Settings › Privacy & Security › Accessibility). The helper is a command-line tool, so the permission is the terminal's.

3. In another terminal:

   ```bash
   mise exec -- pnpm -C desktop quick-actions:matrix
   ```

   Options: `--apps TextEdit,Chrome` (names from `apps.mjs`), `--runs 3` (each field again on fresh text), `--no-chat`, `--out <dir>`, `--list` (what is installed, then stop).

Do not touch the mouse or keyboard while it runs: it moves the pointer and sends ⌘A and clicks. It prints each case as it goes, then the Markdown table, and writes `report.md` and `report.json` (every field the helper measured, including the circle's and card's window bounds) to `desktop/artifacts/quick-actions-matrix/<time>/`, which is not committed.

The first run compiles [`helper.swift`](helper.swift) with `swiftc -O` into `desktop/artifacts/quick-actions-matrix/bin/`; it is rebuilt whenever the source changes. The helper does each timed step itself (polling `CGWindowList` every 15 ms), so no process start sits inside a measurement. About 10–20 ms of each circle time is the synthetic keystroke.

## How it recognises things

- **The circle** is an on-screen `OfflineMask` window under 80 × 80 points. The pill window shrinks to the circle before moving to the selection, so the circle counts once it has held the same spot for 60 ms; the reported time is when it reached that spot.
- **The preview card** is that window at least 200 × 100 points (the hover hint beside the circle stays shorter).
- **Replaced** means the watched field's Accessibility value (or, for web editors whose value is empty, its text) changed. After the outcome the matrix waits 1.2 s more and reads the field again, so a late paste still shows.
- After clicking, the pointer is moved off the circle's spot, so the next circle does not open under it as the hover hint.

## Adding an application

Add an entry to `apps.mjs` with its bundle identifiers and one of the kinds above. A native app that opens RTF is a `document`; an app with its own text views that cannot open a file needs an opener in `run.mjs` (see `notes`), and must close only what it opened. A chat-like app is a `chat` and is only driven after the owner's confirmation.

## Limits

- Outside the test page a paste that lands in a different field than the watched one is not seen.
- The chat path (paste into a confirmed message box, then empty it) was written without a run against a real chat app; check its first report row by eye.
- The sample is one line. Multi-line text in rich editors (0131's line-break carry-over) is not covered yet.

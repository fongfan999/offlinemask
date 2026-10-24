# 0135 — The circle shows only where an AI is

Date: 24 October 2026. Status: implemented on macOS and Windows; Windows was type-checked but not run. Owner asked "what's the point of showing it in non-AI apps like Zalo or Word? is that convenient or annoying?", then: "for the browsers, only AI hosts … a default list, users can add/remove (mostly users should not do anything, the app should be set up smartly)", "when typing something in the URL bar and naming files, of course we should not show", and after the probe below: "treat Chromium browsers like Chrome and leave Firefox off the default list until probed. Go ahead and implement 0135 on macOS.", then "should apply the same cross platforms, I also want to know the app list".

## Problem

Since [0100](0100-circle-same-detection.md) the circle appears in every application whenever detection finds a value, and since [0131](0131-circle-speed.md) it appears at once when the built-in rules find a phone number or an email. Outside AI tools that is mostly noise, and sometimes the wrong offer:

- **The reader is a person.** A Zalo message or a Word document goes to someone who needs the real phone number. Masking it in place breaks the message, or leaves a document full of codes to restore.
- **It fires on the most common selection.** People select a customer's phone or email in Zalo, Mail or Excel all day to copy it into a CRM, a call or an invoice. That is exactly what the rules recognise first.
- **The "start in Word" route is the long way.** Select in Word, mask, copy, paste into ChatGPT, restore in Word is more work than pasting into ChatGPT and masking there, where the circle already works.
- **Browsers are all or nothing.** From the application alone, ChatGPT in Chrome looks the same as a bank's site in Chrome.

## Decision

### Where the circle appears

The circle appears by itself only in an **AI place**:

- an AI desktop application, matched by its bundle identifier (macOS) or its executable name, lowercased (Windows);
- a page on an AI host in a known browser, matched by the host of the page's address (`chatgpt.com`, also its subdomains, never `notchatgpt.com`).

Everywhere else the selection is **not read at all**. The mouse path and the keyboard poller first check the front application: neither a listed AI application nor a known browser, and nothing is asked of it (`may_look`). Then the focused element's ancestors are walked for the page's address and for a dialog, and one shared rule (`spot_for` in `selection.rs`) decides; off the list, the selected text is not read.

- **macOS** (`selection_macos.rs`): the frontmost application's bundle identifier; the outermost `AXWebArea` above the focused element, the tab's own page, and its `AXURL`.
- **Windows** (`selection_windows.rs`): the foreground window's process, through `QueryFullProcessImageNameW`, before UI Automation is touched; then the focused element's own process, and the outermost element of the Document control type above it, whose value pattern holds the page's address in Chromium. Only an `http` value counts as an address.

**⌘⇧M keeps working in every application**, for masking and restoring (`quick_read_selection` reads without the gate). It is deliberate, so it is never in the way, and it covers the received Zalo message or the Word passage someone does want to take to an AI. Restoring codes outside the AI places (pasting an AI's answer into Word) also goes through ⌘⇧M.

### Never, even in an AI place

- **Address and search bars.** No page above the focused element means no circle. The role cannot decide it: Dia's address bar is an `AXTextArea`, like ChatGPT's composer.
- **Naming files.** On macOS a focused element inside an `AXSheet`, or in a window whose subrole is `AXDialog` or `AXSystemDialog`; on Windows one inside the common dialog class `#32770` (open, save, folder picker). Never in any application. Finder and Explorer are not AI places, so renaming there is already excluded.
- Password fields and this app's own windows, as before.

### The list

The defaults are data, `desktop/src/core/ai-places.json`, read by `core/places.ts`, which picks the platform's identifiers from the user agent. The AI sites are shared; applications and browsers are per platform.

**AI applications**

| Name | macOS bundle identifier | Windows executable |
| --- | --- | --- |
| ChatGPT | `com.openai.chat`, `com.openai.codex` | `chatgpt.exe` |
| Claude | `com.anthropic.claudefordesktop` | `claude.exe` |
| Perplexity | `ai.perplexity.mac` | `perplexity.exe` |
| Cursor | `com.todesktop.230313mzl4w4u92` | `cursor.exe` |
| Windsurf | `com.exafunction.windsurf` | `windsurf.exe` |

Confirmed on the owner's Mac: ChatGPT (it reports `com.openai.codex`) and Claude. The rest are their published identifiers, not seen here. Copilot and Gemini have no entry until their identifiers are confirmed.

**AI sites** (both platforms, with subdomains): chatgpt.com, chat.openai.com, claude.ai, gemini.google.com, aistudio.google.com, notebooklm.google.com, copilot.microsoft.com, m365.cloud.microsoft, perplexity.ai, chat.deepseek.com, grok.com, chat.mistral.ai, chat.qwen.ai, kimi.com, poe.com.

**Browsers whose page address is read**

- macOS: Safari (and Technology Preview), Chrome (and Beta, Canary), Edge, Dia, Arc, Brave, Vivaldi, Opera, Cốc Cốc, ChatGPT Atlas.
- Windows: `chrome.exe`, `msedge.exe`, `brave.exe`, `vivaldi.exe`, `opera.exe`, `arc.exe`, and `browser.exe` (Cốc Cốc).

Only Safari, Chrome and Dia on macOS were probed; the other Chromium browsers are taken to behave like Chrome. Firefox is left out on both platforms until probed.

A default application has several identifiers where needed (ChatGPT on macOS). "Tắt ở …" removes it under whichever one the circle reported, and the removal is stored under its first.

Most people never touch the list. Changes come from use:

- **Remove:** hovering the circle shows, beside its hint, a quiet "Tắt ở ChatGPT" (the application's name, or the host's in a browser). It removes that place and hides the circle.
- **Add:** after ⌘⇧M (Ctrl+Shift+M) outside the list, the check mark stays 6 s with "Luôn hiện nút ở TextEdit", which adds that place under the identifier the platform reported (a bundle identifier, or an executable name and its file name as the label on Windows). A read-only selection's preview does not carry the offer.
- **See and undo:** Cài đặt › Thao tác nhanh says "Nút hiện trong ChatGPT, Claude, Perplexity… · ⌘⇧M dùng được ở mọi nơi." with "Xem danh sách", each place with "Bỏ", and "Khôi phục mặc định" once something changed.

Only the user's changes are stored, as additions and removals (`offlinemask.quick-places.v1`, a preference beside the others), so a later version's longer default list still reaches people who changed theirs, and a default they removed stays removed. The list holds application identifiers, names and host names, never text. The front end sends the effective list to the native side at start and after each change (`quick_set_places`), which answers whether the platform honours it: macOS and Windows do; on Linux there is no circle.

The "why no circle" note in Cài đặt has no reason for an application off the list: the native side does not read there, so the front end never hears of the selection.

### Wording

The app, the one-time card ([0098](0098-quick-discovery.md)), the home page and the landing illustration speak of ChatGPT, Claude and Gemini instead of "ứng dụng bất kỳ" or Zalo and Word. Settings' head names AI apps where the list applies.

## Privacy

`landing/privacy.html` §3 lists the place list among the settings; §5 says that the circle shows only in AI places, that elsewhere the selection is read only on ⌘⇧M (Ctrl+Shift+M), and that in a browser the page address is read, only its host compared and nothing stored. `privacy-contract.test.mjs` pins both backends' gate, the `AXURL` read and the Document value read to that page.

## The probe that preceded it

On the owner's Mac, 24 October 2026, a scratch Swift tool with the Accessibility permission read the app's `AXFocusedUIElement`, walked `AXParent` up to the `AXWebArea` and read its `AXURL`:

| Browser | Page focused | Text field in the page | ChatGPT composer | Address bar (⌘L) |
| --- | --- | --- | --- | --- |
| Safari | URL, depth 0 | URL, depth 1 | `https://chatgpt.com/` | `AXTextField`, no web area |
| Chrome | URL, depth 0 | URL, depth 2 | `https://chatgpt.com/`, depth 10 | `AXTextField`, no web area |
| Dia | URL, depth 0 | URL, depth 2 | `https://chatgpt.com/`, depth 25 | `AXTextArea`, no web area |

The walk took 1–25 ms. Chrome answered nothing until it was frontmost with its tree built; the watcher already asks for the tree ([0126](0126-chromium-accessibility-tree.md)). The walk is capped at 80 ancestors.

## Checked

`pnpm test` (331, with `places.test.mjs` for both platforms' defaults, the user agent, and the add and remove rules under any identifier; three quick-action tests for sending the list, "Tắt ở …" and the ⌘⇧M offer; and the privacy contract), `pnpm typecheck`, `pnpm lint`, `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test` (host matching, page-address parsing, and the shared rule: a browser by its page, the address bar never, an app by itself, a dialog never). The Windows backend was checked with `cargo clippy -D warnings` for `x86_64-pc-windows-msvc` in a scratch crate holding it, the shared selection module and a stub of the two Tauri types it uses; the whole app does not cross-compile from macOS (a C dependency). `pnpm test:models` could not run here: the pack's model files are not downloaded on this machine.

In the owner's running macOS dev app, driven from outside: a phone number selected with ⌘A in ChatGPT's composer in Dia got the circle; the same in TextEdit, and in Dia's address bar, got none; ⌘⇧M in TextEdit masked in place and showed "Luôn hiện nút ở TextEdit" beside the check mark. After moving the rule into `spot_for`, the ChatGPT and TextEdit cases were run again with the same results. Not tried by hand: the hover's "Tắt ở …" button, the Settings list, Safari and Chrome through the app, and a save dialog inside an AI application. **Nothing ran on Windows.** It rests on two unprobed assumptions: that Chromium gives a document's address as its UI Automation value, and that the listed executables are named as above. If the first is wrong, Windows browsers show no circle on AI sites, and the AI desktop applications and ⌘⇧M still work. A probe on a Windows machine is the next step.

## Not done on purpose

- A circle in mail, chat, office and note applications by default, even for read-only text. ⌘⇧M covers them.
- Telling AI sites apart by page content or title: hosts are exact and predictable, and titles are not.
- A form to type an application or a host. Adding comes from using ⌘⇧M in that place.

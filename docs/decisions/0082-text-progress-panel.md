# 0082 — The text page shows the same progress panel as files

Date: 14 October 2026. Status: requested by the owner ("for the excel and word, I see an animation, for the text, do we have it. What if the text is long?").

## Why

Files show a steady progress panel while they are masked ([0076](0076-spreadsheet-files.md), [0078](0078-word-documents.md)): one title, a percentage that only goes up, a bar, and a time estimate once it is stable. The text page only had a spinner on the button and a small line that changed words mid-run ("Đang chuẩn bị… Lần đầu có thể mất một lúc." then "Đang phân tích 40%…"), the flicker the files flow had already removed. A text may hold 50 000 characters: about 20 s with native recognition and several minutes on WASM ([0077](0077-native-recognition-windows.md)), plus loading the models the first time.

## Decision

- The text page uses the same `MaskProgress` panel, between the options and the buttons; the textarea stays visible and locked, and "Hủy xử lý" stays.
- The panel appears only when a run lasts longer than 0.7 s. Short texts, the common case, finish without a panel flashing in and out; the button's spinner and "Đang xử lý…" cover that moment.
- The run reports progress in the panel's shape (`textProgress`): loading the models is 0 %, then the detector's progress across the pack's models, scaled to whole steps so the estimate is not skewed while the first model runs.

## Verified

`pnpm lint`, `pnpm typecheck` and `pnpm test` pass. In the browser preview, with messages to the detection worker delayed for testing, a 19 200-character text showed the panel only after the delay and no panel at 0.3 s.

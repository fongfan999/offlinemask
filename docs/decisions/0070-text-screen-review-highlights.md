# 0070 — Text screen: highlighted review, one-click names, paste first

Date: 13 October 2026. Status: requested by the owner ("do all", after a review of the text screen).

## Problem

In the review step the masked copy was plain text: an alias looked like any other word and a missed name did not stand out. The warning named a likely missed name but only offered "bôi đen", and the same advice appeared three times. Six category checkboxes sat above the text box although people paste first; the subtitle repeated the placeholder; the character counter was always on. After masking the page scrolled to the copy button and hid the heading. "Sao chép → Khôi phục" read as two actions and "Chỉ sao chép" was an icon. In the restore step the instruction appeared twice, restoring needed a button press, and the result was another plain box. Editing the text again was only reachable through the step 1 checkmark.

## Decisions

- **Highlights.** `HighlightedText.vue` keeps the read-only textarea (native selection, keyboard access, copy, highlight-to-hide) and draws marks on a mirror behind it with the same metrics; a `ResizeObserver` matches the textarea's inner width so wrapping and scrollbars line up, and scrolling is synced. `src/core/review-marks.ts` computes the marks on the newline-normalized text the textarea shows: aliases in "Bản đã ẩn", the values that will be hidden in "Bản gốc" (both cobalt-soft), and likely names still in clear text (a warm underline) when name recognition did not run.
- **One-click names.** The warning lists up to three likely names as buttons, "Ẩn “Nguyễn Minh Anh”". `unmaskedOccurrences` finds whole-word, clear-text occurrences and `addManualMasks` hides them under one `AN_THEM` alias; Hoàn tác undoes it like any manual correction. Whether a run is a name stays the user's call; nothing is detected.
- **Less repetition.** With the warning shown, the "Bôi đen là ẩn ngay" hint row only carries status and undo; the reminder under the card is gone.
- **Paste first.** The text box comes first. What to hide is one line under it, "Sẽ ẩn: Email, Số điện thoại, Tài khoản và mã định danh · Thay đổi", which opens the checkboxes; "Một số mục cần tải thêm" stays visible when the pack is missing, and the download notice for selected categories is unchanged. The subtitle explains the result ("Thông tin bạn chọn được thay bằng mã như [SDT_1_…], ngay trên máy bạn."); the counter appears from 90 % of the limit.
- **After masking.** The page stays at the top; focus moves to the copy button without scrolling.
- **Copy actions.** The primary button is "Sao chép và tiếp tục"; "Chỉ sao chép" is a text button beside it. The behaviour from [0061](0061-three-steps-and-copy-choice.md) is unchanged. A "Sửa văn bản" button in the review header reopens the draft (the session stays in history).
- **Restore.** The subtitle is just "Văn bản #n"; restoring follows the pasted reply as it changes, with no button. The result is highlighted at each restored value (`restoreAliases` now returns `marks`), and "Sao chép bản khôi phục" is the primary action. After copying it, the button gives way to "Dán câu trả lời khác" (clears the box for the AI's next reply) and "Ẩn văn bản mới". The owner agreed there is no "Xong" or home button: nothing needs finishing, and the step is often a loop.

## Verification

`pnpm lint`, `pnpm typecheck` and `pnpm test` (208, four new in `tests/review-marks.test.mjs`) passed. In the in-app browser with the sample text at 1280 × 820 light and 375 × 812 dark: highlights align with the text, including after scrolling inside the box and with a scrollbar; the name button hid both occurrences under one alias and Hoàn tác restored them; select-to-hide still works; "Bản gốc" marks the hidden values; restoring updated as the reply was typed and highlighted three values; "Sửa văn bản" reopened the draft; no horizontal overflow. WebKit in the packaged app was not exercised.

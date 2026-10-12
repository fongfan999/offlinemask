# 0060 — The text card is a four-step stepper

Date: 11 October 2026. Status: accepted by the owner.

## Problem

After [decision 0059](0059-review-screen-clarity.md) the review screen numbered the copy and restore steps, but the restore panel still sat below the masked copy as a collapsible section. The owner's feedback: a long form that needs scrolling makes the user lose their place; the home page already demonstrates four steps, so the text card should walk them the same way.

## Decisions

- **One step on screen at a time.** The text card opens with a stepper row: 1 Dán văn bản, 2 Ẩn thông tin, 3 Sao chép sang AI, 4 Dán câu trả lời. The current step is highlighted, done steps show a check, upcoming ones are muted. The step is derived from state rather than stored: no session is step 1 (step 2 while processing), a session is step 3, and step 4 is the restore panel inside the same card. Only two moves are user-driven and both are buttons in the stepper: 3 → 4 and 4 → 3; step 4 also has a "Xem lại bản đã ẩn" button. Steps 1 and 2 cannot be revisited inside a session, since "Phiên mới" already does that.
- **Copying advances.** A successful copy moves to step 4 and focuses the reply box, so coming back from the AI tool lands on "paste here". The clipboard fallback keeps the user on step 3 with the text selected. Changing sessions returns to step 3.
- **RestorePanel is the step 4 body.** It no longer renders a `<details>` with its own summary and scroll-into-view; it exposes `focusInput()` and keeps its per-session reset. The reply, result and copy behaviour from decision 0052 are unchanged.
- **Buttons carry their step.** "2 Ẩn thông tin" and "3 Sao chép để gửi AI" use the same `.step-number` badge as the stepper and the home illustration. Below 1050 px only the current step keeps its label; the buttons keep an `aria-label` with the step name.
- The spreadsheet sample keeps its single-screen layout; the stepper is text-only.

## Owner feedback on the first version, 12 October

- The draft's card header ("Văn bản của bạn" and a large "Dùng văn bản mẫu" button) is gone. The sample is a one-time try, so it is a small underlined link, "Thử với văn bản mẫu", under the text box next to the character count, shown only while the box is empty.
- The mask button keeps its sparkle icon and no step badge; "Ẩn thông tin" is clearer on its own. While recognition runs the icon becomes a spinning ring and the stepper's step 2 badge spins too.
- The stepper is a band across the card with a bottom rule: 26 px badges, the current one with an accent ring, done ones ticked in the soft accent, upcoming ones outlined; 2 px connectors that fill in as steps complete; colours transition.
- Step panels cross-fade (out 140 ms, in 220 ms, a few pixels of vertical travel) so 2 → 3 reads as a change of screen rather than a jump. Focus that targets the incoming panel (the copy button after a run, the reply box on step 4) waits for the panel's enter transition. Reduced-motion settings disable the transitions.

## Owner feedback on the second version, 12 October

- "Chỉ lưu trong lúc mở ứng dụng." was not understood. The footer now says what happens: "Phiên này sẽ bị xóa khi bạn đóng ứng dụng."
- The stepper is centred with fixed 36 px connectors instead of stretching across the card, so the four steps read as one group like the home illustration.
- Steps 1 and 2 are reachable from a session. They reopen the draft with that session's original text and category choices (a sample session reopens the sample text); the session stays in the sidebar and masking again creates a new session, which keeps the no-overwrite rule. The buttons carry a tooltip saying so. Step 2 alone has no screen of its own, so both lead to the draft.
## Verification

Third pass, 12 October: from step 3 of a masked sample, clicking step 1 reopened the draft with the original text and the three local choices ticked, with the session still listed in the sidebar; the centred stepper and the reworded footer rendered as intended. Lint, type check and tests passed.

Second pass, 12 October, in the in-app browser: the draft showed the stepper band, the small sample link and no header; a screenshot taken right after pressing "Ẩn thông tin" caught step 2 with the spinning badge and step 1 ticked; two seconds later step 3 had faded in with the warning and summary. Lint, type check and tests passed again.

First pass, 11 October:

`pnpm lint`, `pnpm typecheck` and `pnpm test` (198) passed. On the running `tauri dev` server viewed in the in-app browser at 1280 × 900: the draft showed step 1 with the "2" badge on the mask button; after masking the sample with local options, step 3 showed the warning, summary and copy button with steps 1–2 ticked; clicking step 4 showed the reply box with the whole card on one screen, a typed reply with two aliases restored to the original values, and "Xem lại bản đã ẩn" returned to step 3. The automatic move to step 4 after a successful clipboard write runs only where the clipboard is available, so it was not exercised in the pane.

# 0061 — Three steps, and an explicit choice when copying

Date: 12 October 2026. Status: accepted by the owner.

## Problem

After [decision 0060](0060-text-card-stepper.md) the owner found the first two steps redundant: pasting the text and pressing "Ẩn thông tin" happen on the same screen, so "Dán văn bản" and "Ẩn thông tin" were one step shown as two. Copying also moved straight to the restore step, while some users only want the masked text on the clipboard.

## Decisions

- **Three steps everywhere.** The text card's stepper is 1 Ẩn thông tin, 2 Sao chép sang AI, 3 Dán câu trả lời. The draft is step 1 (its badge spins while recognition runs), a session is step 2 and the restore panel is step 3. The home illustration uses the same numbers: panel one is "1 Dán văn bản và bấm Ẩn", panel two is the result ("Đã ẩn xong", a ticked badge), panel three is "2 Sao chép sang AI" and the line under the flow is "3 Dán câu trả lời của AI vào lại". Step 1 from a session still reopens the draft as in decision 0060.
- **Two ways to copy.** A private session's footer has "Chỉ sao chép", which copies and stays on step 2 with "Đã sao chép", and the primary "2 Sao chép và khôi phục", which copies and moves to step 3 with the reply box focused. Sample sessions keep a single "Sao chép kết quả". The clipboard fallback is unchanged for both.

## Owner feedback, 12 October

- The stepper looked off-centre because the sidebar's `nav button` rule stretched every step button to full width; `.step` now sets `width: auto` and the group is centred.
- "Chỉ sao chép" is a round icon button at the top right of the card header (copy icon, tick once copied) rather than a second footer button.
- The primary button has no step number. It reads "Sao chép → Khôi phục" with the copy icon and an arrow between the two words, which says both what it does now and where it goes next.
- Step 3 is titled "Khôi phục" to match the button; the home illustration's last line reads "3 Khôi phục: dán câu trả lời của AI vào lại".
- The owner questioned "Phiên này sẽ bị xóa khi bạn đóng ứng dụng." because sessions are meant to be kept locally. Private sessions are still RAM-only pending the encrypted vault from the PRD, so the note stays true for now; persistence is a separate decision.

## Verification

`pnpm lint`, `pnpm typecheck` and `pnpm test` (198) passed. In the in-app browser the home page showed the renumbered illustration; the text card showed the three-step band, and after masking the sample both copy buttons sat in the step 2 footer with the warning and summary above them. The clipboard is unavailable in the pane, so the jump to step 3 after "Sao chép và khôi phục" runs only in the packaged app.

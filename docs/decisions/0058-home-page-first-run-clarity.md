# 0058 — Home page: say the one-time download up front, show the four steps

Date: 11 October 2026. Status: accepted by the owner for the text-first release.

## Problem

The owner is releasing the text workflow first and wants the home page understood and used without help, by low-tech users and children. Reviewing the accepted home page against that goal found three gaps:

- The hero promised "Không cần Internet", but the first click on Văn bản met "Tải thêm để tiếp tục" and a 712 MB download. For a cautious user that reads as a broken promise.
- The three-panel illustration showed the result (original, masked, AI) but not what to do, and the restore step, the main reassurance that the AI's reply becomes readable again, was absent from the home page.
- "Bí danh" is a literary word; the illustration's eyebrow labels were 10 px mono; the flow arrows were hard to see in the dark scheme.

## Decisions

- **Pack status on the home page.** `HomePage.vue` injects the recognition-pack store and shows one strip under the format cards: a one-time download notice with the transfer size and a `Tải về` button while the pack is missing, progress with a link to Settings while downloading or installing, resume or retry after a pause or error, and a quiet "Đã sẵn sàng. Dùng không cần Internet." once installed. Nothing is shown during the launch check. Downloads stay explicit and manual; the strip only starts the same action as Settings. The hero's last sentence follows the same state: "Tải một lần, sau đó không cần Internet." until the pack is ready. `packProgress` in `useRecognitionPack.ts` is the shared whole-number progress rule.
- **Numbered steps in the illustration.** Each panel opens with its action (1 Dán văn bản, 2 Bấm Ẩn thông tin, 3 Sao chép sang AI) and keeps the state eyebrow (Bản gốc, Bản đã ẩn, AI của bạn) below it; a fourth line under the flow describes restoration: "Dán câu trả lời của AI vào lại. Tên thật hiện ra như cũ, vẫn chỉ trên máy bạn." The decorative placeholder bar was removed to make room. Eyebrows are 12 px, sample values 13 px, arrows 22 px in the strong accent.
- **Plain wording.** "Bí danh" becomes "mã thay thế" in every user-facing string (hero, illustration, text page subtitle, restore panel, sample review reasons). Alias values such as `[TEN_DEMO_01]` are unchanged because they match the real output shape `[TYPE_n_scope]`. The Văn bản card now lists "Email, tin nhắn, hợp đồng, CV". The illustration's sample name is "Phong Phan", matching the owner's blog wotdafong.dev.

## Not changed

Two further suggestions change the accepted baseline and wait for the owner's call: making Văn bản the single primary card while only text ships, and hiding or relabelling the sample sessions that a fresh install lists under "Các phiên của bạn".

## Verification

`pnpm lint`, `pnpm typecheck` and `pnpm test` passed. The running `tauri dev` server was viewed in the in-app browser at 1280 × 900 in light and dark schemes and at 375 × 812: the four steps, the strip and the coming-soon row lay out without horizontal overflow; the browser preview shows the "missing" state because it has no native pack manager. The packaged app was not rebuilt.

# 0066 — Home page: promise only what works now, start above the fold

Date: 12 October 2026. Status: requested by the owner ("Do all", after a home-screen review), with two follow-up notes (name the other private information in the strip; keep the step label short), the spreadsheet card deferred to the later spreadsheet pass and the brand colours kept as the brand kit defines them.

## Problem

A review of the accepted home page found:

- The hero ("Tải một lần, sau đó không cần Internet.") and the strip ("Lần đầu cần tải thêm 712 MB") read as if nothing works before the download. Email, phone and account numbers work on a fresh install; only names, addresses and organizations need the pack. The hero also listed "Tên" first.
- At 1280 × 820 the hero, a second brand mark and the illustration pushed the format cards below the fold. The cards were tall and mostly empty.
- Illustration copy drifted from the app: "bấm Ẩn" against the button "Ẩn thông tin", an alias `[TEN_DEMO_01]` unlike real output `[TEN_1_3030]`, numbering 1 · ✓ · 2 · 3, "thay bằng mã thay thế", "vào lại".
- The sticky note's provider list was 11 px at 0.8 opacity. On phones the AI note sat alone in a right-hand column.
- The ready strip said only "Đã sẵn sàng."

## Decisions

- **Copy.** Hero: "Số tài khoản, số điện thoại, họ tên… được đổi thành mã thay thế ngay trên máy bạn, không cần Internet." Processing is always offline; the download is optional and is said in the strip: "Tải gói nhận diện (712 MB) để tự ẩn họ tên, địa chỉ và thông tin riêng tư khác." / "Email, số điện thoại, số tài khoản đã dùng được ngay." Ready: "Gói nhận diện đã sẵn sàng." The hero no longer changes with pack state.
- **Illustration.** Step 1 names the real button in a label short enough for one line: "Dán, bấm **Ẩn thông tin**". The middle panel is step 1's result, "Kết quả", without a badge. The alias is `[TEN_1_3030]`, the real `[TYPE_n_scope]` shape. Step 3: "Dán câu trả lời của AI vào OfflineMask" / "Tên thật hiện lại, vẫn chỉ trên máy bạn." The provider list is 12 px at full note-ink. Below 600 px the flow stacks vertically with downward arrows. The sample review fixture keeps `[TEN_DEMO_01]`, since stored sample history refers to it.
- **Layout.** Format cards are horizontal at every size (48 px icon beside title and description), replacing the short-window-only variant. The hero mark shows only when the sidebar is hidden (≤ 760 px), since the sidebar already shows the brand. The home top margin is `clamp(24px, 5vh, 64px)`.

## Not changed

- The Bảng tính card stays as is; the owner will revisit it with the spreadsheet page.
- The brand colour tokens (`--accent`, `--accent-soft`, `--note` and their dark values) still come from the personal brand kit per [0052](0052-brand-theme-and-restoration.md). A shift toward a truer cobalt was proposed; the owner decided to respect the brand kit, so the tokens are unchanged.

## Verification

`pnpm lint`, `pnpm typecheck` and `pnpm test` (204) passed. The running dev server was viewed in the in-app browser at 1280 × 820 in light and dark (cards, strip and coming-soon row above the fold) and at 375 × 812 (vertical flow, no horizontal overflow). The browser preview shows the missing-pack state only; the packaged app was not rebuilt.

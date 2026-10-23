# 0134 — The step's actions stay in view, the result gets the room, small type grows

Date: 24 October 2026. Status: implemented; checked in the Vite preview at 1200×800, 1440×940 and 640×560, light and dark. Owner's request after a UI review of the 2.0.4 Store build: "fix all".

## Problem

The review was run on the installed Microsoft Store package. Everything in it is in the shared front end, so it applies to macOS, Windows and Linux alike.

- **Main action below the window.** On the text review the passcode offer, the "Đã ẩn" summary and a fixed 340px text box pushed "Sao chép và tiếp tục" to y≈927–973 in the default 1440×940 window, and lower on a 1366×768 laptop. "Tải tệp đã ẩn" on a spreadsheet review sat at y≈1075.
- **Restore step.** The pasted reply and the restored copy were two equal boxes about three lines tall. The restored copy, the thing the user came for, had no visible label. "Xem lại bản đã ẩn" sat on its own row under the main button. "Đã sao chép. Dán vào công cụ AI…" (text) and "Đã lưu tệp đã ẩn…" (files) stayed under the card after the reply or returned file was in.
- **Small type.** Sidebar file types were 9.5px, the sidebar "Sắp có" badge 9px, and the sidebar footer, history labels, table headers and badges 10px. Muted captions were 11px. Too small for the non-technical users on modest Windows PCs that the product is built for.
- **Spreadsheet columns.** Six columns did not fit the 860px content column, so the kept "Số tiền" column, the one most worth checking, was off to the side. macOS hides that scrollbar by default. The instruction appeared twice, in the subtitle and in the card.
- **Smaller things.**
  - "Chọn tệp khác" used the × (close) icon.
  - The disabled "Kiểm tra cập nhật" looked like a working button.
  - The restore box said "phản hồi" in one place and "câu trả lời" in another.
  - A code in the masked title, for example "Chào chị [TEN_2_2877],", read like a typo.

## Decision

- **Sticky action row.** A step panel's `card-footer` sticks to the bottom of the window (`position: sticky`) with a hairline and the card's paper behind it. Long reviews, file lists and restored replies scroll under it. `.glass-card` clips with `overflow: clip`, which keeps the rounded corners without becoming the scroller; WebKit versions without `clip` fall back to `hidden`, where the row simply does not stick. Nothing is moved or reordered, and the passcode offer stays where 0071 put it.
- **Review box sized to its text.** The review and restored-copy boxes use `field-sizing: content` between 160px and 340px (restored copy: up to `min(420px, 55vh)`). Where `field-sizing` is unsupported, which includes WebKit on macOS and Linux today, the fixed sizes stay.
- **Restore step.** Once a reply restores at least one code:
  - The pasted reply shrinks to 96px.
  - The restored copy appears under a visible "Bản đã khôi phục" label, followed by the count.
  - `RestorePanel` renders the step's one action row. The page passes in its own buttons ("Xem lại bản đã ẩn") and note, so they sit beside "Sao chép bản khôi phục".
  - It emits `pasted`, and each page drops its "paste the reply / open the returned file here" note while a reply or returned file is in.

  The wording is "câu trả lời" throughout.
- **Type floor.** Mono labels and badges are at least 11px and sans captions at least 12px. The sidebar is the exception: its file types are 10.5px and its "Sắp có" badge 10px. That is the most the 210px sidebar of windows under 1050px allows without wrapping "XLSX, XLS, ODS, CSV" or "Hình ảnh". The Thao tác nhanh demo illustration keeps its sizes.
- **Spreadsheet width.** The spreadsheet page's content column widens to 1180px (`main.wide-page`), and a column's choice is at most 148px wide. Six columns now fit side by side in the default window. The draft subtitle gives only the size ("3 dòng"); the card says what to do.
- **Smaller fixes.**
  - "Chọn tệp khác" uses the upload icon.
  - Disabled quiet buttons are muted at 55% opacity with a not-allowed cursor.
  - Codes in the text page's title are set like the review's highlights (mono, accent on the soft accent). The title is still the first masked line (0059).

Not changed: the recognition result seen in the review, where "Vietcombank" was hidden as an address. That is model output, not interface. No privacy fact changes.

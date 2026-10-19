# 0098 — Telling people about Ẩn nhanh, and asking for the permission well

Date: 19 October 2026. Status: requested by the owner: "how to let users know we have this feature to mask data quickly and need them to grant permission", then "ok build it, also I want to load a still/animated image or animation that show the action select text, there's an offlinemask icon, so when users go to the settings, they see this section, know what it is".

## Problem

Ẩn nhanh ([0096](0096-selection-popover.md)) is the fastest way to use OfflineMask, but it lives in Cài đặt and on macOS needs the Accessibility permission, whose system dialog speaks of "controlling this computer". Asking for that at first launch, before anyone has seen what the app does, is the moment people are least willing to say yes.

## Decision

- **An illustration of the feature** (`QuickDemo.vue`). A small window labelled "Ứng dụng bất kỳ" shows sample text being selected, the OfflineMask button appearing beside it, a click, a check mark, and the values turning into codes, in a 7 s loop. Plain HTML and CSS keyframes on sample text, in the brand tokens, light and dark; no image or video file, nothing from the user. With reduced motion it holds the moment before the click. It sits in the head of Cài đặt › Thao tác nhanh (see below) and in the card below.
- **A one-time card at the right moment** (`QuickIntro.vue`). After the first copy of a masked text in the Văn bản page, the trip Ẩn nhanh would have saved, a card under the result says "Lần sau, không cần dán vào đây", with the illustration, "Bật Ẩn nhanh" and "Để sau", and scrolls into view.
  - With the permission already there (Windows, or granted before), "Bật Ẩn nhanh" switches the feature on and says "Đã bật Ẩn nhanh. Thử bôi đen một đoạn trong ứng dụng khác.", which fades after 8 s.
  - Otherwise one sentence comes before macOS's dialog: "macOS sẽ hỏi quyền Trợ năng. OfflineMask chỉ dùng quyền này để đọc chữ bạn bôi đen và đặt kết quả vào đó, không gửi đi đâu." Only "Tiếp tục" opens the system prompt. While waiting, the card says where to switch it on; the existing two-second permission poll notices the grant and Ẩn nhanh turns itself on.
  - "Để sau", any answer, or Ẩn nhanh starting to work by any route marks the card as answered (`offlinemask.quick-intro.v1`, an on/off flag like the other preferences); it is never shown again.
- **The card belongs to the copied result** (owner: "is it always stay here?"). It is shown only while the copy confirmation is, so a new text, "Tạo mới" or another page removes it. An offer left unanswered can come back with the next copy; once "Bật Ẩn nhanh" or "Để sau" was pressed it does not.
- **Cấp quyền in Cài đặt** now also switches Ẩn nhanh on when the grant arrives: whoever asks for the permission wants the feature.
- **A quiet way back from the tray.** While Ẩn nhanh does not work, the menu bar / tray menu carries "Bật Ẩn nhanh…" under "Mở OfflineMask"; it opens Cài đặt. The frontend tells the native side when to add or remove it (`quick_tray_offer`).

Not done on purpose: a welcome screen or a permission request at first launch, repeated reminders, a banner on the home page (the accepted baseline stays focused on paste or drop).

## Cài đặt › Thao tác nhanh, reworked

The owner asked to improve the whole section. Its head now says what the feature is once ("Bôi đen chữ trong ứng dụng bất kỳ, bấm nút OfflineMask để ẩn hoặc khôi phục ngay tại chỗ.", with "Chỉ đọc chữ bạn bôi đen, xử lý trên máy này." under it) beside the compact illustration, which stays in every state so the card does not change height when the permission arrives. The Ẩn nhanh row keeps only what the head does not say ("Ô nhập được thay ngay; chữ không sửa được thì hiện bản xem trước để sao chép.") and, once it works, says so: "Đang bật · thử bôi đen một đoạn trong ứng dụng khác." The illustration's text box no longer reserves room above the text for the button (it floats over the empty end of the first line) and its text cannot be selected.

## Layout and a webview pitfall

After the first look (owner: "anything we can improve this UI?") the card took the passcode offer's note style: soft cobalt background, the mark on the left, quiet buttons with the accent one outlined, and the illustration beside the text (stacked under 720 px). The sentence became "Bôi đen chữ trong ChatGPT, Zalo hay Word, bấm nút OfflineMask là xong.", and the illustration's sample reads like a request to an AI ("Tóm tắt giúp tôi: khách Nguyễn Văn An, số 0901 234 567").

The card scrolls itself into view instantly. With `behavior: "smooth"` the macOS webview stopped delivering clicks and typing to the page after the scroll (a temporary event log on the card recorded no pointer events at all, while the page's script thread was idle); with an instant scroll the owner confirmed the buttons work.

## Checked

`pnpm test` (295; the card's stages, priming before the prompt, turning on at the grant, "Để sau" for good, the tray offer following the feature), `pnpm typecheck`, `pnpm lint`, `cargo clippy -D warnings`, `cargo fmt --check`. In the macOS dev app with the permission off: the illustration loops in Cài đặt; masking the sample and copying it shows the card; "Bật Ẩn nhanh" shows the sentence before the dialog. The system prompt and the tray item were not driven by script (the status menu is not reachable through Accessibility scripting here).

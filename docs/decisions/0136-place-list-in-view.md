# 0136 — The place list is in view, and its buttons look like buttons

Date: 24 October 2026. Status: implemented; checked in a Vite harness that mounts the real Settings card and the circle's hover markup (light and dark, Ẩn nhanh on and off). Follow-up to [0135](0135-circle-only-where-ai-is.md) after testing 2.1.0 on Windows. Owner: "the button to turn off is not something clickable, users won't notice it" and "in the settings tab, I don't see the enabled app list".

## Problem

- **The circle's second button.** "Tắt ở chatgpt.com" beside the hovered circle used the hint's box, with grey text, next to the plain "Ẩn thông tin" hint. It read as a second label. "Luôn hiện nút ở …" after ⌘⇧M had the same look.
- **The list in Settings.** It was hidden twice. It appeared only while Ẩn nhanh was on, which is off on a fresh install, and then only behind "Xem danh sách" at the end of a grey line. When opened, its twenty rows pulled the Ẩn nhanh switch, centred on the row, down beside "Gemini". A site added from use showed its name twice ("httpbin.org httpbin.org").

## Decision

- **Buttons beside the circle.** "Tắt ở …" and "Luôn hiện nút ở …" are cobalt pills: accent outline and text, semibold, with an icon (× to turn off, + to add). On hover they fill with the accent, and keyboard focus gets an outline. The plain hint keeps its box, so the two read differently side by side.
- **"Nơi nút tự hiện" in Settings.** The list is its own row under the shortcut, always shown where the platform honours it (macOS, Windows).
  - It is dimmed while Ẩn nhanh is off, but stays readable.
  - It says "Các ứng dụng và trang AI dưới đây. Ở nơi khác, nhấn ⌘⇧M để dùng."
  - Two labelled groups, "Ứng dụng" and "Trang web", list the places as chips. Each chip has its own × button ("Bỏ …" to assistive technology). Sites show their host, with the name as the tooltip.
  - Under the chips, one line says how to add a place, since adding comes from use: "Thêm nơi khác: bôi đen chữ ở đó, nhấn ⌘⇧M rồi chọn “Luôn hiện nút ở …”." A typed form stays out, as 0135 decided; the owner agreed after seeing the offer after the shortcut.
  - "Khôi phục mặc định" follows once something has changed.

  The one-line summary and its "Xem danh sách" link are gone, and the Ẩn nhanh row is back to one switch and its text.

Storage, the native gate and the privacy facts are unchanged. `landing/privacy.html` already says the list can be seen and changed in Cài đặt › Thao tác nhanh.

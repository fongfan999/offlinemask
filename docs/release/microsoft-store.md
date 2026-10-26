# Microsoft Store submission

What to enter in Partner Center for OfflineMask (`WotDaFong.OfflineMask`, decision [0117](../decisions/0117-microsoft-store-msix.md)). Copy the blocks as they are; the listing language is Vietnamese (vi-VN), matching the package manifest.

## Package

Upload the unsigned `OfflineMask_<version>_x64.msix` from the `msix-windows-x64` artifact of the release run for that tag, never the `_test-signed` copy. The version must be higher than any earlier submission.

## Pricing and availability

- **Markets:** all, or Vietnam only to start.
- **Visibility:** first submission **Private audience**, with the owner's Microsoft account, so the Store-signed build can be installed and checked before anyone else sees it. Switch to public afterwards; no new upload is needed.
- **Pricing:** Free.

## Properties

- **Category:** Productivity.
- **Privacy policy URL:** `https://offlinemask.com/privacy`
- **Website:** `https://offlinemask.com`
- **Support contact:** `https://github.com/fongfan999/offlinemask/issues`
- **Does this product access, collect or transmit personal information?** No. Everything is processed on the device. The app uses the network only when the user clicks: to download the recognition pack, or to open OfflineMask.com in the browser (including the *Báo lỗi* page, where the user presses *Gửi* themselves).
- **System requirements:** x64, 8 GB memory recommended when the recognition pack is used.

## Age ratings (IARC questionnaire)

Category **Utility / Productivity**. Answer **No** to violence, sexual content, language, controlled substances, gambling, user interaction or chat, sharing location, sharing personal information, digital purchases and unrestricted web access. Expected rating: 3+ / Everyone.

## Store listing (vi-VN)

**Description**

```
Ẩn thông tin trước khi hỏi AI. Chạy hoàn toàn trên máy bạn.

OfflineMask thay họ tên, số tài khoản, số điện thoại, CCCD, email và các thông tin riêng tư khác bằng mã ngay trên máy, trước khi bạn dán vào ChatGPT, Claude, Gemini hay công cụ AI nào khác. Khi AI trả lời, dán câu trả lời vào lại: thông tin thật trở về đúng chỗ.

• Văn bản, bảng tính (Excel, CSV, ODS) và tài liệu Word giữ nguyên định dạng. PDF có chữ cho ra bản Markdown đã ẩn.
• Xem lại từng thông tin được ẩn, giữ hoặc ẩn thêm chỉ với một lần bấm.
• Gói nhận diện tiếng Việt (tùy chọn) nhận ra họ tên, địa chỉ, tổ chức và ngày sinh.
• Ẩn nhanh: chọn văn bản trong ứng dụng bất kỳ và ẩn ngay tại chỗ.
• Đặt mật mã để lưu lịch sử trong kho mã hóa trên máy.

Không tài khoản, không máy chủ, không thống kê sử dụng. Ứng dụng chỉ dùng mạng khi bạn bấm tải gói nhận diện. Hãy luôn xem lại kết quả trước khi chia sẻ.
```

**What's new in this version** (2.3.0; 2.2.0 listed Báo lỗi, history that deletes itself and the circle acting only on the selection; the first submission said "Bản đầu tiên trên Microsoft Store.")

```
• Mở được PDF có chữ trong mục Tài liệu: bảng vẫn là bảng, bản đã ẩn là tệp Markdown chỉ chứa chữ đọc được từ PDF nên không mang theo gì ẩn trong tệp gốc. PDF scan và hình ảnh sẽ có sau.
• Tệp lưu ra có tên "(OfflineMasked)", tệp khôi phục là "(OfflineUnmasked)", dễ nhận ra ở mọi định dạng.
• Hóa đơn, sao kê và hợp đồng được ẩn đúng hơn: tiêu đề in hoa, tên hàng hóa, thương hiệu và nội dung chuyển khoản không còn bị ẩn nhầm; số tài khoản sau "TK", chủ tài khoản và tên trong nội dung chuyển khoản không còn bị bỏ sót.
```

**Product features** (one per line in Partner Center)

```
Ẩn họ tên, số tài khoản, CCCD, số điện thoại và email ngay trên máy
Khôi phục thông tin thật trong câu trả lời của AI
Bảng tính và tài liệu Word giữ nguyên định dạng
PDF có chữ cho ra bản Markdown đã ẩn
Gói nhận diện tiếng Việt tùy chọn, chạy offline
Ẩn nhanh văn bản đang chọn trong ứng dụng bất kỳ
Lịch sử được mã hóa khi bạn đặt mật mã
```

**Search terms** (up to seven)

```
ẩn thông tin, bảo mật, AI, ChatGPT, dữ liệu cá nhân, offline, PII
```

**Store logos:** upload [`logo-300.png`](../../desktop/store/listing/logo-300.png) as the 1:1 app tile icon and [`logo-2160.png`](../../desktop/store/listing/logo-2160.png) (or `logo-1080.png`) as the 1:1 box art. Without them the listing falls back to the package's 50×50 `StoreLogo.png`, stretched and blurry (seen 25 October 2026). They are `brand/tile-cobalt.svg` cropped to the tile: `sed 's/viewBox="0 0 1024 1024" width="1024" height="1024"/viewBox="100 100 824 824" width="824" height="824"/' brand/tile-cobalt.svg > /tmp/tile.svg`, then `rsvg-convert -w N -h N /tmp/tile.svg -o desktop/store/listing/logo-N.png`.

**Screenshots:** at least one, 1366×768 or larger, from the Windows app with the synthetic sample (no real data). The landing page shots in `landing/shots/` are a starting point but come from macOS.

**Copyright:** `© 2026 Phong Phan`

## Submission options

**Restricted capability: runFullTrust**

```
OfflineMask is a desktop (Win32) application built with Tauri and packaged as MSIX. It needs runFullTrust to run as a normal desktop process: it registers one global keyboard shortcut chosen by the user, reads and writes the clipboard only when the user presses that shortcut or a button, shows a small floating panel next to text the user selects in other applications, starts its own bundled recognition helper process (native\recognition-sidecar.exe with ONNX Runtime) for offline text recognition, and keeps an encrypted vault in its local app data folder. It does not collect or transmit user data.
```

**Notes for certification**

```
The app works offline. To test the main flow: open the app, paste or type text containing a name and a phone number in "Văn bản", press "Ẩn thông tin", copy the result, then paste it back under "Khôi phục". The optional Vietnamese recognition pack (about 700 MB download, 1.14 GB installed) is downloaded only when the tester presses the download button in "Cài đặt"; it is not needed for the basic flow. No account or login is required.
```

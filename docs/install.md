# Cài đặt OfflineMask

Hướng dẫn từng bước cho người dùng có trên [OfflineMask.com/install](https://offlinemask.com/install) (`landing/install.html`). Khi đổi các bước cài đặt, cập nhật cả hai.

Tải bản phù hợp với máy từ [trang phát hành](https://github.com/fongfan999/offlinemask/releases/latest). Bản phát hành chưa được ký số bằng chứng chỉ Apple Developer ID hay Microsoft, nên hệ điều hành sẽ hỏi lại trước khi mở lần đầu. Đã kiểm thử thủ công trên macOS Apple Silicon; các bản khác chưa được kiểm thử đầy đủ.

## Kiểm tra tệp tải về

Mỗi bản phát hành có `SHA256SUMS.txt`. Tải tệp này vào cùng thư mục với bản cài, rồi đối chiếu:

```sh
# macOS
shasum -a 256 -c SHA256SUMS.txt --ignore-missing

# Linux
sha256sum -c SHA256SUMS.txt --ignore-missing
```

```powershell
# Windows (PowerShell): so mã in ra với dòng tương ứng trong SHA256SUMS.txt
Get-FileHash .\OfflineMask_<phiên bản>_x64-setup.exe -Algorithm SHA256
```

Kết quả `OK` (hoặc mã trùng khớp) nghĩa là tệp giống hệt tệp do quy trình phát hành tạo ra.

## macOS

1. Mở tệp `.dmg` (`aarch64` cho Apple Silicon, `x64` cho Mac Intel) và kéo OfflineMask vào **Applications**.
2. Mở OfflineMask. macOS báo không thể xác minh nhà phát triển; chọn **Xong**.
3. Vào **Cài đặt hệ thống → Quyền riêng tư & Bảo mật**, cuộn xuống và chọn **Vẫn mở** cạnh dòng về OfflineMask, rồi xác nhận.

Chỉ cần làm một lần cho mỗi phiên bản.

## Windows

Cài từ [Microsoft Store](https://apps.microsoft.com/detail/9PN76BSDNRQW): Microsoft ký gói nên không có cảnh báo, và Store tự cập nhật.

Máy không có Store (thường do bộ phận IT tắt):

1. Chạy `…_x64-setup.exe` (hoặc `.msi`).
2. Nếu SmartScreen hiện **Windows đã bảo vệ PC của bạn**, chọn **Thông tin thêm → Vẫn chạy**.

Bản Store và bản cài từ tệp giữ dữ liệu ở hai chỗ khác nhau; chuyển từ tệp cài sang Store là bắt đầu lại từ đầu. Đã cài bằng tệp thì cập nhật bằng tệp cài bản mới để giữ cài đặt và lịch sử.

## Linux

- `.deb`: `sudo apt install ./OfflineMask_<phiên bản>_amd64.deb`
- `.rpm`: `sudo dnf install ./OfflineMask-<phiên bản>-1.x86_64.rpm`

## Cập nhật

OfflineMask không tự kiểm tra bản mới. Số phiên bản đang dùng nằm trong **Cài đặt**; bản mới nhất ghi ở [offlinemask.com](https://offlinemask.com). Cài bản mới đè lên bản cũ (trên Mac chọn **Thay thế** khi kéo vào Applications): kho mã hóa, lịch sử, cài đặt và gói tiếng Việt vẫn giữ nguyên, vì chúng nằm trong thư mục dữ liệu theo mã ứng dụng `dev.offlinemask.desktop`, không nằm trong ứng dụng. Bản Store được Store cập nhật và giữ dữ liệu của gói.

## Tự kiểm chứng xử lý offline

Sau khi cài, tắt Wi‑Fi hoặc rút cáp mạng rồi dùng thử: nhận diện, ẩn và khôi phục đều chạy trên máy. Mạng chỉ cần để tải ứng dụng và, nếu bạn chọn, tải gói nhận diện tiếng Việt từ Cài đặt.

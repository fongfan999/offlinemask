# Cài đặt OfflineMask

Tải bản phù hợp với máy từ [trang phát hành](https://github.com/fongfan999/offlinemask/releases/latest). Bản phát hành chưa được ký số bằng chứng chỉ Apple Developer ID hay Microsoft, nên hệ điều hành sẽ hỏi lại trước khi mở lần đầu. Bản Windows sẽ được ký qua SignPath Foundation; xem [code signing policy](https://offlinemask.com/code-signing). Đã kiểm thử thủ công trên macOS Apple Silicon; các bản khác chưa được kiểm thử đầy đủ.

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

1. Chạy `…_x64-setup.exe` (hoặc `.msi`).
2. Nếu SmartScreen hiện **Windows đã bảo vệ PC của bạn**, chọn **Thông tin thêm → Vẫn chạy**.

## Linux

- `.deb`: `sudo apt install ./OfflineMask_<phiên bản>_amd64.deb`
- `.rpm`: `sudo dnf install ./OfflineMask-<phiên bản>-1.x86_64.rpm`
- `.AppImage`: `chmod +x OfflineMask_<phiên bản>_amd64.AppImage`, rồi chạy tệp.

## Gỡ cài đặt

- **macOS:** kéo OfflineMask từ **Applications** vào Thùng rác.
- **Windows:** **Cài đặt → Ứng dụng → Ứng dụng đã cài**, chọn OfflineMask → **Gỡ cài đặt**.
- **Linux:** `sudo apt remove offline-mask` hoặc `sudo dnf remove offline-mask` (xem tên gói bằng `apt list --installed | grep -i offline` hoặc `dnf list installed | grep -i offline`); với `.AppImage`, xóa tệp.

Gỡ ứng dụng không xóa dữ liệu của nó (kho phiên đã mã hóa, gói nhận diện, cài đặt). Để xóa hẳn, xóa thư mục `dev.offlinemask.desktop` trong:

- macOS: `~/Library/Application Support/`
- Windows: `%LOCALAPPDATA%\`
- Linux: `~/.local/share/`

## Tự kiểm chứng xử lý offline

Sau khi cài, tắt Wi‑Fi hoặc rút cáp mạng rồi dùng thử: nhận diện, ẩn và khôi phục đều chạy trên máy. Mạng chỉ cần để tải ứng dụng và, nếu bạn chọn, tải gói nhận diện tiếng Việt từ Cài đặt.

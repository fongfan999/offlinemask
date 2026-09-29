# Fresh install and resumed download — macOS

21 September 2026, separate identity `dev.offlinemask.firstuse20260921`, **OfflineMask First Use.app**. Before opening, its app-local data directory did not exist. Build with `mise exec -- pnpm tauri build --bundles app --config scripts/recognition-reload-v1/first-use.tauri.json`. The owner's normal app and private sessions were not restarted or modified.

Observed through the real packaged UI:

1. Initial text screen enabled email, phone and labelled identifiers. Contextual choices were unchecked and marked **Cần tải thêm**. No automatic download started.
2. Without a pack, `Email: synthetic@example.com. CCCD: 007700112233.` produced complete EMAIL and CCCD aliases, with a notice that name/address/other categories were not checked.
3. Settings showed **712 MB** transfer, **1,14 GB** installed. Clicking **Tải về** began the explicit public R2 download. At pause, the UI showed **228 MB / 712 MB, 31%**.
4. Quit/reopen: the temporary text session disappeared. Settings retained the same progress and **Đã tạm dừng** state; it did not automatically resume.
5. Clicking **Tiếp tục tải** resumed the partial pack. The UI subsequently showed the distinct local installation stage (observed at 56%) and then **Sẵn sàng / 1,14 GB / Đã cài trên máy**.
6. Quit/reopen after successful install: all detection categories were available and selected. The following synthetic fixture produced exactly five complete masks, with no extra download action:

   `Khách hàng: Nguyễn Ngọc Hà. CCCD: 007700112233. Công ty Cổ phần Ánh Dương. Địa chỉ: 17/6 Nguyễn Văn Đậu, phường 5, Bình Thạnh, TP. Hồ Chí Minh. Email: ha@example.com.`

   Types: TEN, CCCD, TO_CHUC, DIA_CHI, EMAIL. The original view preserved the decomposed Unicode name and complete source. This repeats an existing integration fixture; it is not new accuracy evidence.
7. The test app was closed after verification. The isolated downloaded pack remains available for repeated developer checks.

The normal optimized macOS app build also passed. Its build overlapped the resumed download, so this flow is a functional check, not an install/inference timing benchmark. The normal app was not launched after building, preserving existing sessions.

## Network-disabled GUI attempt: inconclusive

After installation, launched the test executable using `sandbox-exec` with `(version 1) (allow default) (deny network*)`. The process remained alive but did not register an accessible running app/window; computer-use inventory showed the test app not running. It was terminated (SIGTERM, exit 143), and the subsequent UI verification used a normal launch.

Do not count this as a network-disabled GUI pass or an inference failure. Ordinary UI verification left the machine's network enabled. The earlier [production CPU replay](../recognition-production-v1/README.md) under OS network denial remains separate evidence; local runtime configuration/CSP and absence of additional download actions do not substitute for a completed disconnected-desktop test. No global network settings were changed.

Windows and Linux desktop runtime/installer checks were not run on this Mac. They remain pending, as do lower-memory hardware checks and long-document speed improvements.

# 0074 — The text page follows the pack download and install

Date: 13 October 2026. Status: requested by the owner ("while it's downloading, I guess we need to update the status here… including the installation status").

## Decision

When a selected category needs the recognition pack, the notice under "Sẽ ẩn" and the primary button on the text page follow the pack's stage, as the home strip and Settings already do (`packProgress` is shared):

| Stage | Notice | Notice action | Primary button |
| --- | --- | --- | --- |
| missing | Tải gói nhận diện để dùng các mục đã chọn. · 712 MB · Chỉ cần tải một lần | Xem chi tiết | Tải thêm để tiếp tục (starts the download, opens Cài đặt) |
| downloading | Đang tải gói nhận diện… n % + progress bar; "x MB / 712 MB · Tải xong sẽ tự cài đặt, rồi nút Ẩn thông tin bật lại." | Tạm dừng | Đang tải… n %, disabled with a spinner |
| installing | Đang cài đặt gói nhận diện… n %, then "Đang kiểm tra gói nhận diện lần cuối…" + progress bar; "Bước này không cần Internet. Xong là nút Ẩn thông tin bật lại." | Tạm dừng | Đang cài đặt… n % / Đang kiểm tra…, disabled |
| cancelling | Đang tạm dừng… | none | Đang tạm dừng…, disabled |
| paused | Đã tạm dừng tải · n % + progress bar | Tiếp tục tải (resumes in place) | Tiếp tục tải |
| error | Chưa tải xong gói nhận diện. + the error | Thử lại (in place) | Thử lại |

When the pack becomes ready the notice disappears and the button returns to "Ẩn thông tin" without leaving the page. Downloads still start only from an explicit click. After the owner's review the notice no longer offers "Xem tiến độ" (it already shows the progress) or says "Bạn vẫn có thể dùng ứng dụng trong lúc chờ" (unclear); it says what happens next and pauses in place, and category checkboxes read "Đang tải…" instead of "Cần tải thêm" while the pack is on its way.

## Verification

`pnpm lint`, `pnpm typecheck` and `pnpm test` passed. In the dev build, the pack status was set to each stage in turn with a name category selected; the notice, its action and the button matched the table, and the progress bar showed 33 % while downloading. The real download runs only in the desktop app and was not exercised here.

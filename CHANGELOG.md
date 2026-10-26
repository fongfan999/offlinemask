# Changelog

Notable changes to OfflineMask, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/) from 2.0.0 on ([Decision 0102](docs/decisions/0102-first-release-is-2-0-0.md)). Each entry links the decisions that carry the detail.

## [Unreleased]

## [2.3.0] — 2026-10-26

PDFs that contain text open on Tài liệu, saved copies are named (OfflineMasked), and masking is measured on whole sets of documents: 0 leaked and 0 over-masked on 189 invented invoices, statements, contracts and forms.

### Added

- Tài liệu opens PDFs that contain text, from the home page, the drop zone and the file picker (the sidebar says "DOCX, ODT, PDF"; the "Sắp có" item for PDF is gone, Hình ảnh stays). The masked copy is Markdown built only from the text read out of the file, so nothing hidden in the PDF (its metadata, form fields, earlier revisions) can follow it to the AI. Text is read by its place on the page, so tables become Markdown tables with each value under its heading, "Label: value" lines stay together, and the preview shows the first page the same way. A page without readable text (a scan) or in an old font is named, pictures are counted, and reading shows "Đang đọc trang 12 / 300" with Hủy. Restore takes the AI's .md or .txt reply, as well as .docx and .odt. Scanned PDFs and images are still to come ([0149](docs/decisions/0149-text-pdf-documents.md)).

### Changed

- Saved copies are named `<name> (OfflineMasked).<extension>` and restored ones `<name> (OfflineUnmasked).<extension>`, in every format, instead of "(đã ẩn)" and "(đã khôi phục)". Restoring still recognises the old names ([0150](docs/decisions/0150-offlinemasked-suffix.md)).
- Masking is now judged on whole sets of documents rather than on the file that showed a problem: a private set of real documents that stays on the owner's machine, with only counts recorded ([0152](docs/decisions/0152-document-evaluation-set.md)), and a public set of invented invoices, bank statements, contracts and forms generated as PDF and Word with their answers written for them, 189 documents over seven seeds ([0153](docs/decisions/0153-synthetic-document-set.md)). Every fix below was measured on both.

### Fixed

- Invoices: "HÓA ĐƠN GIÁ TRỊ GIA TĂNG", column headings, "Trang 1/1", a country on its own ("Thịt bò Úc") and brands in capitals (VISSAN, WINECO) are no longer masked as names, places or organizations, goods in a table row keep their names, and one company gets one alias. A tax code that is a 12-digit CCCD ("Mã số thuế (CCCD)", "MST/CCCD chủ hộ") is masked, "Hộ kinh doanh …" is one organization, and an address stops at a table cell ([0155](docs/decisions/0155-invoice-false-detections.md)).
- Bank statements and contracts no longer leak: account numbers after "TK", longer labels ("Tài khoản thụ hưởng:"), a field that ends at the next one on the same line, account holders, names by their position in transfer text, names after a form of address ("Bà Võ Minh Yến") and under a signature note, and a company in capitals in transfer text. 0 leaks on the 189 generated documents ([0154](docs/decisions/0154-statement-and-contract-leaks.md)).
- Over-masking closed by structure: Word and ODT tables are read by row like PDF tables, and show as tables in the preview; a heading in capitals ("SAO KÊ TÀI KHOẢN", "HỢP ĐỒNG THUÊ NHÀ"), unaccented transaction wording ("TRA LUONG THANG 9") and a cell under a wording column ("Quan hệ", "Chức vụ", "Tên hàng hóa") are not names, places or organizations; an amount with thousands separators is not a phone number; a currency code is not a place. 0 over-masked and 0 leaked on the 189 generated documents and the owner's invoices, and the pack gate's known miss is gone (21/21) ([0156](docs/decisions/0156-over-masking-by-structure.md)).
- Each step's action row has the same space above it as below a panel.

## [2.2.0] — 2026-10-25

Report a problem from the app in two clicks, and history that deletes itself.

### Added

- *Báo lỗi* in the sidebar: pick what went wrong and write a line or two, and OfflineMask opens a report page on OfflineMask.com with it filled in. The app itself still has no internet access; nothing is sent until you press *Gửi* on the website, and the report carries only what the page shows (the app version, the system family and the screen you were on) ([0147](docs/decisions/0147-bug-reports-through-the-website.md)).
- History deletes itself: Cài đặt › Mật mã · Lưu lịch sử offers *Tự xóa lịch sử sau* 1, 7, 30 or 90 days, 30 by default, counted from when each entry was made. Choosing a shorter period asks before it deletes older entries ([0143](docs/decisions/0143-history-deletes-itself.md)).

### Fixed

- A click on the OfflineMask circle after its selection was gone (another window had come to the front) could mask whatever was on the clipboard. The circle now acts only on the selection it was shown for and otherwise does nothing ([0141](docs/decisions/0141-circle-never-falls-back-to-clipboard.md)).

### Changed

- offlinemask.com shows the newest version and its release date beside the download button and on the bottom bar, so you can compare it with the version in Settings. Windows downloads from the Microsoft Store; Mac and Linux files download directly, never through a GitHub page, and always from the newest published release, which the site looks up when you visit. Installing a newer version over an older one keeps your settings, history and Vietnamese pack ([0139](docs/decisions/0139-downloads-without-github.md), [0140](docs/decisions/0140-latest-release-at-request-time.md)).

- The privacy page now names the connections the system's web view makes by itself: on Windows, WebView2 checks for its own updates at edge.microsoft.com and looks up names through the machine's DNS. They carry nothing you put into OfflineMask; the app itself still uses the network only when you click ([0138](docs/decisions/0138-system-web-view-connections.md)).

## [2.1.1] — 2026-10-24

Tidies the tray menu and Settings, and makes the circle's place list easy to see.

### Changed

- The tray menu no longer acts on the clipboard: it opens OfflineMask or its settings, switches Ẩn nhanh on and off with a check mark, and quits. Cài đặt drops the unfinished "Cài từ tệp", and "Cập nhật" now opens OfflineMask.com to compare versions. "Sắp có" badges are centred ([0137](docs/decisions/0137-tray-and-settings-cleanup.md)).
- Cài đặt › Thao tác nhanh shows where the OfflineMask circle appears by itself, always in view, as apps and sites you can remove one by one. Beside the circle, "Tắt ở …" and "Luôn hiện nút ở …" now look like the buttons they are ([0136](docs/decisions/0136-place-list-in-view.md)).

## [2.1.0] — 2026-10-24

The OfflineMask circle now shows only where an AI is.

### Changed

- The circle shows by itself only in AI apps (ChatGPT, Claude, Perplexity, Cursor, Windsurf) and on AI sites in a browser (chatgpt.com, claude.ai, gemini.google.com and others), on macOS and Windows. In other apps, such as Zalo, Mail or Word, the selected text is not read, and ⌘⇧M (Ctrl+Shift+M) still works everywhere. It never shows in a browser's address bar or in open and save dialogs. Hover the circle for "Tắt ở …" to turn it off in a place; after the shortcut in a place not on the list, "Luôn hiện nút ở …" adds it; Cài đặt › Thao tác nhanh shows the list. Firefox is not on it yet ([0135](docs/decisions/0135-circle-only-where-ai-is.md)).

## [2.0.5] — 2026-10-24

The first Microsoft Store build: masking works on first launch, start at login works in the package, and each step's main button stays in view.

### Changed

- The main button of each step stays in view while a long review or file list scrolls under it, and short results no longer sit in a tall empty box. After pasting the AI's reply, the restored copy gets the room under its own label, and its buttons share one row. Small labels are larger, spreadsheets show six columns side by side, and notes that were already done disappear ([0134](docs/decisions/0134-actions-in-view-and-readable-type.md)).

### Fixed

- In the Microsoft Store build, masking works right after the recognition pack downloads; it used to fail until the app was restarted. Start at login works there too: it now uses the package's startup task, and the switch says where to turn it back on if you turned OfflineMask off in Windows' Startup apps ([0117](docs/decisions/0117-microsoft-store-msix.md)).

## [2.0.4] — 2026-10-23

Makes Ẩn nhanh fast, keeps it off your clipboard and fixes it in Chrome, Dia and Zalo.

### Fixed

- On Windows, a paste the application drops opens the result in the preview card instead of showing a check mark, web editors count as editable, and a clipboard OfflineMask cannot read is no longer emptied when it puts it back ([0133](docs/decisions/0133-windows-paste-confirmation.md)).
- In Zalo's message box, and other web editors that macOS does not report as editable, the circle sits by the text and its click replaces the selection instead of opening the preview card ([0132](docs/decisions/0132-web-editors-accessibility-misses.md)).
- The OfflineMask circle shows within about half a second when the selection holds a phone number, an email or an ID, and its click no longer runs the detection a second time. A paste Chrome silently dropped is now caught and shown in the preview card ([0131](docs/decisions/0131-circle-speed.md)).
- Ẩn nhanh leaves your clipboard as it was. In native macOS apps it reads and replaces the selection through Accessibility; elsewhere it saves the whole clipboard (images, files and formatting included), copies or pastes, and puts it back unless you copied something meanwhile. Its own clipboard items are kept out of clipboard managers and Universal Clipboard, and the result no longer stays on the clipboard ([0130](docs/decisions/0130-quick-actions-borrow-the-clipboard.md)).
- On WASM recognition (Intel Macs, Linux, `pnpm desktop:dev`) the app's page no longer passes WebKit's 4 GB limit and gets reloaded. The recognition models used to take three copies of their weights in memory; they now load with one, so the page settles near 2.5 GB instead of 4.3 GB and stays up through repeated ⌘⇧M use. Recognition results are unchanged ([0129](docs/decisions/0129-wasm-weights-as-external-data.md)).
- The OfflineMask circle no longer spins forever when the app's page is reloaded mid-action. On WASM recognition (Intel Macs) WebKit kills the page once it passes 4 GB; the page now clears the circle when it comes back ([0128](docs/decisions/0128-webkit-kills-the-wasm-page.md)).
- A masked result no longer replaces text you selected elsewhere while masking was still running. Right before pasting, OfflineMask checks that the selection is still the text it masked; if not, the result opens in a card to copy from, and your clipboard is left as it was ([0127](docs/decisions/0127-paste-only-over-the-masked-selection.md)).
- On macOS, selecting text in Chromium and Electron apps (Chrome, Dia, Arc, Slack, Zalo) shows the OfflineMask circle again. Those apps expose the selection only after an assistive tool asks them to, and OfflineMask never asked ([0126](docs/decisions/0126-chromium-accessibility-tree.md)).

## [2.0.3] — 2026-10-22

Fixes the saved history after unlocking and the Ẩn nhanh circle on Windows.

### Fixed

- Unlocking with the passcode shows the saved history again. The lock page closed before it could hand the decrypted items over, so the list stayed empty, and the next masked text would have replaced the stored history ([0123](docs/decisions/0123-unlock-loads-history.md)).
- On Windows, clicking the OfflineMask circle after selecting text in another app replaces the selection again. The click was taken for a click elsewhere, because the circle is drawn by WebView2's own process, so the selection was dropped and only the clipboard was used; Ctrl+Shift+M was not affected. Selecting text inside OfflineMask no longer shows the circle there ([0122](docs/decisions/0122-windows-popover-own-window.md)).

## [2.0.2] — 2026-10-22

Fixes masking with the Vietnamese pack and the passcode settings on Windows.

### Fixed

- Masking with the Vietnamese recognition pack works on Windows. The pack's tokenizer looked missing because Windows serves the pack from an `http://asset.localhost` address, where Transformers.js skips its local-file check; every Windows build since 2.0.0 reported "Chưa xử lý được văn bản trên thiết bị" after loading the models ([0121](docs/decisions/0121-windows-pack-path-and-window-order.md)).
- Settings no longer says passcode and history exist only in the desktop app when the desktop app starts slowly. The windows were built before the app's state was ready, so the first passcode check could fail for the whole launch; the windows are now created after it ([0121](docs/decisions/0121-windows-pack-path-and-window-order.md)).

### Changed

- The recognition pack warms up in the background once it is ready, and again when the window comes back after a while, so the first mask does not wait for the first inference.

## [2.0.1] — 2026-10-20

Fixes the Windows app crashing on launch.

### Fixed

- The Windows app no longer panics on launch. The native build passed Tauri its frontend folder as an absolute path, which Tauri reads as a URL on Windows (`D:` as the scheme), so resolving the quick-action panel's page failed; the 2.0.0 Windows installers are affected. Found by the new MSIX launch check ([0117](docs/decisions/0117-microsoft-store-msix.md)).

### Added

- A Microsoft Store package (MSIX) built and launch-checked by the release workflow ([0117](docs/decisions/0117-microsoft-store-msix.md)).

### Changed

- The native recognition helper is its own Cargo package in the `src-tauri` workspace, so a release build compiles the app library once; the three macOS Services items no longer warn as dead code on Windows and Linux ([0107](docs/decisions/0107-helper-crate.md)).
- The repository is a pnpm workspace: the desktop app lives in `desktop/`, the product website in `landing/`, and the shared colour and type tokens in `brand/theme.css` ([0106](docs/decisions/0106-workspace-layout.md)). Package scripts run as `pnpm -C desktop …` and `pnpm -C landing …`.
- Release binaries are built with thin LTO instead of fat LTO, which roughly halves the build time; Linux releases ship `.deb` and `.rpm` only, the AppImage is withdrawn until the app has been tried on Linux ([0104](docs/decisions/0104-faster-release-builds.md)).

## [2.0.0] — 2026-10-19

The first public release. The number starts at 2.0.0 by the owner's choice; there was no 1.0.0.

### Masking and restoring

- Paste text, review what the built-in rules found, hide or keep each value, copy the result and paste the AI's reply back to restore the original values ([0004](docs/decisions/0004-text-processing.md), [0061](docs/decisions/0061-three-steps-and-copy-choice.md), [0070](docs/decisions/0070-text-screen-review-highlights.md)).
- Built-in rules recognise emails, phone numbers and labelled banking identifiers without any model files ([0005](docs/decisions/0005-library-text-detection.md), [0012](docs/decisions/0012-structured-credentials-and-identifiers.md), [0017](docs/decisions/0017-contextual-fields.md)).
- An optional recognition pack, downloaded from Settings and verified by size and SHA-256, adds names, addresses, organizations, birth dates, card and login details ([0042](docs/decisions/0042-production-recognition-pair.md), [0054](docs/decisions/0054-replaceable-recognition-packs.md), [0056](docs/decisions/0056-uninstall-recognition-pack.md)). On macOS arm64 it runs through a native helper ([0049](docs/decisions/0049-native-release-packaging.md)).
- Spreadsheets (XLSX, XLS, ODS, CSV): per-column choices, a masked copy with formatting kept, and restoration of the AI's returned file ([0076](docs/decisions/0076-spreadsheet-files.md), [0085](docs/decisions/0085-opendocument-spreadsheets.md), [0086](docs/decisions/0086-old-excel-files.md)).
- Documents (DOCX, ODT): text, tables, headers, footers, notes and comments masked with formatting kept ([0078](docs/decisions/0078-word-documents.md), [0084](docs/decisions/0084-opendocument-text.md)). TXT and MD files open on the text page ([0083](docs/decisions/0083-plain-text-files-open-in-text.md)).
- Every file ends with a review of each hidden value and type before saving ([0079](docs/decisions/0079-file-review-and-capital-names.md)).

### Ẩn nhanh and quick actions (macOS, Windows)

- A small button appears beside text selected in any application when a click would hide something; one click masks or restores in place ([0096](docs/decisions/0096-selection-popover.md), [0100](docs/decisions/0100-circle-same-detection.md), [0101](docs/decisions/0101-circle-by-the-text.md)).
- ⌘⇧M / Ctrl+Shift+M does the same from the keyboard, with the clipboard as fallback ([0090](docs/decisions/0090-clipboard-quick-actions.md), [0091](docs/decisions/0091-in-place-replace.md)).
- Background mode with a menu bar / tray icon, an optional login item, and macOS Services for selected text and Finder files ([0092](docs/decisions/0092-background-mode.md), [0094](docs/decisions/0094-macos-services.md), [0097](docs/decisions/0097-single-instance.md)).

### History and privacy

- Private sessions stay in memory unless a six-digit passcode is set; then they are kept in an encrypted vault on the device, with no recovery for a forgotten passcode ([0062](docs/decisions/0062-passcode-vault.md), [0065](docs/decisions/0065-six-digit-passcode.md), [0071](docs/decisions/0071-history-needs-passcode.md)).
- No telemetry, no automatic network access, no update check; the pack download is the only network action and the user starts it ([0050](docs/decisions/0050-osaasy-license.md), [SECURITY.md](SECURITY.md)).

### Known limits

- PDF and image input are not implemented.
- Only macOS on Apple Silicon has been tested by hand; Windows x64 builds in CI and awaits manual qualification ([0077](docs/decisions/0077-native-recognition-windows.md)); Linux is untested.
- Builds are not yet signed or notarized ([release notes](docs/release/macos-arm64.md)).
- Detection has documented misses and over-masking; review the result before sharing it ([evidence](docs/evaluations/recognition-production-v1/README.md)).

[Unreleased]: https://github.com/fongfan999/offlinemask/compare/v2.1.1...HEAD
[2.1.1]: https://github.com/fongfan999/offlinemask/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/fongfan999/offlinemask/compare/v2.0.5...v2.1.0
[2.0.5]: https://github.com/fongfan999/offlinemask/compare/v2.0.4...v2.0.5
[2.0.4]: https://github.com/fongfan999/offlinemask/compare/v2.0.3...v2.0.4
[2.0.3]: https://github.com/fongfan999/offlinemask/compare/v2.0.2...v2.0.3
[2.0.2]: https://github.com/fongfan999/offlinemask/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/fongfan999/offlinemask/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/fongfan999/offlinemask/releases/tag/v2.0.0

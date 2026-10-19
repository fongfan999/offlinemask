# Changelog

Notable changes to OfflineMask, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/) from 2.0.0 on ([Decision 0102](docs/decisions/0102-first-release-is-2-0-0.md)). Each entry links the decisions that carry the detail.

## [Unreleased]

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

[Unreleased]: https://github.com/fongfan999/offlinemask/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/fongfan999/offlinemask/releases/tag/v2.0.0

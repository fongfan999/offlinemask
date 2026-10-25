# 0150 — Masked copies are named "(offlinemasked)"

Date: 25 October 2026. Status: implemented. Owner: "I don't like the (đã ẩn) suffix, it's Vietnamese which isn't friendly, I want it (offlinemasked) globally."

## Decision

Every masked copy the app saves is named `<name> (offlinemasked).<extension>`: spreadsheets (`.xlsx`, `.csv`, `.ods`), Word and OpenDocument documents, and a PDF's Markdown (`Hợp đồng (offlinemasked).md`, decision 0149). It was `<name> (đã ẩn).<extension>`, which shows as a Vietnamese phrase with diacritics in other people's file lists, chat attachments and AI uploads, and reads as nothing to someone who does not read Vietnamese. The product's own name says what happened to the file.

- The suffix is one constant, `maskedSuffix` in `desktop/src/adapters/sheet-files.ts`, used by both the spreadsheet and the document flows.
- Restoring names its copy from the returned file without the masked suffix (`withoutMaskedSuffix`), which removes both `(offlinemasked)` and the old `(đã ẩn)`, so files masked before this change still restore to a clean name.
- The restored copy's suffix stays `(đã khôi phục)`; the owner asked only about the masked one.
- Only file names change. On-screen words such as "Tải tệp đã ẩn" and "bản đã ẩn" stay Vietnamese like the rest of the interface.

Earlier decisions that show `(đã ẩn)` in examples describe the names of their time and are not edited.

## Verification

`tests/file-names.test.mjs` covers the new names for a spreadsheet, a Word file and a PDF, and removing both suffixes when restoring. `pnpm lint`, `pnpm typecheck` and `pnpm test` (382) pass.

# 0150 — Saved copies are named "(OfflineMasked)" and "(OfflineUnmasked)"

Date: 25 October 2026. Status: implemented. Owner: "I don't like the (đã ẩn) suffix, it's Vietnamese which isn't friendly, I want it (offlinemasked) globally"; then, for restored copies, "it should use offlinemask as a verb", choosing "offlineunmasked", and "it's hard to read, so I think we need to capitalize both cases".

## Decision

The product's name is the verb in the names of the copies the app saves, in every format: spreadsheets (`.xlsx`, `.csv`, `.ods`), Word and OpenDocument documents, and a PDF's Markdown (decision 0149).

- A masked copy: `<name> (OfflineMasked).<extension>`, e.g. `Hợp đồng (OfflineMasked).md`. It was `<name> (đã ẩn).<extension>`.
- A restored copy (the AI's file with the real values back): `<name> (OfflineUnmasked).<extension>`. It was `<name> (đã khôi phục).<extension>`.

The Vietnamese suffixes showed as phrases with diacritics in other people's file lists, chat attachments and AI uploads, and read as nothing to someone who does not read Vietnamese. Run together in lower case, "offlinemasked" and "offlineunmasked" were hard to read; capitalising each word fixes that and matches how the product writes its name.

- The suffixes are two constants, `maskedSuffix` and `unmaskedSuffix` in `desktop/src/adapters/sheet-files.ts`, shared by the spreadsheet and the document flows.
- Restoring names its copy from the returned file without the masked suffix (`withoutMaskedSuffix`), which removes `(OfflineMasked)` in any case and the old `(đã ẩn)`, so files masked before this change still restore to a clean name.
- Only file names change. On-screen words such as "Tải tệp đã ẩn" and "Tải tệp đã khôi phục" stay Vietnamese like the rest of the interface.

Earlier decisions that show `(đã ẩn)` or `(đã khôi phục)` in examples describe the names of their time and are not edited.

## Verification

`tests/file-names.test.mjs` covers masked names for a spreadsheet, a Word file and a PDF, and restored names from a new, a lower-case, an old Vietnamese and an unsuffixed file. `pnpm lint`, `pnpm typecheck` and `pnpm test` (382) pass.

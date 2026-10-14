# 0084 — OpenDocument text (.odt) under Tài liệu

Date: 14 October 2026. Status: requested by the owner ("support .odt") after a comparison of Word-like formats. `.doc`, `.rtf`, `.docm`/`.dotx` and Pages stay unsupported: they cost much more for little gain, or their apps export to `.docx` in one step.

## Decision

Tài liệu opens, masks, saves and restores `.odt` files exactly like `.docx` ([0078](0078-word-documents.md)), in the same three steps with the same review list ([0079](0079-file-review-and-capital-names.md)). The format is detected from the file's contents: an ODF package starts with its uncompressed `mimetype` entry. `src/core/doc/document.ts` dispatches between the two readers and writers.

- **Reading** (`src/core/doc/odt.ts`): `content.xml` (body, tables, lists, notes, comments, text boxes and tracked deletions) and `styles.xml` (headers and footers) are scanned with the same tag scanner as Word. ODF keeps text directly in `text:p`/`text:h` and their spans, links and fields, so each run of character data in the text namespace is a segment. `text:s`, `text:tab` and `text:line-break` are spaces, tabs and breaks, and whitespace collapses as ODF displays it. Metadata inside a paragraph, such as a comment's `dc:creator`, is not text.
- **Writing** reuses Word's segment rewriting (`rewriteParts`), so each replacement takes the formatting of the run it starts in, and every other byte of the XML stays the same. `mailto:` link targets get the email's alias. Author names are cleared: `dc:creator`/`meta:initial-creator` in `meta.xml`, and comment and tracked-change authors. `mimetype` stays the first, stored entry, as ODF requires.
- **Thumbnails.** An `.odt` normally carries `Thumbnails/thumbnail.png`, a picture of the first page and therefore of the original text. The masked copy drops it and its manifest entry. Word files can carry the same thing (`docProps/thumbnail.*`, saved by some Word versions), so `.docx` copies now drop it and its relationship too.
- Password-protected `.odt` files, other ODF types such as spreadsheets, and broken packages get the "unreadable" message, now naming LibreOffice and passwords. The copy names both formats: home card "Word, ODT", subtitle "Mở tệp Word hoặc LibreOffice (.docx, .odt)", drop zone "Kéo thả tài liệu vào đây" with ".docx, .odt · tối đa 20 MB".

## Verified

`pnpm lint`, `pnpm typecheck` and `pnpm test` pass (248), with new tests for:
- reading spans, encoded spaces, tabs and breaks;
- comment authors not being read as text;
- a full mask and write: body, header, `mailto:` link, authors, thumbnail and manifest, `mimetype` first and stored, reopening the copy;
- refusing encrypted and non-text packages;
- the Word thumbnail.

LibreOffice is not installed on this Mac. Instead, macOS `textutil` converted the owner's 34 799-character book to `.odt` (in a scratch folder). The parser read exactly the text `textutil` reads from that file. A masked copy with 9 replacements reopened with all 9 aliases and none of the originals, and `textutil` read the masked file back. In the browser preview, a synthetic `.odt` opened, previewed, masked and showed its review list.

Not verified: files produced by LibreOffice itself, and opening a masked copy in LibreOffice and Word. Both belong in the owner's next manual check.

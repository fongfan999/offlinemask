# 0079 — Review hidden values before saving; capitalized names in files

Date: 14 October 2026. Status: requested by the owner ("go ahead with A + B, then try C") after masking a real Word file, a Buddhist studies book of 166 paragraphs (34 799 characters). The masked copy replaced 636 names, 175 places and 61 organizations. Of its 414 distinct "names", 147 had no capital letter ("tử", "kỷ", "bị", "ngàn", "lạc thú"), and public names and places were hidden too (Đức Phật, Ấn Độ). The flow worked; the models over-hid.

## A — Review list before saving (Tài liệu and Bảng tính)

Step 2 ("Tải về và gửi AI") shows **Kiểm tra trước khi tải** under the preview: every distinct hidden value with its type and how many places it occurs, most frequent first ("Đức Phật · Họ và tên · 12 chỗ"). Unchecking a value keeps it as it is everywhere in the file. One chip per type ("Họ và tên 268") keeps or hides the whole type for this file, and shows a partial state when only some of its values are kept. A search box appears past 12 values, ignores accents ("duc phat" finds "Đức Phật") and keeps its height while filtering; the list shows the 100 most frequent matches.

- Masking still hides everything it finds first; the review only gives values back. This keeps the safe default and leaves the AI-bound copy to the user's judgement.
- Every change updates the preview, the "Đã ẩn" count and the session's alias table at once, so what is shown is what will be saved, and restoring knows only what the file hides. The download writes the original edits minus the kept values (`keepCells`, `keepReplacements`); a spreadsheet cell with nothing left hidden is written unchanged, including whole-column hides.
- The full findings, counts and kept choices live in RAM with the open file, like the file itself ([0076](0076-spreadsheet-files.md)). The list appears only while the file can still be saved; nothing new is persisted, and history stores only what the saved copy hides.
- The text page keeps its own per-finding review; it is unchanged.

## B — Names in files need a capital letter

In documents and spreadsheets only, a name (`TEN`) span with no capital letter is dropped before replacement (`detectionReplacements`). Files are formal written text, where Vietnamese personal names are capitalized; on the owner's book this rule alone removes 147 of the 414 distinct "names", none of them a name. The text page keeps every span, because chat and email often carry lowercase names (the pack gate's `lowercase-name` fixture covers it). Places and organizations are unchanged: lowercase locations are rarer and "Ấn Độ"-style public names are what A is for.

## C — Model score threshold (experiment)

The two models score every token; a decoded span carries the mean probability of its tokens, and the app kept every span (`threshold: 0`). Because a threshold changes recognition on every page, the text page included, it was adopted only if no gate regressed. `scripts/score-threshold/evaluate.mjs` loads the installed pack once (Node CPU runtime, native tokenizer harness, network disabled) and, for each threshold, runs:

- the pack gate's 14 fixtures (`tests/fixtures/recognition-pack.json`, as `pnpm test:models`);
- 232 annotated synthetic cases with 299 entities (release-challenge-v1, text-reliability holdout and final, address holdout, model-decision): full coverage per entity and over-masking;
- the owner's book, counting model findings only (no text is printed or stored).

| Min score | Pack fixtures | Annotated entities fully covered | Names / addresses | Over-masking | Book: names (without capital) | Book: places | Book: organizations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 (before) | 13/14, 1 known miss | 299/299 | 90/90 · 77/77 | 0.64 % | 786 (248) | 184 | 67 |
| **0.3 (adopted)** | 13/14, same known miss | 299/299 | 90/90 · 77/77 | 0.59 % | 500 (82) | 179 | 67 |
| 0.4 | 13/14 | **298/299** | 90/90 · 77/77 | 0.55 % | 337 (10) | 173 | 65 |
| 0.5 | 13/14 | **298/299** | 90/90 · 77/77 | 0.51 % | 257 (1) | 157 | 58 |
| 0.6 | **12/14** (`lowercase-name` fails) | | | | 193 (1) | 145 | 52 |
| 0.7 | **12/14** | | | | 166 (3) | 134 | 41 |

At 0.4 and above, an organization in `organization-extracted` is only partly covered (13 of 21 characters); from 0.6 the gate's lowercase chat name is missed. **0.3 is adopted**: it is the highest value tested with no regression. It is pack data (`minScore` on each model in `packs/vietnamese-pii-v1.json`, validated in `pack.ts` and the Rust catalog) and applies to WASM and native alike. The install fingerprint covers only the model files, so no download is needed. Book counts are detector findings per paragraph; the saved copy counts slightly fewer after overlaps are resolved.

Together on the book: of 786 model names, 418 remain after 0.3 and the capital-letter rule. Most of what remains are public names such as Đức Phật, and places such as Ấn Độ also remain; the review list is for those. Higher thresholds would cut more, but they lose real values on the labelled cases, and that trade belongs to the user, value by value, rather than to a global setting.

## Verified

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:models` with the installed pack, `cargo fmt --check`, Clippy with `-D warnings` and the Rust tests pass, with new tests for grouping and counts, kept values in documents and spreadsheets (including whole-column hides), aliases from other files, and the capital-letter rule. In the browser preview, the sample document and spreadsheet were masked, values and types were unchecked, and the preview, summary and type chips updated; the layout was checked at desktop and phone widths.

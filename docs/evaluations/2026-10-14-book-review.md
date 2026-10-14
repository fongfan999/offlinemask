# Book excerpt review — 14 October 2026

A Word excerpt of a Buddhist studies book (the book of decision [0079](../decisions/0079-file-review-and-capital-names.md); here 165 paragraphs with letters, 43 000 characters, 5 detector batches) masked by the app after decision 0080 was compared with its original. The findings led to [decision 0081](../decisions/0081-one-word-spans-and-field-codes.md). Only counts are recorded; the book is public but it is the owner's file. Same harness and runtime as the [contract review](2026-10-14-contract-review.md): the owner's copy came from the app, the before/after columns from the scratch harness on the Node CPU runtime (its "before" count is a little higher than the app's because the CPU and WASM runtimes do not produce identical logits; both are shown).

## What was hidden

| | Owner's copy (app, policy 0080) | Harness before 0081 | Harness after 0081 |
| --- | ---: | ---: | ---: |
| Replacements | 480 | 585 | 404 |
| Distinct aliases | 292 | 344 | 262 |
| Name aliases | 192 | 205 | 152 |
| Address aliases | 69 | 76 | 58 |
| Organization aliases | 31 | 63 | 52 |
| Private values in the text | 0 (a public book: authors, monks, places, scripture titles) | | |

Of the 205 distinct names before, 84 were one word at 179 places (after: 28 at 40 places) ("Đại" 17, "Hán" 17, "Tạp", "Thánh", "Tam", "Kinh", "Chánh", "Ấn"…); 29 of 76 places were one word at 88 places ("Bộ" 34, "Việt" 15, "Tạng" 6); 23 of 63 organizations. The page-number field code in the footer ("PAGE \* MERGEFORMAT") was replaced by two name aliases.

## Where the one-word spans come from (raw model output, threshold 0)

| Model | One-word name spans | Above its 0.3 threshold | Above 0.6 | Multi-word spans, median score | One-word spans, median score |
| --- | ---: | ---: | ---: | ---: | ---: |
| Underthesea INT8 | 122 | 114 | 60 | 0.91 | 0.62 |
| mSuperClinical INT8 | 870 | 318 | 0 (max 0.58) | 0.31 | 0.28 |

Eight short chat sentences with a bare given name ("Chị Lan ơi, gửi em file nhé", "Gọi cho Hùng lúc 5h chiều", "Em là Vy…", "Giao hàng cho bạn Đạt ở Huế", a cell holding only "Trâm"): Underthesea scores every name and the city 0.96–1.00; the second model 0.57–0.92. A 0.6 bar on one-word spans therefore keeps every genuine single name the pair finds (the first model carries them) and removes every one-word span the second model produced on the book.

## Regression checks

| Check | Before 0081 | After 0081 |
| --- | --- | --- |
| Pack gate, 18 fixtures | 17/18, known miss | 17/18, same known miss |
| Annotated corpora, 299 entities at 0.3 | 299/299 | 299/299 |
| Over-masked lexical characters | 184 | 167 |
| Owner's contract (replacements / aliases) | 21 / 20 | 20 / 19 (the project-name word is gone) |
| Unit tests | 240 | 242 |

An intermediate version of the rule lost the unaccented "Hop tac xa Nong san Suoi Mo" in the challenge corpus: its only seed for the legal-prefix completion had been a one-word "Suoi" at 0.3 from the second model; the first model reads "Nong san Suoi Mo" as a place at 0.98, and the completion now accepts a place-labelled seed too.

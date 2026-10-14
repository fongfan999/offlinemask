# 0081 — One-word model spans need a confident score; field codes are not prose

Date: 14 October 2026. Status: requested by the owner ("I just tested a random file, please review the result, anything we can improve?") after masking a Word excerpt of a Buddhist studies book (the same book as decision [0079](0079-file-review-and-capital-names.md), 165 paragraphs with letters, 43 000 characters). The masked copy replaced 480 places with 292 aliases; counts are in [the evaluation](../evaluations/2026-10-14-book-review.md), no text of the book is recorded.

## What the copy showed

- **Single syllables.** Of the hidden "names", 84 distinct values at 179 places were one word: "Đại" (17 places), "Hán" (17), "Tạp", "Thánh", "Tam", "Kinh", "Chánh", "Ấn" and so on, the syllables of Sino-Vietnamese titles and terms that Title Case makes look like names. Places and organizations had the same pattern ("Bộ" 34 places, "Việt" 15, "Tạng" 6).
- **Where they come from.** Raw scores per model: the second model (OpenMed mSuperClinical) produced 870 one-word name spans on this file, 318 of them above its 0.3 threshold and none above 0.58. Underthesea's one-word spans have a median score of 0.62 against 0.91 for its multi-word spans. On eight short chat sentences with a bare given name ("Chị Lan ơi…", "Gọi cho Hùng lúc 5h", "Em là Vy…", "bạn Đạt ở Huế"), Underthesea scores every name and the city 0.96–1.00, and the second model 0.57–0.92.
- **Field codes.** The page-number field in the footer, "PAGE \* MERGEFORMAT", was replaced by two name aliases inside the field instruction, which breaks the field in the masked copy. Decision [0078](0078-word-documents.md) reads field instructions so that a `mailto:` link target can get the email alias; it did not say that their other words are Word syntax.

## What changes

1. **A one-word name, place or organization needs a mean token score of at least 0.6** (`singleWordMinScore` in `src/core/detection/model-policy.ts`), unless the word is the whole text (a spreadsheet cell, a one-word message). Model spans now carry their score (`Detection.score`); adjacent name pieces are joined first, so a lowercase chat name such as "nguyễn văn an" (three words at 0.3) is untouched, and so is every multi-word span. The bar is below every genuine single name measured (0.96 and up on the first model, which alone decides the pair's coverage) and above every one-word misreading of the second model on the book. Underthesea's own confident one-word mistakes ("Người" for the Buddha at 0.99, "Phật") stay; the review list is for those. The rule is shared policy: text page, spreadsheets and documents alike, any pack.
2. **Field instructions keep their syntax.** A paragraph read from `w:instrText` is marked `field`; document masking replaces only contact and structured values in it (the `mailto:` email), never names, places or organizations.

## Verified

On the book: 585 replacements and 344 aliases before (harness), 404 and 262 after; one-word names fall from 84 distinct at 179 places to 28 at 40, all of them the first model's confident readings. The owner's contract: 21 replacements and 20 aliases before, 20 and 19 after. Annotated corpora unchanged at 299/299 with 167 over-masked characters (184 before); pack gate 17/18 with the same known miss; 242 unit tests. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm test:models` with the installed pack pass.

# 0080 — Contracts: parties, boilerplate and company names

Date: 14 October 2026. Status: requested by the owner after masking a real Word contract (a collaborator agreement, 140 paragraphs): "accuracy is the core feature of the app … no accuracy, no one will use the app". The original and the masked copy were compared paragraph by paragraph; counts are in [the evaluation](../evaluations/2026-10-14-contract-review.md). No private text from the contract is recorded anywhere in the repository.

## What the comparison showed

The masked copy replaced 231 places with 63 distinct aliases. Most of them were not private information:

- **The parties.** "Bên A", "Bên B", "BÊN A", "bên B", "Các Bên", "Bên bị vi phạm" were hidden under 19 different aliases of three types (name, address, organization), so the contract no longer said who owed what to whom. Both models score these between 0.3 and 0.9, the same range as real names, so no score threshold separates them (decision [0079](0079-file-review-and-capital-names.md) C already measured that).
- **Headings and boilerplate in Title Case.** "Phí Dịch Vụ - Thanh Toán", "Sự Kiện Bất Khả Kháng" (under eight aliases), "Mọi Thông Tin Mật", "Bằng chữ: Tám triệu…", "Điều 9", "Phạt", the document title.
- **Two leaks.** The company name after "BÊN A\t:" survived except its first two words, because the model's span ran over the label and the colon and the company rule found no evidence past the legal prefix. The second signatory's name on the last line survived because the model predicted one name across the paragraph separator and the document path kept only the first paragraph's share.

The second model (OpenMed mSuperClinical) contributed only sub-word fragments on this text ("ên", "háng"); every usable finding came from Underthesea. The models are unchanged by this decision; the shared policy around them is.

## What changes (shared policy, every page, any pack)

All of it lives in `src/core/detection/model-policy.ts`, `policy.ts`, `context-fields.ts` and `src/core/sheet/mask.ts`, applies to the text page, spreadsheets and documents alike, and is pack-independent: a replacement pack inherits it.

1. **A predicted span never crosses a field separator or a line.** Colons, tabs and line breaks cut a model span into pieces (names and organizations also end at a sentence end; addresses keep "TP. HCM"). The label part of "BÊN A\t: CÔNG TY…" and the two signatures on consecutive lines now stand on their own.
2. **Contract parties are roles.** A name, address or organization span that is exactly "Bên" plus a letter, a number or a role from a closed list ("thuê", "cho thuê", "thứ ba", "bị vi phạm", "còn lại", "cung cấp dịch vụ"…), optionally preceded by "Các", "Hai", "Mỗi", is dropped. The list is closed so that "bên chị Lan" keeps the name and "Bến Thành" stays a place.
3. **A name, place or organization has letters.** Two letters at least (a place may count digits: "Quận 5"); "B", "A", "163", "29" are misreadings.
4. **Contract boilerplate is never an entity.** A span lying inside a known phrase, a run of phrases, or an amount written in words is dropped: "sự kiện bất khả kháng", "hợp đồng", "dịch vụ", "thanh toán", "thù lao", "bằng chữ", "thông tin mật", "án phí", "phạt vi phạm", "giấy ủy quyền", "sản phẩm", job titles ("giám đốc tài chính", "kế toán trưởng"), "Tám triệu tám trăm nghìn đồng" and so on. Whole phrases only: "Nguyễn Thanh Toán" and "Công ty Dịch vụ Bình An" reach past them and are kept. The check runs per model window and again on the whole text, where a phrase cut by a window edge is whole.
5. **A party label completes the company name.** The legal-prefix rule ("Công ty Cổ phần …", "Hợp tác xã …") now accepts "Bên A:", "Bên mua:", "Đại diện:", "Khách hàng:" and similar labels as context, and model evidence anywhere on the name (the prefix included) as its seed.
6. **A span over the paragraph separator reaches every paragraph it touches.** Document and spreadsheet batches clip such a span to each paragraph instead of keeping the first one only.

Rule 4 is a list and will not know every heading; the review list of decision 0079 remains the place for what it misses. Numbers that are also names ("Tám", "Bốn") are dropped only inside an amount written in words.

## Gate

`tests/fixtures/recognition-pack.json` gains four synthetic contract fixtures (parties and header fields, clauses that name the parties, Title Case headings with an amount in words, a signature block across lines), so a replacement pack must keep "Bên A / Bên B / Các Bên" and the headings readable while hiding the company, the people, the address, the identifiers and the contacts. `tests/model-plausibility.test.mjs` covers each rule with fake predictions.

## Models

The owner asked for the models to be re-evaluated and for new ones to be researched if needed. The search on 14 October found no Vietnamese token-classification checkpoint newer than the September screens ([pretrained search](../evaluations/pretrained-search-v1/README.md), [challenger screen](../evaluations/vietnamese-pii-challenger-screen.md), [GLiNER2](../evaluations/gliner2-compact-v1/README.md)) with a declared license and an ONNX graph. OpenMed publishes three more Vietnamese PII models (SuperClinical-Base 184M DeBERTa, SuperMedical-Large 355M, SnowflakeMed-Large 568M; Apache-2.0, INT8 ONNX, FIRSTNAME/LASTNAME/STREET/CITY/ORGANIZATION labels) that were never scored here; they are clinical models like the shipped mSuperClinical, which contributed nothing on this contract. The failures above were policy gaps, fixed without a model change and measured as such; replacing a model is a separate step with the procedure in [packs/README.md](../../desktop/packs/README.md), and the 184M DeBERTa is the first candidate to score if the 916 MB second model is to be replaced.

## Verified

On the contract: 231 replacements and 63 aliases before, 21 and 20 after, no private value left visible, every party designator and heading kept. Annotated corpora unchanged at 299/299 entities with the same over-masking; pack gate 13/14 with the same known miss plus 4/4 contract fixtures; 240 unit tests. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm test:models` with the installed pack pass.

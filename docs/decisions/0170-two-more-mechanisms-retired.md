# 0170 — Two more mechanisms retire: the fine-tuned graph needs neither the transaction-cell veto nor the trims at a span's edges

Date: 28 October 2026. Status: implemented and measured. Decision 0169, after the owner's "Yes, ship it": "`transactionCells` and `trims` retire in their own measured change, as 0165 retired two mechanisms, against the shipped baseline."

## Why

The ablation of the shipping pack on 27 October (0164) measured each mechanism of `plausibleModelDetections` against the base Underthesea model: `transactionCells` held back 93 over-masked spans and 2 unlisted ones over seeds 1–7, and `trims` was the only mechanism whose removal leaked (six addresses, five over-masked). Both runs of the fine-tuned candidate (0166, 0168) switched the same mechanisms off on the same 557 documents and nothing came back: the fine-tuned graph does not read a statement's unaccented wording ("TRA LUONG THANG 9", "Thanh toan QR") as a name, place or organization, does not stick a brand in capitals to a name's edge, and does not run an organization or a name on into a department line or an address. The graph of run 2 ships since 0169, so the two mechanisms are cost without a measurement behind them, which 0161 asked the policy to stop carrying. Before anything was touched, the same ablation was run on the installed shipped graph (`e562a9b3…`), with the two mechanisms switched off one at a time: every run read 0 not read, 0 leaked on the synthetic seeds, 0 over-masked and 0 unlisted on every set, the shipped baseline exactly, with the one bank name in the owner's draft invoice expectation in all three (845 s).

## What changed

- `model-policy.ts` loses `transactionCell` with its date-cell and amount-cell patterns, `withoutBrands` with `brandInCapitals`, and `withoutUnit` with the `unitStart` and `unitInPlace` patterns; a model's span now goes through the eight remaining mechanisms as the model produced it. The name-shape test is no longer read by the policy at all (`looksLikeName` stays in `person-cues.ts` for its own readers).
- `vetoes.ts` loses the two names, so the comparison harness lists eight mechanisms.
- `vocabulary/organizations.json` loses `units.inPlaces` (the unit kinds that can follow a place: "phòng", "khoa"), which only `unitInPlace` read; `vocabulary.ts` no longer exposes it. The unit kinds and their exceptions stay: `departments` reads them. Nothing else in the vocabulary belonged to either mechanism.
- Tests: the direct test of `brandInCapitals` goes with the function. Three expectations of hand-written model spans moved to what the policy now does, each a shape the shipping graph does not produce on the held-out sets: "JOHN NGUYỄN" is kept whole instead of trimmed to "NGUYỄN" (a foreign given name in capitals is part of the name, so this is the better answer); "Rẫy Khoa Nhi" and an organization continued into "Phòng Đào tạo" are no longer cut by a rule; the unaccented wording of a statement's rows is no longer vetoed by a rule, and a name in the shape of one in such a row still stands. The harness test's example of a mechanism whose ablation leaks is now `singleWords`.

## Result

After the change, the shipped graph on the same sets:

- `pnpm -C desktop compare:packs --seeds 1-7` (546 synthetic documents, the owner's invoices and decision): 0 / 1 / 0 / 0 over all sets in 236 s, the shipped baseline of 0169 (`desktop/artifacts/compare/2026-10-28-shipped-e562a9b3/report.md`) exactly: zeros on every synthetic seed, and the one bank name in the owner's draft invoice expectation that 0166 explained.
- `--seeds 8-26` (1 482 documents plus the owner's sets): 0 / 1 / 3 / 0 over all sets in 660 s, the over-masked texts in seeds 13, 15 and 20, the candidate's row of [2026-10-28-candidate-run-2.md](../evaluations/2026-10-28-candidate-run-2.md) (0 / 1 / 3 / 0 over all sets: the same three job titles).
- `pnpm lint`, `pnpm -C desktop typecheck`, `pnpm -C desktop test` (429 tests) and `pnpm -C desktop test:models` on the installed root (23/23 fixtures) pass.

The tables are in [2026-10-28-two-mechanisms-retired.md](../evaluations/2026-10-28-two-mechanisms-retired.md).

## Known limits

- What the two mechanisms did is now the model's to get right. A statement cell written without tone marks that the model reads as a name, place or organization will be masked; a brand in capitals the model includes in a name, and a department line or a house number the model runs an organization into, will be masked with it. On 2 050 held-out documents the fine-tuned graph does none of this; the ablation table of a future candidate is where it would show, as `unlisted` or `over` counts.
- The remaining eight mechanisms still hold something back for this graph (0168: a fraction of what they held back for the base model, except `singleWords`). They stay until a candidate's ablation says otherwise, one measured change each.

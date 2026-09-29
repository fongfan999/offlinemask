# Alternative model decision — 10 September 2026

**Alignment fix implemented: the current models no longer fail on the observed uppercase unknown-token input. Keep the recognition pack unchanged. BigMed is the leading broad alternative; Underthesea is a promising smaller specialist, not a complete replacement.**

## Results that matter

The same 66 synthetic cases contain 97 annotated values. Each JavaScript/CPU configuration ran twice in an isolated process with identical quality outcomes. No thresholds, local recognizers, or annotations were adjusted to favor the new candidates. [Full results and runtime measurements](2026-09-10-alternative-comparison.md) are backed by [raw outcomes and fingerprints](2026-09-10-alternative-comparison.json).

| Configuration | Runtime assets | Fully covered values | Names | Addresses | Other private information |
| --- | ---: | ---: | ---: | ---: | ---: |
| Current pair, alignment repaired | 1,407.7 MB | 81/97 | 35/39 | 10/17 | 6/10 |
| BigMed INT8 | 872.6 MB | 82/97 | 30/39 | 12/17 | 10/10 |
| Underthesea INT8, native-offset reference¹ | 205.5 MB | 76/97 | 35/39 | 12/17 | 1/10 |
| Underthesea FP32, native-offset reference¹ | 460.2 MB | 77/97 | 36/39 | 12/17 | 1/10 |

¹ The Underthesea rows use a separate native-tokenizer quality reference to distinguish model quality from six failures in the experimental JavaScript adapter. They are not desktop integration results, and their long-document windows differ. See [reference details](2026-09-10-underthesea-reference.md). All category counts above measure all-options masking; selecting the category alone can reduce coverage (BigMed names 29/39 and other 9/10; Underthesea INT8 names 34/39).

BigMed reduces the candidate asset footprint by approximately 38% and masks fewer ordinary characters on short cases (0.69%, versus the pair's 1.85%). It completes seven values the pair only partially covers, including password/username strings, an IP address and several addresses. However, it loses six values the pair fully covers: five names and one unaccented address. Its one-point overall gain is therefore not a safe replacement decision. It meets neither the provisional name-coverage floor nor the no-new-misses criterion.

It also fails three of the 12 ongoing model regressions: `mixed-contact-address`, `lowercase-name`, and `unaccented-names`, all through incomplete name masking. The other nine pass. The repaired current pack passes all 12. This independently blocks promotion under the existing regression gate; a slightly higher aggregate diagnostic score cannot override these losses.

Underthesea's approximately 205 MB export is much smaller and has useful name/location coverage. But its published label set only covers persons, locations, organizations and miscellaneous entities. It cannot be presented as broad privacy detection. The reference loses eleven values the pair currently completes, while gaining six. Quantization gains one unaccented name and loses two other names compared with FP32. Do not assume that smaller weights preserve all original predictions.

## Engineering outcome

- The production detector now preserves raw tokenizer pieces and their real model predictions, including unknown IDs. Token layout and logits are validated before source alignment. The failing uppercase example is now an ongoing regression.
- The current pair and both single baselines complete the 66-case comparison without request failures after the repair. Coverage and excess lexical masking totals are unchanged by the fix.
- BigMed completes all cases through the experimental JavaScript adapter. Its CPU runtime is lower than the current pair in these measurements, but this does not establish desktop WebView/WASM performance.
- Underthesea's JavaScript adapter still fails on six inputs. Native exact-offset tokenization processes them, showing that those failures belong to integration rather than the model's learned entity predictions. Shipping this model requires a reliable exact-offset tokenizer path, not suppressing errors.
- No candidate meets the screening floor. No installed model files, production download manifest, category choices, automatic network behavior, or installer contents were changed to adopt an alternative.

## Recommended next step

Prioritize reliable exact-offset tokenization and complete name/address handling before adding further checkpoints. BigMed should be the broad single-model baseline for future work; Underthesea should remain the compact name/location baseline. Keep libraries and well-defined local recognizers for structured identifiers. Evaluate any improvements on a separate independently reviewed set before changing the pack. Do not add a user-facing model catalog or make users choose technical checkpoints.

Candidate downloads were explicit developer actions, with pinned revisions and verified hashes. Underthesea export/quantization tooling lives in an isolated Python environment and is absent from the application. [Protocol and reproduction](alternative-model-protocol.md).

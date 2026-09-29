# Contextual Unicode and boundary diagnosis — 19 September 2026

Two shared address-boundary fixes are applied. An isolated NFC inference adapter for Underthesea recovers five missed names but introduces one false-positive case. The compact candidate remains unqualified for release; the installed pack and its preprocessing are unchanged.

## What was repaired

`completeAddressBoundaries` now accepts a bounded `số <number> <proper street>` component and recognizes `chuyển thư về/đến/tới` as address context. A connected address still requires textual address-model evidence. These changes recover three complete current-pair addresses, including the additional `validation-lane` case, and two compact-candidate addresses. No added ordinary masking or complete/partial/own-category coverage losses occurred for either model in this evaluation.

The normalized-source adapter creates an NFC copy solely for candidate inference, then maps model detections back to complete graphemes in the untouched original string before applying shared policy. It preserves case, accents, compatibility characters and original UTF-16 offsets. It is developer-only and uses the existing native-reference tokenizer helper, not a newly shipped Python dependency. No weights or tokenizer artifact were edited.

## Diagnosis

The candidate's local tokenizer uses BertNormalizer with `lowercase: false`, `strip_accents: null`, `clean_text: true` and no NFC normalizer. [Hugging Face documentation](https://github.com/huggingface/tokenizers/blob/main/docs/source-doc-builder/components.mdx), checked through Context7, distinguishes BERT normalization from canonical Unicode composition and describes source alignment. Actual local traces establish the behavior for this pinned tokenizer.

[Selected token evidence](contextual-repair-v1/token-examples.json) retains exact pieces, labels, scores and source offsets:

| Failure | Observed evidence | Conclusion |
| --- | --- | --- |
| Decomposed `Đỗ Hải Yến` and other NFD names | Raw words become `[UNK]`/`O`; composed forms receive person labels. Native offsets identify the original words in both cases. | Input normalization problem, not displaced source offsets. NFC recovers five names. |
| Lowercase `đỗ hoàng phúc` | Correctly located subwords all receive `O`. | Remaining classification miss. |
| `H’Hen Niê` | Person labels on `H` and `Hen`, location labels on the apostrophe and `Niê`. | Wrong category sequence; Unicode composition does not resolve it. |
| `Lâm Quốc Hưng` | Person tags on the first two words, organization tag on `Hưng`. | Category confusion; all-options masking concealed the own-category failure. |
| Uppercase report headings | Person tags appear directly on ordinary headings. | Contextual false positives; no blanket case filter is justified. |
| Unaccented cooperative name | Legal prefix is `O`; body receives location tags. | Classification/coverage error, still unresolved. |
| Alley and slash-number addresses | Valid address components were not joined, or a street received person labels while adjacent locality evidence existed. | Bounded address context repairs full coverage without guessing arbitrary names. |

NFC additionally masks `· ễ` in `fresh-negative-unicode`, where the decomposed grapheme `ễ` is ordinary test content. This adds **three source UTF-16 letter/mark positions in one case**, not three words. Actual tokens show person labels on the separator and composed letter. Source mapping is correct; classification is wrong. This regression is preserved in the results and blocks describing normalization as a clean quality win. No special-case suppression or tuned threshold was introduced.

## Evaluation

The [specification](contextual-repair-v1/spec.md) predates implementation and the [protocol](contextual-repair-v1/protocol.json) freezes source/fixture/baseline fingerprints before inference. The protocol embeds the previous address source; older protocols/results remain unchanged. [Results](contextual-repair-v1/results.json) include exact gain/loss lists, remaining errors, aggregate metrics and raw-run hashes.

- Current pair: 362 actual case executions, unchanged weights and preprocessing.
- Underthesea INT8: 362 raw case executions plus 15 additional NFC case executions. Already-NFC inputs reuse their actual predictions; their mapped output must match exactly.
- Total: **739 case executions**. Each may contain multiple token-bounded windows.
- Both before-policy baselines exactly reproduce all-options and six individual-category previews from the preceding experiment.
- Native and JavaScript token IDs must match for each predicted chunk; mapping never searches for a plausible name in the source.
- **151 tests pass**, including canonical mapping, combining-mark tails, repeated names, emoji, long graphemes, invalid offset rejection and address/prose contrasts. Type checking passes.
- Assets are local and hash-checked; fetch is forbidden during runs. No download, training or tracking occurred. No new desktop/resource claim is made.

### Results

“Own category” means an annotated value is fully covered when only its intended category is selected. Ordinary positions count source letters, marks and numbers outside annotations. Retain full denominators and unchanged screening criteria.

| Model / configuration | Corpus | Full coverage | Own category | Ordinary positions | Screening |
| --- | --- | ---: | ---: | ---: | --- |
| Pair before | Regression | 320/328 | 319/328 | 192 | Fail |
| Pair + address repair | Regression | 323/328 | 322/328 | 192 | Fail |
| Pair before / after | Challenge | 142/142 | 142/142 | 24 | Fail |
| Underthesea before | Regression | 320/328 | 318/328 | 267 | Fail |
| Underthesea + address repair | Regression | 322/328 | 320/328 | 267 | Fail |
| Underthesea + NFC only | Regression | 322/328 | 320/328 | 270 | Fail |
| Underthesea + both | Regression | 324/328 | 322/328 | 270 | Fail |
| Underthesea before / address only | Challenge | 138/142 | 138/142 | 0 | Fail |
| Underthesea + NFC / both | Challenge | 141/142 | 141/142 | 0 | Pass |

No variant loses complete, partial or own-category sensitive coverage on these examples. Address-only repair adds no ordinary positions. NFC and the combined compact experiment add the three ordinary positions described above. Passing the observed challenge subset does not override the failed regression set or establish release accuracy.

## Decision and limits

Apply the bounded address fixes. Keep the normalized candidate adapter available for subsequent development comparisons, with its regression explicitly retained. Do not switch packs. Token evidence now distinguishes recoverable normalization/boundary problems from contextual classification errors; further integration work alone cannot be assumed to solve the latter.

Remaining compact own-category misses are lowercase/unaccented names, an ethnic name, an uppercase name, a mixed person/organization name, a lowercase address and the unaccented organization. Ordinary headings still account for substantial excess masking. Avoid repairing these with fixture-specific word lists, blanket case conversion or adjacent-category merging.

All examples are developer-authored synthetic material and were already observed. New unit probes are developer tests, not independent human review. No real user input/corrections were captured. A final model decision still requires a defensible contextual quality/false-positive tradeoff, source/runtime qualification and independent validation. Custom training remains deferred.

## Reproduction

Use pinned assets, the existing tokenizers 0.22.2 interpreter, and the exact prior raw artifacts `artifacts/structured-gaps-v1/{combined,underthesea}.json`. Protocols and report/run files are create-only; reproduce in a separate checkout/output arrangement without overwriting historical evidence.

```sh
OFFLINEMASK_EVAL_PYTHON="$PWD/artifacts/tokenizer-evaluation-env/bin/python" mise exec -- node scripts/contextual-repair-v1/evaluate.mjs underthesea
OFFLINEMASK_EVAL_PYTHON="$PWD/artifacts/tokenizer-evaluation-env/bin/python" mise exec -- node scripts/contextual-repair-v1/evaluate.mjs combined
mise exec -- node scripts/contextual-repair-v1/report.mjs
mise exec -- pnpm test
mise exec -- pnpm typecheck
```

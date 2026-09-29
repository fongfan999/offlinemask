# Results after all 24 owner approvals — 19 September 2026

**Neither candidate qualifies for release.** All 24 expectations were explicitly approved before inference, in four hash-bound six-case receipts. Both pinned candidates then ran once on the same approved input, with the existing canonical NFC mapping and unchanged shared detector. No weights, thresholds, policy, category scope or annotation was changed after the outputs were seen.

The initial pending ledger is historical. [Approval 4](review-first-validation-v1/approvals/04-examples-19-24.json) links the preceding approvals, and the [execution protocol](review-first-validation-v1/execution-protocol.json) froze their chain and evaluator scripts before execution. All 24 approvals and original annotation hashes were verified before and after both runs.

## Results

| Measure on this batch | Underthesea INT8 | BigMed INT8 |
| --- | ---: | ---: |
| Complete sensitive values, correct own category | 26/30 | 22/30 |
| Complete person-name occurrences | 5/8 | 1/8 |
| Complete addresses | 3/4 | 4/4 |
| Complete organizations | 4/4 | 3/4 |
| Remaining structured values | 14/14 | 14/14 |
| Cases with complete own-category coverage and no extra lexical masking | 17/24 | 14/24 |
| Extra ordinary lexical source positions masked | 99 | 8 |
| Fully ordinary cases with lexical false positives | 2/5 | 2/5 |
| Existing screening criteria | Fail | Fail |
| Execution errors | 0 | 0 |

Person totals count occurrences, including both occurrences in the one repeated-name example; they are not eight independent scenarios. Structured values comprise customer/account/document IDs, contacts, payment/security values, credentials, birthday and IP. Most such types appear only once: 14/14 here does not establish general structured-value reliability.

The excess-mask rate under the existing source-letter/mark/number metric is 9.31% for Underthesea and 0.75% for BigMed. That metric deliberately ignores punctuation and symbols. The full previews remain essential: BigMed also masks checkbox/checkmark/emoji content in example 24. Those symbols are visible in the comparison, but do not contribute to the eight lexical positions. The 17/24 and 14/24 counts use the established metric; they do not assert byte-for-byte equality with proposed spans or assess every punctuation choice.

## Concrete failures

- Both miss the complete lowercase name in example 1 and unaccented lowercase name in example 2.
- Underthesea detects the uppercase name in example 3 but also masks the ordinary closing heading. It detects only `H’Bliên` in example 4 and misses the lowercase address in example 8. Examples 20 and 21 show further ordinary-heading masking.
- BigMed masks only `THIÊN` in example 3, misses the name in example 4, omits `Lã` in the decomposed name in example 5, and omits the surname from the first occurrence in example 6 while finding the second fully. In example 14 it masks only `Hạ` from `Nghiêm Hạ Vy`.
- BigMed misses the unaccented organization in example 12. Both preserve the reviewed organization scope; no organization rule was removed.
- BigMed masks the ordinary word `trong` in example 20, and a decomposed character plus symbols/emoji in example 24. Underthesea also masks `trong` in example 20.

[Full per-example comparison](review-first-validation-v1/comparison.md) includes the approved input/spans and both actual outputs. [Machine-readable results](review-first-validation-v1/results.json) retain all six individual-category previews, partial coverage, missed values, false positives, per-type counts and raw-run hashes. The same original UTF-16 source spelling is retained for decomposed text.

## What this changes

The earlier 12-example owner review favored BigMed on selected cases, but this new batch exposes severe name omissions. That is why a small favorable review score cannot select the model. This run strengthens the rejection for both existing checkpoints under the current scope, rather than opening another cycle of fixture-specific patches.

The [prior broad comparison](single-model-decision-v1.md) remains in force. These new measurements are reported separately, not pooled into a supposedly independent sample or substituted for previous failed evidence. The batch was assistant-authored with knowledge of earlier failures and then reviewed by the owner before execution. It is fresh relative to these model runs, but is targeted synthetic validation, not independently sourced field data or a representative banking accuracy estimate. After this execution, it is an observed regression set.

No production code, pack, runtime integration or dependency changed. Custom training remains deferred. The current development pair is also not made release-qualified by rejecting alternatives. Further release work requires a materially different qualifying candidate or explicitly changed product requirements; repeating these unchanged models or adding example-specific exceptions will not provide new selection evidence. No new model search or scope change is initiated by this report.

## Verification

There were **48 case executions**, 24 per candidate, with no recorded errors. All 24 approval bindings, exact source spans and evaluator/runtime/source fingerprints passed verification. Model assets were hash-checked against the pinned manifest, only local files were loaded, and fetch was forbidden during inference. This does not claim a new OS-level network-deny or packaged-app test.

The [run verification](review-first-validation-v1/execution-verification.json) records final artifact hashes. No application tests were rerun because production code was unchanged; the task exercised the frozen inference adapters and new evaluation orchestration directly. Previous application test results remain historical.

The create-only scripts are `freeze-execution.mjs`, `evaluate.mjs` and `report.mjs` under `scripts/review-first-validation-v1/`. Use the pinned local assets and the existing tokenizers 0.22.2 interpreter. Future reruns must preserve these results and original approval evidence. Use separate output paths or a versioned experiment; do not rewrite approval hashes to accommodate changed source.

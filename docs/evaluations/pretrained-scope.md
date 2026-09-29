# Pretrained models with a narrower responsibility

**Adopting a pretrained model remains the more sustainable direction, but restricting its labels is not enough to make the current system release-ready.** The comparison identifies concrete work in the shared recognizers and contextual boundaries. Custom MiniLM fine-tuning stays deferred.

Five configurations were rerun on the same 362 observed synthetic cases: **1,810 case executions**. Every unrestricted all-options and category-selected output exactly reproduced the frozen prior results, including the model-derived stage. Actual detector arrays were then filtered to names, addresses and organizations before passing through the unchanged shared policy. No predictions were reconstructed from masked previews, and no difficult private values were removed from scoring.

## Comparison

The following regression results use the narrowed contextual role plus existing local policy. Names/addresses count complete values covered when their own category is selected. The full-value total uses all categories, so it can be higher even when a value is assigned to the wrong category.

| Contextual model | Existing pinned assets¹ | Names / 103 | Addresses / 111 | Full values / 328 | Ordinary characters masked² |
| --- | ---: | ---: | ---: | ---: | ---: |
| SuperClinical | 475.3 MB | 75 | 102 | 294 | 47 |
| mSuperClinical | 932.4 MB | 98 | 81 | 284 | 103 |
| Existing pair, control | 1,407.7 MB | 99 | 106 | 310 | 137 |
| BigMed | 872.6 MB | 87 | 107 | 299 | 21 |
| Underthesea INT8 | 205.5 MB | 96 | 108 | 310 | 267 |

¹ Historical verified model/tokenizer/support assets from the preceding comparison, not installer sizes or newly measured downloads. The proposed 300 MB optional-pack budget is met only by Underthesea among these candidates. No size budget was silently relaxed.

² Short regression cases contain 7,678 ordinary lexical characters. Counts are absolute to make small denominators visible. Underthesea's 267 is about 3.48%, and affects seven entirely ordinary regression cases. These counts cannot estimate real-world banking accuracy.

On the 100-case challenge (142 private occurrences), the narrowed routes yield:

| Contextual model | Names / 39 | Addresses / 13 | Organizations / 7 | Full values / 142 | Ordinary characters masked |
| --- | ---: | ---: | ---: | ---: | ---: |
| SuperClinical | 33 | 13 | 7 | 131 | 10 |
| mSuperClinical | 37 | 9 | 6 | 129 | 13 |
| Pair, control | 39 | 13 | 7 | 136 | 23 |
| BigMed | 34 | 13 | 6 | 130 | 0 |
| Underthesea INT8 | 36 | 13 | 6 | 132 | 0 |

Challenge cards are uniformly scored under the product's “other” category for every route. Organizations have typed challenge annotations; the older regression set has coarse categories, so no invented regression organization score is supplied. Zero ordinary masking on one corpus does not erase failures on the other. **Every narrowed route still fails the unchanged full-scope screen.**

## What narrowing loses

Compared with each candidate's unrestricted run, narrowing loses 7/6 complete values for SuperClinical, 3/3 for mSuperClinical, 7/6 for the pair, and 10/6 for BigMed (regression/challenge). Underthesea changes nothing because its supported mapped model labels were already limited to people, locations and organizations.

The lost structured information includes card numbers, CVV, PIN, an account after a tab-separated label, IPv4 and a written birth date. These values were previously supplied by the models; the current local recognizers do not independently cover them. For example, removing the pair's structured predictions loses all three challenge card occurrences and all three challenge IPv4 occurrences. Fewer false positives is not sufficient justification for that regression.

The proposed division of responsibility therefore needs implementation and evaluation, not just filtering:

| Responsibility | Existing evidence | Required next action |
| --- | --- | --- |
| Email and phone | All 30 email and 32 phone occurrences covered across these two observed sets | Preserve syntax bounds and regression tests; no universal claim |
| Labelled banking identifiers | Actual no-pack route covers 32/33 regression and 31/31 challenge values | Repair tab-separated account context without guessing bare numbers |
| Card/CVV/PIN | Current rules depend on contextual model assistance for measured cases | Add explicit contextual recognizers and ordinary-number contrasts; preserve “other” category |
| IP | IPv6 parser exists; observed IPv4 gaps remain | Add validated IPv4 handling with version/decimal/address-token negatives |
| Birth dates and credentials | Existing bounded rules, including one measured written birth-date gap | Fix explicit semantics and preserve complete opaque values; avoid broad number/date heuristics |
| Names, addresses, organizations | Still require pretrained context and complete source spans | Review Unicode, category conflicts and false positives separately; rules cannot recover every unseen name |

These responsibilities are engineering proposals. They do not change the six UI options, pack requirements, claimed capabilities or release thresholds.

## Real no-pack scope versus experimental rule-only scope

The main diagnostic's `local` field is the raw `localDetections()` helper, which may produce credentials/postcodes before the engine filters by user choice. It is **not** the actual no-pack output. The [addendum](pretrained-scope/local-scope-addendum.md) preserves and corrects that interpretation with a separate run through `createDetectionEngine()` using email/phone/banking options. No model loading occurs.

The [engine results](pretrained-scope/local-engine-results.json) cover **72/73 selected-scope regression values and 53/53 selected-scope challenge values**, with no ordinary-character masking on those fixtures. Scored against the whole product scope, those same outputs cover only 72/328 and 53/142. The generic six-category pass flag is not applicable to a three-category selected denominator; explicit counts are retained instead of announcing a pass.

The separate `rules` route invokes the full contextual policy with no model predictions. It covers 184/328 and 91/142, without ordinary-character masking in these observed sets. It is an experimental baseline, not a shipped no-pack capability. Neither result licenses presenting structured data as completely solved.

## Adoption and maintenance recommendation

Keep **Underthesea INT8 as the compact contextual candidate** and **BigMed as the broad pretrained comparison control**. This is prioritization for further engineering, not selection of a shipping checkpoint. Underthesea best matches the small optional-pack budget and already has the proposed label responsibility. Its known misses, excessive masking and development-only native offset adapter remain blockers. BigMed has less excess masking but materially worse name coverage here and assets well above the proposed budget; it is not an automatic fallback. SuperClinical's name misses and mSuperClinical's address misses make either a poor default for the general text promise measured here. The pair remains a historical development control, not the release solution.

Do not equate “pretrained” with “maintained” or “qualified.” A manual check of the [Underthesea checkpoint page](https://huggingface.co/undertheseanlp/vietnamese-ner-v1.4.0a2) on 18 September 2026 shows Vietnamese token classification and an Apache-2.0 metadata declaration, but its README is empty. Detailed data provenance, documented quality and update/support expectations are not established by that page. A library license or metadata tag alone is not a maintenance commitment or a full provenance review. The [SuperClinical card](https://huggingface.co/OpenMed/OpenMed-PII-Vietnamese-SuperClinical-Small-44M-v1) describes Vietnamese PII training; its publisher metrics use another dataset and do not override our measured failures.

Our maintenance commitment should be explicit and finite: pin a reviewed upstream revision, maintain local recognizers and source mapping, retain synthetic regression evidence, evaluate proposed upgrades manually, and publish versioned recognition packs only after checks. Customer content and corrections never become evaluation data. No automatic upstream updates, online inference or training-data collection are needed. Upstream staleness does not force an automatic update; it means reassessing a known pinned version deliberately.

Next implement the bounded structured recognizer gaps first, without changing contextual weights or user scope. Then inspect the compact candidate's exact name/ordinary-text failures and validate any repair on separately authored, reviewed examples. If its contextual errors cannot be addressed without broad heuristics, keep it experimental and reconsider the product promise openly. Do not return automatically to fine-tuning, an ensemble or an unbounded search for larger checkpoints.

## Evidence and reproduction

The [specification](pretrained-scope/spec.md), [frozen protocol](pretrained-scope/protocol.json) and [results](pretrained-scope/results.json) preserve exact source hashes, comparison lists and raw-run hashes. Per-case findings live under ignored `artifacts/pretrained-scope/`. The separate engine audit preserves its own source hashes. Previous results and all production source fingerprints remain unchanged. **139 tests pass**, including scoring-denominator preservation and selected-output replay checks. This work adds developer evaluation tooling and documentation only.

Use existing pinned assets and the local tokenizers 0.22.2 interpreter. No model payload was downloaded for this comparison. With fresh/explicitly archived destinations:

```sh
mise exec -- node scripts/pretrained-scope/freeze.mjs
mise exec -- node scripts/pretrained-scope/evaluate.mjs small
mise exec -- node scripts/pretrained-scope/evaluate.mjs large
mise exec -- node scripts/pretrained-scope/evaluate.mjs combined
OFFLINEMASK_EVAL_PYTHON=/absolute/path/to/existing/env/bin/python mise exec -- node scripts/pretrained-scope/evaluate.mjs bigmed-native
OFFLINEMASK_EVAL_PYTHON=/absolute/path/to/existing/env/bin/python mise exec -- node scripts/pretrained-scope/evaluate.mjs underthesea
mise exec -- node scripts/pretrained-scope/local-engine.mjs
mise exec -- node scripts/pretrained-scope/report.mjs
```

Run candidates sequentially. The harness forbids fetch during inference; cached native-reference tokenization is developer-only. This is not a new packaged-runtime/network-isolation proof, and no new speed or memory ranking is claimed. The 362 cases are already observed regression material, not fresh validation. The owner's pending annotation review is not completed by this experiment.

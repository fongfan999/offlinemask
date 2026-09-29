# Quality-first v1 model selection

19 September 2026. **Selected for integration: Underthesea + BigMed + mSuperClinical, all INT8.** Model evidence is limited to names, addresses and organizations; existing local rules handle structured values. The app's installed development pack has not been changed. No recipe passes every release check.

## What “best” means here

The user requires automatic contextual masking and asked for the highest-success model(s) for v1, prioritizing quality over optional-pack size. Before these fresh runs, [the protocol](protocol.json) fixes the ranking: pass the existing screening floors first; then maximize complete expected values hidden under their correct user options; minimize unnecessary lexical masking; prefer fewer/smaller checkpoints if tied. Whole-case correctness is also reported so a high sensitive-value recall cannot conceal extra masking.

Execute four previously qualified-to-run model adapters independently, then replay every nonempty subset with all supported model labels or only contextual labels. This yields 30 recipes. No thresholds, corpus expectations or production rules change. No case-specific oracle routes between models. The previously tested GreenNode configuration remains rejected; this comparison does not imply a global search of all available weights or prompts. Underthesea FP32 was not rerun in this round; earlier precision comparisons remain separate evidence.

## Results that drive the choice

The ranked data contains 386 synthetic case records and 500 annotated sensitive values. The 12-case earlier owner-review overlay overlaps the historical corpus and is excluded from ranking. Each model was executed on all 398 entries. Cases match only when all expected values are completely hidden under their correct options and no unannotated lexical positions are masked; punctuation/symbol excess is outside the historical lexical metric, so exact previews remain necessary.

| Recipe | Complete values, correct option | Cases matching expectations | Extra ordinary lexical positions | Pinned model assets |
| --- | ---: | ---: | ---: | ---: |
| **Underthesea + BigMed + mSuperClinical, contextual** | **496/500 (99.2%)** | 345/386 (89.4%) | 482 | ~2.01 GB |
| Underthesea + mSuperClinical, contextual | 495/500 (99.0%) | 349/386 (90.4%) | 467 | ~1.14 GB |
| BigMed + mSuperClinical, contextual | 493/500 (98.6%) | 351/386 (90.9%) | 223 | ~1.80 GB |
| SuperClinical + mSuperClinical, all labels | 492/500 (98.4%) | 326/386 (84.5%) | 321 | ~1.41 GB |
| Underthesea alone | 489/500 (97.8%) | 360/386 (93.3%) | 369 | ~206 MB |

The current pair row uses the same new canonical-normalization evaluation adapter for comparability; it is not a new packaged-app measurement. Sizes sum pinned evaluation files, including metadata present in their source manifests, and are not installer sizes or RAM. Underthesea's ONNX graph was converted locally; it has no newly published download URL in this task.

The selected trio recovers more complete sensitive values but causes more editing than several alternatives. It is a **coverage-first integration choice**, not the highest whole-document correctness, a declaration that 99.2% of real data is protected, or a relaxation of the release gate.

### Selected candidate by evidence set

| Set | Cases | Correct-option coverage | Ordinary positions masked | Negative cases changed |
| --- | ---: | ---: | ---: | ---: |
| Historical regression | 262 | 325/328 | 341 | 20/63 |
| Historical challenge | 100 | 142/142 | 13 | 3/24 |
| Owner-approved 24 | 24 | 29/30 | 128 | 3/5 |
| Earlier owner overlay (not ranked) | 12 | 12/13 | 88 | 3/3 |

Across ranked cases, 26/92 examples containing no expected sensitive values are changed. In the 24-case batch: names 7/8, addresses 4/4, organizations 4/4 and structured values 14/14 under their own options. Only 17/24 cases match completely. This is why the high coverage percentage cannot stand alone.

Four complete-value failures remain: `name-lowercase`, `name-unaccented-lowercase`, `address-lowercase`, and reviewed `rv02`. The first two and `rv02` contain lowercase names; the address is lowercase too. The names/address are only partially covered or incorrectly categorized. No missed case was removed from the result.

### Why three models

Measured by removing one component from the selected trio, with everything else fixed:

| Component | Additional fully covered values | Extra ordinary lexical positions |
| --- | ---: | ---: |
| Underthesea | 3 | 259 |
| BigMed | 1 | 15 |
| mSuperClinical | 4 | 95 |

BigMed's marginal benefit is the complete lowercase address in reviewed example 8. It adds about 873 MB for that observed gain. mSuperClinical adds names and an organization missed by the other two together. Underthesea adds two unaccented names and an unaccented address. These are corpus-specific marginal effects, not guaranteed model specialties. Adding SuperClinical to the trio recovers no further complete values and adds 31 ordinary positions, so it is excluded. Full per-value contributions are in [selection.json](selection.json).

## Larger GLiNER2 candidate: compatibility blocked

The owner authorized reconsidering [AITeamUIT/gliner2-pii500k-final-model](https://huggingface.co/AITeamUIT/gliner2-pii500k-final-model), previously parked for its ~1.244 GB published files. Pin revision `e15225965c361fc4ec6e5681eaec5312c63b71a8`; retrieve metadata, tokenizer/config and the safetensors header before full weights.

Using the official [GLiNER2 runtime](https://github.com/fastino-ai/GLiNER2), PyPI version 2.0.0, instantiate its model on Torch's metadata-only device and compare every expected tensor key and shape. All ordinary keys match, but the checkpoint also contains `span_scorer.null_bias` and `span_scorer.u_null`; the stock model does not implement them. Its config explicitly enables `null_score`. The model card links `jackboyla/GLiNER2`, which could not be retrieved (web access returned 404; GitHub API access returned 403, not proof the repository is deleted). No matching public implementation was obtained.

The [compatibility receipt](gliner-compatibility.json) records the exact mismatch. No model inference or accuracy score is reported for AITeamUIT; no complete 1.2 GB weight download was performed. Loading with ignored unknown keys or inventing a null-score calculation would evaluate a modified model with unverified semantics. The blocker is a matching implementation, not a judgment of this model's quality. No publisher was contacted on the user's behalf.

## Integrity and reproduction

1. `prepare.mjs` verifies inherited source/corpus/approval hashes and freezes this round's sources and criteria.
2. `evaluate.mjs <variant>` verifies pinned assets and executes `underthesea`, `bigmed`, `small`, or `large` on CPU using the already validated adapters. NFC inference is restored to original UTF-16 grapheme offsets. Remote model loading/caches are disabled; fetch is denied. The native tokenizer subprocess uses local files/offline flags. All inputs are synthetic.
3. `compare.mjs` scores every frozen recipe through the unchanged shared rules and all six user options. `report.mjs` moves the full 30-recipe output without changing its bytes to ignored `artifacts/quality-first-v1/full-results.json`; the checked-in result keeps the rankings and selected previews. This avoids repeating all 30 full corpora in source control.
4. `verify.mjs` replays all 11,940 recipe/case combinations, exact six-option previews, raw single-model scores, summaries and ranking. All 1,592 underlying model/case executions have zero errors. [The receipt](verification.json) pins raw/full/compact/selection hashes and confirms historical sources and owner approvals are unchanged.

Run project tools through `mise exec --`. Set `OFFLINEMASK_EVAL_PYTHON` to the local tokenizers 0.22.2 interpreter when running inference. Existing evidence can be checked with:

```sh
mise exec -- node --experimental-strip-types scripts/quality-first-v1/verify.mjs
```

Reproduction requires ignored pinned assets and raw artifacts, as in earlier experiments. Protocol/result creation uses exclusive writes; preserve completed runs when making another experiment. Identical normalized inputs are cached during this developer evaluation, so these times are not latency benchmarks. No app dependencies, startup/network behavior, model downloads, private history, training pipeline or production detector have been changed.

## Handoff for integration and later AI engineering

- Use [selection.json](selection.json) for exact graph hashes, upstream revisions, order and category filtering. Retain the shared `Detection` interface, NFC-to-original offsets and user option behavior across future text/Excel/PDF/image adapters.
- Port/qualify native tokenization and offset behavior without developer Python/reference-plan caches. A JS tokenizer mismatch must never silently replace the tested BigMed/native path.
- Package and explicitly distribute the converted Underthesea artifact; do not fabricate a hosted URL or switch the active manifest before the assets are actually installable and verified. Keep one Vietnamese pack in the UI, excluded from the default installer.
- Measure the assembled stack in the packaged app: cold/warm/long text latency, peak memory, cancellation and failure behavior, plus startup/processing network silence. Individual historical resource measurements cannot qualify this trio.
- Retain the four misses and excess-masking negatives as regressions. The entire corpus is observed synthetic selection data, not a fresh holdout or a sufficient training corpus. Future independent evaluation should distinguish complete-value recall, per-category coverage, negative-case behavior and correction burden.
- Automatic name/address/organization detection remains required. The existing quality gate is **NOT_PASSED**; manual review cannot be presented as having satisfied it. Specialist engineering being planned for a later release does not establish current safety or accuracy.

See [Decision 0037](../../decisions/0037-quality-first-v1-candidate.md). This selection provides a concrete implementation target while preserving the remaining work and failed checks.

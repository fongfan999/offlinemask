# Model comparison with the improved shared core

Completed 18 September 2026; protocol frozen 17 September. **None of the tested configurations qualifies for release. No single candidate can replace the incumbent pair without measured coverage losses. The pair also fails the release quality screen.** Keep the installed development pack unchanged.

## Comparable results

All six configurations use the same current production policy, pinned local model files and 362 previously observed synthetic cases. Each ran twice in separate sequential Node CPU processes: 4,344 case executions, zero request failures and identical detection outputs between repeats. The pair exactly reproduces the preceding context-field results. Repeated executions are not independent examples or new validation.

Regression corpus: 262 cases, 328 private occurrences, 63 entirely ordinary cases. The short-case ordinary-character denominator is 7,678.

| Configuration | Full values / 328 | Name-only / 103 | Address-only / 111 | Other-only / 41 | Ordinary characters masked, short | Affected ordinary cases / 63 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| SuperClinical | 301 | 75 | 102 | 38 | 81 (1.05%) | 13 |
| mSuperClinical | 287 | 98 | 81 | 34 | 136 (1.77%) | 17 |
| Existing pair | 317 | 99 | 106 | 38 | 192 (2.50%) | 23 |
| BigMed, native preprocessing | 309 | 87 | 107 | 41 | 83 (1.08%) | 10 |
| Underthesea INT8 | 310 | 96 | 108 | 32 | 267 (3.48%) | 7 |
| Underthesea FP32 reference | 310 | 95 | 108 | 32 | 306 (3.99%) | 7 |

Every configuration covers all 20 emails and 20 phones under their own category. Banking-only is 33/33 for SuperClinical, the pair and BigMed; 32/33 for mSuperClinical and both Underthesea variants. No configuration passes the unchanged regression gate.

Challenge corpus: 100 cases, 142 private occurrences, 48 record families and 24 entirely ordinary cases. Prose, field and simulated-extraction variants of one record are related. The short-case ordinary-character denominator is 5,426.

| Configuration | Full values / 142 | Name-only / 39 | Address-only / 13 | Ordinary characters masked, short | Affected ordinary cases / 24 | Critical failures, product scope / 65 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| SuperClinical | 137 | 33 | 13 | 11 (0.20%) | 1 | 0 |
| mSuperClinical | 132 | 37 | 9 | 13 (0.24%) | 3 | 0 |
| Existing pair | 142 | 39 | 13 | 24 (0.44%) | 4 | 0 |
| BigMed, native preprocessing | 136 | 34 | 13 | 15 (0.28%) | 0 | 0 |
| Underthesea INT8 | 132 | 36 | 13 | 0 | 0 | 3 |
| Underthesea FP32 reference | 132 | 36 | 13 | 0 | 0 | 3 |

Historical challenge annotations place cards in banking, while the product places cards in “other.” The results retain the unchanged historical view and a separate, uniformly rescored product-scope view using the saved category predictions. Under the latter, all four OpenMed configurations cover the three cards and all designated critical occurrences; Underthesea misses all three cards. **Every configuration still fails the challenge gate after correcting that mismatch.** The pair fails on four affected ordinary cases; others also have contextual-type failures. Zero critical failures here is not universal critical-value coverage.

## Why no replacement is justified

Against the pair on regressions, SuperClinical loses 16 complete occurrences, mSuperClinical loses 30, BigMed gains five and loses 13, and Underthesea gains three and loses 10. These comparisons inspect exact spans and own-category partial coverage, not just net totals. The JSON also records new ordinary positions masked by each candidate: fewer false positives in aggregate can still introduce mistakes on different text.

BigMed loses 12 previously complete names and one address in regressions, plus five names and one organization occurrence in the challenge. Its strong broader-type result does not offset those losses. Underthesea's losses include names, a bank account, card/CVV/PIN occurrences and IPv4 addresses. It cannot inherit a broad privacy promise from good address detection. Its FP32 reference does not recover the missing capabilities and increases unwanted masking in regressions; quantization alone does not explain the gap.

SuperClinical and mSuperClinical do supply complementary evidence in this measured integration: names are the larger model's relative strength, addresses the smaller model's. Their pairing improves coverage but also combines unwanted masking and resource cost. This explains the development baseline, without making a two-model release architecture acceptable or permanent. Model size is not an accuracy ranking.

## Resource observations

Measured on Apple M1 Pro, 10 logical CPUs, 16 GiB RAM, macOS arm64; Node 24.10.0 and ONNX Runtime 1.24.3. Asset sizes include the pinned weights and support files, in decimal MB. They exclude shared runtime distribution and are not measured installer sizes.

| Configuration | Pinned asset MB | Short-case median ms, two runs | Short-case p95 ms, two runs | Sampled Node RSS GiB, two runs |
| --- | ---: | ---: | ---: | ---: |
| SuperClinical | 475.3 | 11.2–11.6 | 18.8–19.8 | 1.59–1.63 |
| mSuperClinical | 932.4 | 17.7–18.1 | 30.1–31.0 | 1.39–1.56 |
| Existing pair | 1,407.7 | 30.1–30.5 | 47.4–51.5 | 1.86–1.96 |
| BigMed, native preprocessing | 872.6 | 9.3–9.4 | 13.4–13.5 | 2.47–2.49 |
| Underthesea INT8 | 205.5 | 10.0–10.1 | 14.8–14.9 | 0.86–0.88 |
| Underthesea FP32 reference | 460.2 | 19.0–19.1 | 31.7–33.0 | 1.31–1.33 |

These are exploratory harness measurements, **not an end-to-end speed ranking or desktop budgets**. Alternative tokenizer reference preparation happens in setup; BigMed uses precomputed native encodings during inference, so its timings exclude work that a shipping pipeline must perform. Every timing includes common detection policy, but excludes scoring. Short timing excludes the first case and five long fixtures; per-case long timings are retained in raw runs. Setup times and RSS also include evaluation overhead. RSS is sampled, excludes Python children and cannot establish full-process-tree or desktop peak memory. Asset verification warms file caches. All providers ran sequentially, but other machine activity was uncontrolled. No cold-start, cancellation, battery, batch or installer qualification is claimed.

## Decision and next bounded direction

Reject all current configurations as release choices. Retain the pair only as the development control; do not add another model to it or replace it based on size. Stop treating reruns of these observed fixtures as a path to final validation.

The next development experiment should test whether **one compact Vietnamese contextual detector plus explicit local recognizers** can cover the declared private types. Start with a capability/data specification and a separately partitioned, provenance-tracked synthetic training/development/validation corpus. Target the measured weaknesses: unaccented and NFD names, complete addresses, organizations versus ordinary headings, and broader private values. Include hard ordinary-text negatives. General NER must not silently inherit unsupported privacy categories; any deterministic card/IP/credential support needs explicit syntax, precedence and negative tests.

Freeze candidate admission, provenance, supported types, category mapping and resource targets before training or evaluation. Keep these 362 cases as regressions only. Independently review final annotations where feasible. A fine-tuning feasibility study must establish licensing, source alignment, export fidelity and realistic compute costs before training is undertaken. This comparison does not approve a training run, new download or replacement model.

## Evidence and reproduction

The [specification](model-recheck-v1-spec.md) and [protocol](model-recheck-v1-protocol.json) were frozen before scoring. The [machine-readable report](model-recheck-v1-results.json) retains complete and model-derived stages, selected spans, critical/type outcomes, exact losses, resource samples and raw-run hashes. No historical annotations, evidence or production source were edited. Two additional measurement tests bring the passing unit suite to **110 tests**. A build/native rerun was unnecessary for these developer-only scripts and documentation; previous production verification remains historical.

With the already pinned local assets and existing Tokenizers 0.22.2 evaluation interpreter, run each of `small`, `large`, `combined`, `bigmed-native`, `underthesea`, `underthesea-fp32` for rounds `1` and `2`, sequentially in fresh processes:

```sh
OFFLINEMASK_EVAL_PYTHON=/absolute/path/to/evaluation/bin/python mise exec -- node scripts/model-recheck/evaluate.mjs small 1
mise exec -- node scripts/model-recheck/report.mjs
mise exec -- pnpm test
```

Run the report only after all 12 files exist. Writers refuse to overwrite evidence; use a fresh evidence workspace to reproduce. Artifacts and logs are under ignored `artifacts/model-recheck/`. Hash and runtime checks must pass; don't bypass them to rerun old protocols against changed sources. Fetch is blocked and no assets were downloaded. This is a harness control, not OS-level proof of offline desktop behavior. User data, telemetry, corrections, automatic update checks, app packaging and future Excel/PDF/OCR adapters remain outside this work.

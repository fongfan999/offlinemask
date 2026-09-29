# Shared detection core: integration comparison

Completed 15 September 2026 (local time). **The common pipeline is implemented and preserves production detection behavior. No tested configuration qualifies as the final shared model.** This is a diagnostic comparison on observed synthetic fixtures, not a new held-out model-selection result.

Follow-up: the [native-preprocessing evaluation](native-preprocessing-comparison.md) subsequently resolves BigMed's tokenizer mismatch, completes both rounds without errors, and still rejects it on quality. The blocked BigMed results below remain the historical evidence for this earlier integration.

## Refactor verification

The original and refactored implementations received identical real predictions from the production-version WASM backend, hosted in Node. Across all 262 cases, they produced identical full Detection arrays, progress events, all-options and category-only transformation results, and local-only outputs. The check passed in both frozen rounds. This verifies the refactor rather than assuming a passing aggregate score means unchanged behavior.

All 82 unit tests passed, including seven shared-core/measurement tests. Type checking, the production frontend build and all 14 ongoing real-model checks passed. The existing OpenMed `crypto` browser-externalization build warning remains. No UI, Rust implementation, dependency version or model installation changed, and no new packaged-app, cross-platform or performance claim is made.

## Comparable configurations

The corpus contains 262 cases, 328 annotated private-value occurrences and 63 entirely negative cases. It combines nine already observed suites. Some scenarios and values recur; these are not independent samples of customer documents. The short-case false-positive denominator is 7,678 ordinary lexical characters across 261 cases; the one long repeated-boilerplate case is excluded from that denominator.

Every configuration uses the same Node CPU inference backend, shared windows, label policy, local recognizers, boundary completion and category reconciliation. Underthesea uses a native tokenizer offset reference, with exact token-ID agreement required against JavaScript inference. Its reference is developer tooling, not an app-compatible tokenizer deployment.

| Configuration | Model-derived complete values | Full engine complete values | Name-only | Address-only | Other-only | Ordinary characters hidden, short cases | Negative cases affected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| SuperClinical | 177/328 | 298/328 | 75/103 | 102/111 | 34/41 | 81/7,678 (1.05%) | 13/63 |
| mSuperClinical | 128/328 | 281/328 | 98/103 | 81/111 | 28/41 | 136/7,678 (1.77%) | 17/63 |
| Both | 213/328 | 315/328 | 99/103 | 106/111 | 35/41 | 192/7,678 (2.50%) | 23/63 |
| Underthesea INT8 | 166/328 | 301/328 | 96/103 | 108/111 | 24/41 | 267/7,678 (3.48%) | 7/63 |
| Underthesea FP32 | 168/328 | 301/328 | 95/103 | 108/111 | 24/41 | 306/7,678 (3.99%) | 7/63 |

All five configurations complete all 262 requests. Their per-case outputs are identical across the two sequential fresh-process rounds. The same full-engine total for the Underthesea exports does not mean their predictions or category assignments are identical.

“Model-derived” includes common decoding, label mapping, subword-boundary repair and merging, but excludes local contact/identifier/field recognition and address completion. Thus this is an ablation of the shared engine, not raw-checkpoint benchmark accuracy. The large gains between columns demonstrate why model rankings must be measured with a declared processing policy.

Every configuration above covers 20/20 emails and 20/20 phones. Banking-only coverage is 32/33 for SuperClinical and the pair, and 31/33 for mSuperClinical and both Underthesea exports. These denominators remain small. The pair's 315/328 all-options coverage exceeds 95%, but banking and “other” category coverage, short-case ordinary masking and negative-case errors still fail screening. No aggregate win overrides these failures.

Compared with the current pair, Underthesea INT8 gains three complete values and loses seventeen; under the respective selected categories, it gains four and loses seventeen. It improves some address coverage but does not replace broad privacy recognition. Detailed per-case gains/losses for every configuration are retained in the [machine-readable results](shared-core-comparison.json).

## BigMed is blocked at preprocessing

The first frozen adapter used the production Metaspace aligner. It failed `fresh-emoji` and `fresh-negative-unicode`, and mechanically scored 307/328 complete values across the corpus. The [initial report](shared-core-comparison-initial.json), [protocol](shared-core-protocol.json) and [exact evaluation sources](shared-core-initial-sources.json) remain available.

A second frozen adapter uses native source offsets, requiring the native tokenizer IDs to equal those actually sent to JavaScript inference. This exposes seven disagreements:

- `model-reliability.json`: `fresh-nfd`, `fresh-negative-unicode`.
- `address-holdout.json`: `nfd-address`.
- `model-decision.json`: `name-nfd`.
- `text-reliability-final.json`: `final2-name-nfd`, `final2-address-nfd`.
- `structured-values-holdout.json`: `credential-nfd`.

These fixture names are historical; none is fresh validation in this experiment. Tokenizers produce different IDs, not merely different offset conventions. Native offsets cannot safely be attached to predictions from a different token sequence. The stricter adapter therefore rejects those requests. It mechanically scores 301/328 complete values, including empty results for failed requests. **That number is not a clean measure of BigMed's learned detection quality and is excluded from the comparative table.** The code has not “fixed” this mismatch by dropping tokens or suppressing the error.

BigMed next requires one consistent tokenizer path for token counting, inference IDs and original source offsets, followed by an export/runtime feasibility check. The current reference verifies agreement; it does not supply native IDs to the model or ship a native tokenizer in the app. Until that integration is established, BigMed cannot be selected or rejected solely on these incomplete quality scores.

## Frozen method and provenance

The [second protocol](shared-core-protocol-v2.json) records the revision reason, source/fixture hashes, local artifact hashes/sizes, original changed sources and candidate provenance. The production core and annotations do not change between rounds. The change is BigMed's stricter tokenizer check; other candidates repeat with unchanged behavior. No thresholds or annotations were tuned after observing outcomes.

The initial Small/Large/pair and alternative exports are the same pinned files documented in the [original model comparison](2026-09-10-alternative-decision.md). No new model weights were downloaded. All candidate files are verified before each run and inference-time `fetch` is blocked. This is application-level fetch blocking, not OS-level network isolation. No performance ranking is made: native tokenizer references are prepared separately from inference.

During the second round, a temporary evaluation environment had lost its configuration and Python source files; a subsequent launch also used a resolved system-interpreter path. Both attempts stopped during setup, before scoring, and their logs are preserved under ignored artifacts. The environment was restored under `artifacts/tokenizer-evaluation-env` from the locally cached `tokenizers==0.22.2` wheel using `--no-index --no-deps`; no network download was needed. Wheel SHA-256: `1e418a55456beedca4621dbab65a318981467a2b188e982a23e117f115ce5001`. The restored helper imports only the local tokenizer path used here; this is not a general installation of its optional Hub integrations.

Raw initial runs are under `artifacts/shared-core/`; revised runs are under `artifacts/shared-core-v2/`. The tracked report preserves both stages, per-case results, errors and differences against the pair. The [development guide](../development.md#shared-detector-comparison) records commands and prerequisites. A clean checkout needs the exact pinned assets and developer tokenizer environment supplied locally; the parity baseline itself is reconstructed from tracked source evidence.

## What this establishes

- The reusable runner/policy is verified against the original text behavior.
- Candidate scores can distinguish model-derived findings from local-rule improvements.
- Category mistakes and ordinary-text masking remain visible, rather than being hidden by one coverage total.
- Underthesea's former six-case alignment failure is absent in the new native-offset evaluation path; it remains a specialist with substantial broader-category gaps.
- BigMed's preprocessing mismatch is an explicit blocker, not evidence of inferior learned detection.

It does not select a model, qualify an OCR/file adapter, establish population accuracy, or make user review a substitute for the quality requirement. The [next validation specification](shared-core-next-validation.md) records the remaining gates. Production continues using the existing development pack with no telemetry, input/error uploads, correction collection or background network checks.

# Structured credentials and identifiers — 14 September 2026

The structured-value rules improved complete masking without measured coverage regressions or additional ordinary-text masking across 262 synthetic cases per configuration/runtime. This supports the targeted implementation in [Decision 0012](../decisions/0012-structured-credentials-and-identifiers.md). It does not qualify either model configuration for banking deployment or change the installed recognition pack.

## Change evaluated

Explicit usernames, passwords, API keys/access tokens, numeric accounts and postcodes receive complete source spans and the corresponding checkbox category. Quoted credentials retain spaces and punctuation; numeric identifiers retain leading zeros. Recognized placeholders and well-formed, explicitly labelled transaction dates/amounts are excluded from conflicting guesses. Unsupported formats and unlabelled text still depend on existing detection. See the decision for exact boundaries and ambiguities.

No weights, thresholds, runtime selection or dependencies changed. No network checks, telemetry, input logging or correction collection were added. All evaluation text is synthetic; production input is not evaluation material.

## Existing regression sets

These eight previously observed suites contain 238 cases and 299 private values. Complete coverage means every annotated character was masked with all categories selected; it does not by itself establish correct categorization.

| Runtime | Configuration | Complete values before → after | Ordinary characters masked before → after |
| --- | --- | --- | --- |
| Native prototype | mSuperClinical | 241 → 253 / 299 | 132 → 132 |
| Native prototype | Combined | 278 → 286 / 299 | 181 → 181 |
| WASM | mSuperClinical | 240 → 252 / 299 | 110 → 110 |
| WASM | Combined | 280 → 287 / 299 | 162 → 162 |

Across these suites and the fresh set below, every runtime/configuration had zero lost complete values, zero lost complete values under their own selected category, zero reductions in partial character coverage, and zero cases with increased ordinary-character masking. These are comparisons against the previous implementation, not claims that all cases now pass.

## Fresh structured-value set

The 24 cases contain 29 private values: two names, five addresses/postcodes, one email, one phone, five banking identifiers and fifteen other values. Five cases contain no private values. There are 572 ordinary characters. The fixture was authored after implementation, frozen before inference, and was not used to tune the implementation after results were observed.

| Runtime | Configuration | Complete values before → after | Ordinary characters masked before → after | Existing screening floor after |
| --- | --- | --- | --- | --- |
| Native prototype | mSuperClinical | 9 → 28 / 29 | 4 → 4 | Pass |
| Native prototype | Combined | 18 → 29 / 29 | 22 → 11 | Fail |
| WASM | mSuperClinical | 9 → 28 / 29 | 0 → 0 | Pass |
| WASM | Combined | 18 → 29 / 29 | 22 → 11 | Fail |

The remaining incomplete single-model value is an unlabelled username in `mixed-unlabelled`. With the pair, all 29 values are covered when all categories are selected, but that username is still not fully covered under its own category: “other” selection covers 14 of 15 values. Both combined runs mask 11 ordinary characters (1.92%), exceeding the unchanged 1% screening limit. Ordinary heading false positives remain. The single model passes this narrow fresh-set screen, but its broader regression coverage remains insufficient to infer a final model choice.

## Method and evidence

- [Frozen protocol](2026-09-14-structured-values-protocol.json): implementation and fixture hashes, scope, unchanged criteria and limitations.
- [Detailed results](2026-09-14-structured-values.json): aggregate comparisons, changed cases, regression checks, original changed source files and pinned model manifest.
- [Fresh fixture](../../tests/fixtures/structured-values-holdout.json): all 24 annotated synthetic cases.

“Single” means the pinned mSuperClinical checkpoint. “Combined” means both existing pinned SuperClinical and mSuperClinical checkpoints. Native results use the existing developer prototype; WASM results use the production-version backend hosted in Node. This is not a packaged WebKit performance measurement. Inference-time fetch was blocked, verified local development files were used, and no detection request failed.

The old 238-case baseline reuses the final runs from the [previous text-reliability evaluation](2026-09-14-text-reliability.md). The reporting script verifies their source hashes against that milestone and verifies unchanged fixture hashes. The fresh 24 cases run on both the isolated original source snapshot and the revised implementation. Raw runs and the complete original snapshot are under ignored `artifacts/`; they are prerequisites for reproducing the before/after report and are not supplied by a clean checkout. The durable results retain changed-case evidence and original versions of the changed existing files.

With the pinned development weights, existing native prototype, original snapshot and baseline artifacts available, run each combination sequentially:

```sh
mise exec -- node scripts/evaluate-structured-values.mjs before native single
mise exec -- node scripts/evaluate-structured-values.mjs after native single
```

Repeat with `combined` and with `wasm`, then run:

```sh
mise exec -- node scripts/report-structured-values.mjs
```

Do not change historical hashes to make later implementations match this experiment. These observed fixtures are now regression evidence; further changes need separately frozen validation.

## Engineering checks and limits

All 75 unit tests passed, including seven structured-value tests covering punctuation, malformed inputs, source offsets, category conflicts, transaction facts and local-only routing. Type checking and the production frontend build passed. All 14 real-model regression checks passed with network fetch disabled. The build retains the existing OpenMed `crypto` browser-externalization warning. No UI or Rust implementation changed, and this milestone adds no new desktop, latency or memory claims.

This developer-authored synthetic set is not independent customer evidence. Several categories have only one or two fresh examples. Perfect all-category coverage on one small set does not imply 100% detection, reliable categorization, or industry readiness. Unlabelled credentials, unsupported numeric formats, unrestricted prose and false positives remain limitations. Improvements must continue through explicit, local evaluation without collecting users’ private text or corrections.

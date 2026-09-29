# Text field reliability — 14 September 2026

Targeted field and boundary fixes improve coverage without losing previously covered sensitive material or adding ordinary-text masking in the evaluated cases. **No single model or combined pack is promoted for release.** Processing remains offline, and no tracking, correction collection, or learning from user input is added. The implementation and its limitations are recorded in [Decision 0011](../decisions/0011-bounded-text-field-detection.md).

## What changed

Explicit colon-delimited name/address values now take precedence over conflicting model categories. Label matching handles case, missing accents and decomposed Unicode while preserving original source offsets. Values stop at bounded field/sentence/line boundaries, including comma-separated contact/postcode labels without a colon. Known empty placeholders and field labels do not become model findings. Predicted name pieces can join across a hyphen or apostrophe; address components can join across a comma followed by one newline.

These are rules for recognizable field structure, not general name/address recognition. They still run within the current model-required path; the lightweight local-only options and the optional pack remain unchanged. No model export, dependency, runtime selection, UI, or native downloader change is made.

An attempted removal of unvalidated model email/phone guesses was rejected: it reduced false positives but exposed fragments of credentials and identifiers that the model had misclassified. The final implementation retains that ambiguous evidence outside explicit fields. Ordinary-word false positives remain unresolved; no contact-validation guarantee is added.

## Trace findings

The developer-only `trace-text-reliability.mjs` evaluated six existing synthetic cases on native and WASM. Its raw outputs remain in ignored artifacts. On native, the uppercase labelled customer name has no positive name tokens in either model. Street-name tokens are classified as name parts, while the NBSP address produces email/person/vehicle guesses. A single letter in “chưa” is predicted as a name, then expanded by our word-boundary policy. Hyphenated name parts are predicted on both sides but not connected by the previous join rule. The WASM trace confirms the same classes of failure.

The installed OpenMed 2.3.0 decoder was inspected after Context7 returned Python documentation instead of the relevant JavaScript API. No decoding threshold or inference setting was changed. These traces distinguish classification errors from application boundary/category policy; they do not establish that every failure is fixable with rules.

## Evaluation sequence and limitations

The [initial protocol](2026-09-14-text-reliability-protocol.json) froze fixture hashes before changes. We compared the original implementation and an initial change on six existing annotated suites plus a new 32-case synthetic holdout. That exposed contact-filter coverage regressions and three older cases where a labelled address swallowed the following contact/postcode label. The filter was backed out and the field boundary corrected. Initial outcomes are preserved separately from final ones.

The first holdout was now observed, so it became regression material. A [second protocol](2026-09-14-text-reliability-final-protocol.json) froze the final implementation and a separate new 20-case set before inference. No policy edits were made after inspecting that final set. Both sets were written by the developer familiar with prior failures; they are not independent population samples or real banking records. Synthetic names, addresses, identifiers and credentials are invented examples, not valid customer data or administrative-address verification.

mSuperClinical is the single-model candidate because the previous comparison showed stronger name-only coverage. The existing pair is the production regression control. This work did not reopen the unchanged SuperClinical-only comparison or download additional candidates. The unchanged `meetsScreeningFloor` checks zero request failures, at least 95% complete entities/names/addresses including category-only behavior, at least 99% contact/identifier completeness, at most 1% ordinary lexical characters masked, and at most one false-positive negative case. Passing a tiny set would not establish banking readiness.

All eight final original-versus-revised comparisons (two configurations × two runtimes × regression/fresh sets) use the same rules outside the changed field/boundary code, pinned weights and tokenizer. Native uses the existing Rust prototype / ONNX Runtime 1.24.3, four threads. WASM uses the production-pinned ONNX WebGPU/asyncify distribution, one thread, hosted under Node. It is not a packaged WebKit benchmark. Fetch is blocked during inference; native weights/runtime are locally verified. This is not an OS-level network-isolation audit or a new memory/speed benchmark.

## Existing and now-observed fixtures

The seven regression suites contain 218 cases and 276 annotated values. Earlier cases recur in similar forms, so these are diagnostic counts rather than independent trials. Category columns measure full coverage when only that category is selected.

| Runtime | Configuration | Complete values before → after | Name-only before → after | Address-only before → after | Ordinary characters hidden before → after |
| --- | --- | ---: | ---: | ---: | ---: |
| Native | mSuperClinical | 193 → 222 / 276 | 80 → 88 / 93 | 46 → 67 / 97 | 144 → 127 |
| Native | Both | 243 → 257 / 276 | 82 → 89 / 93 | 85 → 92 / 97 | 199 → 174 |
| WASM | mSuperClinical | 194 → 221 / 276 | 81 → 88 / 93 | 45 → 65 / 97 | 123 → 105 |
| WASM | Both | 245 → 259 / 276 | 83 → 90 / 93 | 84 → 91 / 97 | 181 → 155 |

For each configuration/runtime, the final comparison finds **zero lost previously complete entities, zero lost previously complete selected-category entities, zero entities with reduced covered-character counts, and zero cases with additional ordinary characters hidden**. All requests complete. These statements describe this corpus; they do not guarantee that new inputs cannot regress.

## Final fresh set

The final 20 cases contain 23 private values: eight names, nine addresses, two emails, one phone, one labelled identifier, and two credentials. Five cases contain no private information. Both runtimes yield the same completeness and false-positive counts shown below.

| Configuration | Complete values before → after | Name-only before → after | Address-only before → after | Ordinary characters hidden before → after | Screening |
| --- | ---: | ---: | ---: | ---: | --- |
| mSuperClinical | 13 → 19 / 23 | 7 → 8 / 8 | 2 → 7 / 9 | 5 → 5 / 461 | Fail |
| Both | 20 → 21 / 23 | 8 → 8 / 8 | 8 → 9 / 9 | 7 → 7 / 461 | Fail |

There are no new lost full/partial/category-complete entities and no added false-positive cases on the final set. However, the single misses a postcode and only partly covers an unlabelled prose address. Both configurations still partly cover the username/password example. They also mask the ordinary heading word “CHỨNG”; the pair additionally masks part of an ordinary transaction date. Excess masking is 1.08% for the single and 1.52% for the pair, exceeding the existing 1% floor. The pair finding all eight names and nine addresses here does **not** establish universal 100% coverage.

## Offline evidence boundary

The app gains no telemetry, user-input logs, automatic error uploads, feedback collection, automatic model improvement, storage of corrections, or background update checking. The new field code has no network or storage API and maintains exact in-memory source spans. Manual corrections and real private sessions retain their existing RAM-only lifecycle. Only synthetic developer runs write trace/evaluation files.

Measured test outcomes are facts about these fixtures. Representativeness, real user workflows, and real-world detection accuracy remain assumptions. The owner’s no-tracking requirement is now explicit in the contributor guide and product direction. Optional pack downloads and future general update checks remain user-initiated, separate from processing.

## Verification and reproduction

- 68 fast tests pass, including field boundaries, Unicode/50,000-unit tail offsets, category precedence, exact placeholder suppression, name punctuation, multiline addresses, offline local-only routing, and private persistence boundaries.
- The 14 real-model regression checks pass, including unlabelled people, unaccented names, complete addresses, and long-tail coverage, with fetch disabled.
- All comparison requests complete; final implementation and fixture hashes are verified.
- Type checking and the production frontend build pass. Vite retains the existing OpenMed browser-externalized `crypto` warning; this task adds no cryptography call. No new native code or UI change means no new native-build, desktop smoke-test, memory, or cross-platform claim is made.

[Machine-readable evidence](2026-09-14-text-reliability.json) includes summary/changed-case outcomes, original source snapshots for the changed modules, pinned model/runtime provenance, and both protocols. Raw per-run files are in ignored `artifacts/text-reliability-20260914/`.

On the evaluated source/dependency versions, with the existing native prototype built and local development weights verified:

```sh
mise exec -- pnpm models:check
mise exec -- node scripts/prepare-text-reliability-baseline.mjs
```

Run `scripts/evaluate-text-reliability.mjs` with phase `before` or `revised`, runtime `native` or `wasm`, and variant `single` or `combined`, for each combination sequentially. The `single` variant is mSuperClinical. For the fresh final set use phases `final-before` and `final-after` with those same runtime/variant combinations. The original `after` phase identifies the rejected initial experiment; reproducing it requires its recorded initial source snapshot from the original ignored artifacts, not the final source. The report generator consumes that initial run evidence as well as final runs; do not relabel a final run as the initial experiment. Future changed implementations require a newly dated protocol and fresh validation, not editing these historical hashes to pass.

The remaining model decision is unchanged: **the improved single still cannot replace the pair, and the pair still is not release-qualified**. These scoped fixes improve the current text workflow without inventing evidence from users or declaring the broader detection problem solved.

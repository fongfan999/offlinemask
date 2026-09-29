# Next shared-core validation gates

Status: the first separate synthetic challenge is now [completed](release-challenge-v1.md), with its own frozen type policy and critical-value gates. All five configurations fail. Its 100 cases are now observed regression evidence, not a final independently reviewed holdout. Performance budgets and release selection remain open. The earlier [completed comparison](shared-core-comparison.md) qualifies the shared harness, not a checkpoint.

Follow-up: [shared-policy hardening](policy-hardening.md) and [contextual-field improvements](context-fields.md) improve the shared core. The subsequent [candidate recheck](model-recheck.md) applies that same current policy to every admitted candidate twice. All remain rejected as release choices, including the incumbent pair. It separately resolves the historical card-category mismatch for scoring without changing fixtures or the UI. The next bounded direction is a single-detector development feasibility study; scope, independent final validation and deployment gates below still apply.

## 1. Resolve candidate eligibility before ranking

BigMed's native/JavaScript tokenizer mismatch is now resolved in the [developer-native evaluation](native-preprocessing-comparison.md), which still rejects the configuration on quality. Its seven former failures remain regressions. Any future application adapter must likewise use consistent counts, IDs and source offsets and qualify the exact shipping runtime. Measure additional tokenizer/runtime distribution cost; the Python evaluation reference does not qualify desktop deployment.

The Vietnamese-specific PII lead from the [architecture plan](shared-detection-core-plan.md) has been [screened](vietnamese-pii-challenger-screen.md) and remains unadmitted pending reproducible preprocessing and export/source-alignment work. No weights were downloaded. Published label count or a “Vietnamese” tag is not evidence of coverage. Pin any admitted artifact and record its preparation costs and limitations.

Underthesea remains the compact specialist control; current SuperClinical, mSuperClinical and the pair remain existing controls. No additional ensemble or broad model search is automatically admitted. If candidate integration cannot be made dependable, record the blocker rather than comparing its failed requests as normal quality output.

## 2. Freeze supported capabilities and context

The new challenge exposed a distinction that must be settled before further release ranking: its broader financial target includes passport/tax identifiers and puts cards in banking, whereas the current lightweight promise is narrower and cards are documented under “other.” Preserve those distinctions; do not misreport a scope mismatch as a checkpoint failure. A separate actual no-pack audit and the saved card-category predictions are documented in the challenge report. No production scope was changed.

Define the exact private types inside the “other” UI category before validation: credentials, usernames, birth dates, IPs, organizations and any further supported types need individual expectations. A general-NER label set must not inherit broad capability claims from the UI grouping. Define which amounts, dates and transaction facts should be retained for each tested workflow.

Keep source text, extraction status and context distinct. In table fixtures, label/header context must influence detection without becoming a masked cell value or shifting output coordinates. Schema ambiguity must be represented explicitly. Page fixtures need a mapping between extracted spans and original page regions. Neither flattening a workbook nor concatenating OCR lines is an adequate substitute for source mapping tests.

## 3. Freeze held-out material before inference

Create separate development and final validation partitions. Keep all 262 observed examples in regression material. Place variants of an underlying record—prose, labelled form, table and noisy extraction—in the same partition so format variations cannot leak across the split.

The final partition must cover each supported type and its selected category across applicable representations. Include ordinary negatives, sparse cells, changed headers, leading zeros, uppercase/unaccented/NFD text, punctuation, repeated values, boundary-crossing values, long inputs and mixed categories. Annotate complete spans and source locations, not merely whether some portion was detected. List unsupported extraction/format cases explicitly.

Have annotations independently reviewed where feasible. If the developer remains the sole author/reviewer, report that limitation. Synthetic examples provide controlled evidence, not a measured distribution of banking workflows. Do not label repeated renders/runs as additional independent records. Corrupted-text simulation tests detector robustness only; actual rendered synthetic scans through a local OCR engine are a separate extraction/localization evaluation.

Record fixture hashes, exact model/export/runtime versions, category mappings, normalization, chunk planning, thresholds and final artifact hashes before scoring. Calibrate on development cases only; do not compare raw confidence numbers across unrelated checkpoints.

## 4. Predeclare the decision gates

Retain the current engineering screen as a minimum: zero failed requests; at least 95% complete values overall; complete own-category coverage of at least 95% for names/addresses/other and 99% for emails/phones/banking; at most 1% ordinary lexical characters masked on short cases; at most one affected negative case. Freeze corpus composition/counts before applying the absolute negative-case limit. Report both strict full-span and selected-category outcomes per supported type and representation. An aggregate pass cannot conceal a failing critical type.

List designated critical-identifier fixtures and require no complete or partial-coverage regression on those fixtures. Preserve known source-offset and field-boundary regressions. Inspect both gains and losses against the incumbent pair; any proposed exception needs a documented scope decision, not an unrecorded threshold adjustment.

Before performance scoring, declare the supported CPU-only reference machines and explicit download, cold-load, warm-processing, peak-memory, cancellation and batch-size budgets. These budgets are still open; do not invent a passing target after measuring a preferred model. Include tokenizer/support files and runtime overhead in resource comparisons.

Qualify the exact shipping export and runtime. An FP32 reference pass cannot substitute for the quantized artifact, and Node CPU results cannot substitute for packaged WebKit/native-runtime checks. Do not rank model quality until preprocessing/source mapping is valid, or label a quality pass release-ready while deployment/resource gates remain unknown.

## 5. End with selection or explicit rejection

The decision must name one primary checkpoint, revision, exported format, tokenizer/runtime, resource cost and concrete supported capabilities, or reject all candidates and explain the next bounded direction. A single model is preferred, but a weaker detector must not be selected solely because its download is smaller. A second contextual model would need an independently demonstrated gain that justifies its extra misses/false positives and resource cost.

If no candidate qualifies, the next decision is targeted training with appropriately licensed synthetic/development data or a narrower supported scope. Do not keep rerunning the same known fixtures and present eventual improvements as fresh validation.

All work stays in developer evaluation tooling. There is no telemetry, private-input logging, error upload, correction collection or automatic update check. No actual customer input is admitted by this specification. OCR, Excel/PDF parsing and safe output each retain separate qualification gates.

# 0013 — Share detection policy before comparing replacement models

Status: common pipeline implemented; model selection remains open.

## Problem and decision

The owner requires the detector to serve future text, spreadsheet, image and PDF workflows. Historical alternative-model scores use older integration code and cannot fairly rank those models against the current detector. Introduce one model runner and one downstream policy, expose model-derived and complete findings separately for developer evaluation, and keep the existing production pack and category availability intact.

`src/core/detection/model-runner.ts` owns bounded overlapping windows, BIO decoding, source-offset application, progress and provider disposal. A provider supplies token counting, predictions, provenance and tokenizer-specific alignment when required. The existing exact Metaspace alignment remains the default for the pinned production models. `openmed.ts` now owns the pinned model loading/configuration and supplies providers to the runner.

`src/core/detection/policy.ts` owns model overlap merging, address completion, labelled fields, local contact/identifier recognition and structured-value reconciliation. Every contextual provider uses it before checkbox filtering. The local-only entry point retains its narrower capability scope and does not import or initialize a model runtime.

The runner's `inspect()` method returns `modelOnly` and `complete` from one inference pass. “Model-only” means model-derived spans after the existing common BIO decoding, label mapping, subword-boundary repair and overlap merging. It is not raw logits or an independent benchmark of an unprocessed pretrained model. It excludes local contacts, identifiers, explicit-field recognition and address completion. `detect()` returns only the complete findings as before. No additional stage data is persisted or exposed in the product UI.

## Candidate integration

New developer tooling lives in `scripts/shared-core/`. It compares the existing Small, Large and combined controls with the already pinned BigMed INT8 and Underthesea INT8/FP32 exports. The historical `alternative-detector.mjs` remains unchanged so its older behavior is not silently presented as this new comparison.

All six configurations use Node CPU inference, the shared window planner and the same final policy. Underthesea maps PER/LOC/ORG into the common labels; MISC does not become a privacy category. The FP32 variant remains a quantization reference, not a proposed second shipping model.

Underthesea and BigMed use a developer-only native tokenizer reference for exact positions. An already installed Python `tokenizers==0.22.2` reads the pinned tokenizer file locally. It returns offsets converted from codepoints to UTF-16 for the same shared chunks; every native token-ID sequence must equal the JavaScript inference token-ID sequence. Mismatches fail the request rather than guessing the location of an unknown token. This removes the old native reference's different long-document window schedule from this comparison. Python remains outside the app and is not a qualified desktop tokenizer implementation.

The initial frozen run used the default Metaspace aligner for BigMed and failed two Unicode requests. A separately frozen second run applies the native reference to BigMed as well. It exposes seven native/JavaScript token-ID mismatches. The stricter check is retained: BigMed remains blocked at preprocessing, and its incomplete scores cannot rank its learned detection quality. The first report and evaluation source archive are preserved; neither policy nor annotations were tuned to hide these failures.

Context7 was consulted for the [Transformers.js tokenizer/token-classification contract](https://github.com/huggingface/transformers.js/blob/main/packages/transformers/src/pipelines/token-classification.js) and [native source offsets](https://huggingface.co/docs/tokenizers/quicktour). The existing installed dependencies remain unchanged. Optional character-offset fields in pipeline typings must not be assumed to contain actual offsets.

## Evaluation boundary

The [second frozen protocol](../evaluations/shared-core-protocol-v2.json) pins core/evaluation source hashes, dependency locks, all nine observed fixture suites and candidate file hashes/sizes. It retains the changed original source files so the parity harness can reconstruct the pre-refactor detector from a clean checkout with the required local assets. The [initial protocol](../evaluations/shared-core-protocol.json) remains intact. No previous protocol is rewritten.

The parity check runs both implementations on identical real production-version WASM token predictions, hosted in Node. It compares complete Detection arrays, progress events, all-options and category-only transformation results, and local-only routing across the same 262 synthetic cases. This isolates refactor behavior; it is not a cross-runtime equality claim or a packaged-app test.

The candidate comparison scores both stages and every selected category. It retains request failures. The screening floor is extended to require own-category completeness for email, phone, banking and “other,” in addition to names/addresses. Long fixtures retain their `group` in scored rows, so repeated boilerplate cannot dilute the short-case excess-masking metric. Some historical runners dropped that group field; do not treat their reported short-case rates as directly comparable without checking their actual denominator.

These fixtures have already been observed. Passing them cannot select a release model. The next protocol needs a concrete capability list within “other,” separately held-out scenarios, structure-aware cases and predeclared hardware budgets. No candidate-specific thresholds are tuned in this integration comparison. Results, failures and scope belong in the [shared-core report](../evaluations/shared-core-comparison.md).

## Product boundaries

No candidate weights are downloaded or installed by these changes. The production manifest, user-visible pack, manual download/update policy, worker response contract and RAM-only session behavior remain unchanged. There is no telemetry, automatic network check, correction collection or user-input logging. Evaluation artifacts contain synthetic developer fixtures only.

The runner is format-independent but still receives a string. Spreadsheet context/source mapping, PDF extraction, OCR, page-region mapping and file redaction/export remain separate unimplemented adapter work. Their future contract and the model-selection sequence are described in the [shared-core plan](../evaluations/shared-detection-core-plan.md). This refactor does not claim file support or approve any model.

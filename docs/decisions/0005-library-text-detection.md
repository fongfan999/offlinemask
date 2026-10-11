# 0005 — Library-backed offline text detection

**Current model decision:** [Decision 0010](0010-vietnamese-model-selection.md) rejects both individual checkpoints and their combination as the final release solution. The pair described here remains the development implementation; preserving it was not a quality approval.

**Distribution update:** [Decision 0006](0006-optional-models.md) supersedes the bundled-model delivery described below. Detection libraries and quality rationale remain applicable.

Date: 9 September 2026

## Decision and scope

The owner rejected a regex-only text detector and approved a larger bundled model to prioritize Vietnamese detection quality. This supersedes the detector and synchronous execution portions of [Decision 0004](0004-text-processing.md). Its exact-original, alias, review, and memory-only session boundaries remain in force.

`src/core/text.ts` now only validates provider spans, resolves overlaps, allocates aliases, and assembles the preview. Detection runs in a dedicated worker using three providers:

- OpenMed decodes contextual PII predictions from two pinned Vietnamese ONNX models executed with Transformers.js and ONNX Runtime Web.
- `linkify-it` recognizes complete email addresses, including their domains. `libphonenumber-js/max` uses full phone metadata for Vietnamese national numbers and international numbers with country codes.
- A small banking provider recognizes explicitly labelled account numbers, identity numbers, transaction references, and customer codes. These domain rules supplement libraries; they do not attempt general name recognition.

The UI retains the accepted entry → process → preview flow. Processing exposes progress and cancellation. Navigation during inference cancels the request, and late events cannot replace newer work. Model startup/inference failure retains the draft and shows a recoverable error; it never silently returns a less capable result. Workers are reused for warm requests and terminated on cancellation/unmount.

## Bundled models

Both are OpenMed Vietnamese PII v1 Android ONNX exports with Apache-2.0 model cards:

| Checkpoint | Revision | INT8 graph bytes |
| --- | --- | --- |
| [SuperClinical Small 44M](https://huggingface.co/OpenMed/OpenMed-PII-Vietnamese-SuperClinical-Small-44M-v1-onnx-android) | `665e766d817110a648d9cc38d074041702ca9675` | 466,962,077 |
| [mSuperClinical Large 279M](https://huggingface.co/OpenMed/OpenMed-PII-Vietnamese-mSuperClinical-Large-279M-v1-onnx-android) | `eaac31560eef579a7ae6144377109969dbd1e83a` | 916,288,564 |

The names are upstream checkpoint identifiers, not verified total parameter counts. Combined weights are 1.38 GB before tokenizers/runtime. INT8 does not mean every tensor is quantized; embedding weights substantially affect size. Both models load once per worker and run sequentially. This trades startup time and memory for recall, consistent with the owner's preference. Low-memory machines and other operating systems still need benchmarking.

## Runtime and privacy

All model/tokenizer/WASM assets ship in the desktop bundle. Large weights are [Tauri resource files](https://v2.tauri.app/develop/resources/), avoiding expensive executable compression on every rebuild. `prepare-desktop.mjs` stages frontend assets separately from weights while preserving the self-contained browser `dist` output. The native adapter resolves the bundled `models` directory and uses [convertFileSrc](https://v2.tauri.app/reference/javascript/api/namespacecore/#convertfilesrc). The read-only asset protocol is scoped only to `$RESOURCE/models/**`; the only added IPC capability resolves resource paths. No user-file read/write API is granted. Remote model loading, browser model caches, filesystem model caches, and WASM caches are disabled. The browser uses a single WASM thread inside the dedicated worker, avoiding UI blocking and cross-origin isolation requirements. Production CSP permits local workers and WASM compilation, and restricts fetches to local assets, the scoped asset protocol, and IPC. The website link remains an explicit separate user action.

Input and mappings stay in memory. No inference service, telemetry, remote API, or model download is involved in processing. Closing/reloading discards private sessions; this is not guaranteed memory erasure. The sample-history encoder excludes all private sessions. Clipboard writes occur only on copy.

The 50,000 UTF-16-unit limit remains. Inference uses overlapping source windows checked against the actual tokenizer's 384-token budget, retaining tail coverage instead of allowing silent model truncation. Source offsets refer to the exact original string, including whitespace, line breaks, and emoji. OpenMed aligns every token, including non-entity tokens, before BIO span decoding. Alignment errors fail the operation.

## Classification and review policy

Email parsing has first priority, followed by explicit banking labels, validated phone shapes, and model suggestions. Within a priority, longer spans win; accepted spans never overlap. Exact repeated whole values share aliases without overwriting another explicit classification. Representation variants are not automatically normalized into one identity.

Model name components and adjacent address components are combined for review. General DATE, AMOUNT, and CURRENCY labels remain readable; date-of-birth predictions are sensitive suggestions. Names, addresses, organizations, credentials, identifiers, and other supported PII labels can be proposed. These are fallible predictions, not an anonymity guarantee. A model can miss unaccented names or incomplete context and can mistake an ordinary term for PII. Review/keep controls remain necessary. Manual additions and restoration are not implemented here.

## Dependencies and provenance

| Dependency | Pin | License | Purpose |
| --- | --- | --- | --- |
| [OpenMed](https://github.com/maziyarpanahi/openmed) | 2.3.0 | Apache-2.0 | Token/source alignment and canonical BIO entity decoding |
| [Transformers.js](https://huggingface.co/docs/transformers.js) | 4.2.0 | Apache-2.0 | Tokenization, token classification, ONNX execution |
| [ONNX Runtime](https://onnxruntime.ai/docs/) | Lockfile, via Transformers.js | MIT | Browser WASM inference; CPU backend for local model checks |
| [libphonenumber-js](https://github.com/catamphetamine/libphonenumber-js) | 1.13.12 | MIT | Full phone metadata and source offsets |
| [linkify-it](https://github.com/markdown-it/linkify-it) | 6.1.0 | MIT | Email parsing with complete source ranges |

`scripts/model-manifest.json` is the authoritative repository/revision/SHA-256 allowlist. The model card and export metadata ship alongside the checkpoint. Model files and generated runtime assets are ignored by git. `models:download` is an explicit build-time operation, resumes partial transfers, and verifies content hashes before activation. `models:check` and normal builds fail if assets are absent or modified; they never fetch a replacement. Air-gapped builders can supply the exact listed files locally.

The installed Transformers.js package includes Node/image-related transitive dependencies. Their native postinstall downloads (`onnxruntime-node`, `protobufjs`, `sharp`) are explicitly disabled in `pnpm-workspace.yaml`; the product uses browser WASM and does not need image tooling. The generated WASM asset is copied from the runtime actually resolved by Transformers.js, preventing loader/binary version mismatches. Its JavaScript loader is embedded by the bundler.

Context7 documentation was consulted for Transformers.js, OpenMed and the Presidio alternative; official library sources supplemented API/offset and ONNX-loader details. Presidio would add Python while still needing a Vietnamese recognizer. NlpHUST's Vietnamese Electra model has promising published results but no clear redistribution license in the inspected model card. Neither checkpoint was sufficient alone: the smaller model missed some complete/lowercase names, while the larger multilingual model missed building numbers and portions of addresses. The combined result retains complementary evidence, expanding predicted name/address/organization subwords to whole-word boundaries and merging overlapping same-category spans. It can also increase false-positive suggestions (for example, the ordinary word “Người” was proposed as a name in one narrative); users can keep those values. Model choice is based on local regression checks rather than its advertised parameter count or model-card scores.

## Verification

The two checkpoints overlap in purpose and supported PII categories; they are not separate name-only and address-only detectors. Their complementary misses were observed in a small synthetic regression set, not a representative accuracy benchmark. This does not establish that both are necessary or that the combined pack offers the best size/quality tradeoff. Consolidating the pack requires a broader comparison of missed entities and false positives before removing either checkpoint.

The [10 September comparison](../evaluations/2026-09-10-model-comparison.md) now evaluates 66 additional synthetic cases (97 entities), with two isolated CPU runs per configuration. Full-span coverage was 72/97 for Small, 68/97 for Large, and 81/97 combined; the pair also increased excess masking and inherited Small's alignment failure on an uppercase negative example. No configuration meets the provisional screening floor. Keep the current manifest unchanged while addressing failures; this is not acceptance of the pair's quality or download cost. See the [interpretation and next steps](../evaluations/2026-09-10-model-decision.md).

The subsequent [alignment repair and alternative evaluation](../evaluations/alternative-model-protocol.md) fixes that observed uppercase failure by preserving raw tokenizer pieces and their logits, including unknown IDs that Transformers.js's pipeline omitted. The repaired three-model comparison has no failed requests in the same corpus and unchanged entity-coverage totals. This is a targeted reliability fix, not a claim that all tokenizers align correctly: the Underthesea candidate still needs a separate exact-offset integration. The original model manifests and user-installed pack remain unchanged.

The completed [alternative decision](../evaluations/2026-09-10-alternative-decision.md) identifies BigMed INT8 (872.6 MB, 82/97 complete values) as the leading broad alternative, but it loses six values the pair covers and is weaker on names. Underthesea INT8 (205.5 MB) provides useful name/location coverage in the exact-offset reference but lacks most broader PII categories and has six unresolved requests in the JavaScript adapter. Neither satisfies the promotion gates; preserve the original pack while addressing tokenizer and boundary quality. These synthetic diagnostic results do not establish production accuracy.

Fast tests check transformation invariants, priority/overlap behavior, Unicode/tail coverage, contact parsing, cancellation/retry, stale worker events, alias consistency, and sample/private storage separation. Model evaluation is a separate heavyweight check using synthetic inputs and real weights; it must be run when changing the checkpoint, tokenizer, inference runtime, alignment, or model policy. Results and platform limitations were recorded in `docs/review-design.md` at the time (retired on 11 October 2026; see git history).

**10 September reliability update:** [Decision 0007](0007-text-positioning-and-manual-review.md) supersedes production OpenMed search-based alignment with verified sequential positioning for the two pinned tokenizers, and implements manual additions in text review. The model manifest and detector policy are unchanged; the broader evaluation still exposes incomplete addresses and false positives.

**Address-completion update:** [Decision 0008](0008-address-boundary-completion.md) adds model-supported component completion after merged predictions. The [new evaluation](../evaluations/2026-09-10-address-policy.md) improves complete-address coverage while preserving the current pack; smaller candidates remain weaker on names. No library, checkpoint, download policy, or UI change is introduced.

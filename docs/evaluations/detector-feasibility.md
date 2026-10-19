# Single-detector feasibility and admission plan

18 September 2026. **Conditional engineering feasibility, not training readiness or a selected release model.** The existing candidates fail quality gates. This step defines a concrete next prototype, the data contract and stop conditions rather than starting expensive training or another ensemble.

The app, installed pack, category availability and runtime remain unchanged. All new code is developer tooling. No weights or dataset rows were downloaded, no training or inference was run, and no user data was accessed. Public model/dataset metadata and small configurations were inspected manually for this research; the app still never checks online automatically.

## Decision: prove the export before training

Use **Microsoft Multilingual MiniLM L12-H384** as a bounded *engineering admission probe*. This is a base encoder needing a new privacy token-classification head, not an existing Vietnamese privacy detector. Its publisher documents a BERT architecture with an XLM-R tokenizer, MIT metadata, and Vietnamese results on unrelated language tasks. Those results do not establish PII quality. Pin revision `6e8c1ec6b4ec4e3fc6eb7d2cd834fcd582b61daf`; explicitly verify the tokenizer instead of inferring it from the BERT architecture. [Publisher model card](https://huggingface.co/microsoft/Multilingual-MiniLM-L12-H384).

There is an immediate size constraint: its inspected configuration has 250,037 vocabulary entries and hidden size 384. FP32 word embeddings alone therefore occupy **384,056,832 bytes**, exceeding the proposed 300 MB pack limit. The current evaluation export quantizes MatMul only, so it does not establish compression of the embedding table. A 117M-parameter label does not imply a 117 MB usable pack. Passing admission requires a supported embedding-inclusive compression/export path and measured full artifacts; no 4× reduction is assumed.

The admission probe must establish all of the following before a pilot training run:

1. Pin/download the exact authorized model and tokenizer artifacts and verify hashes and notices. Use local files, no remote custom code. The metadata screen is not a completed redistribution review.
2. Add a temporary token-classification head only to exercise the export/runtime. Its random predictions are not scored as model quality. Verify the checkpoint's tokenizer IDs, special tokens, padding, attention masks, original offsets and 384-token shared windows against the reference implementation.
3. Test NFC/NFD, leading emoji, unknown tokens, mixed scripts, repeated substrings, whitespace and window seams. Python codepoint offsets must be explicitly mapped to JavaScript UTF-16. Never attach reference offsets to different inference IDs. Token pieces straddling annotated boundaries must be rejected or recorded for adjudication, not silently given an approximate label.
4. Export FP32 then the proposed compressed artifact; measure the complete pack, not just graph size. Test the exact deployment runtime's operator support and token predictions. A failed embedding-compression/offset/runtime gate ends this candidate's admission attempt; do not train first and relax the size target later to accommodate it.
5. If admitted, qualify the fine-tuned FP32 and quantized outputs separately. Exact private-span and own-category results matter; logit tolerances or token F1 alone cannot qualify a privacy detector. Use one model at runtime.

This step does **not** download the candidate, implement embedding quantization, train the new head, promise a particular runtime, or qualify the prototype. The [source screen](detector-feasibility/source-screen.json) records revisions, public declarations and hashes of the inspected small files.

## Why not reuse the available training data immediately?

| Source | Current evidence | Admission decision |
| --- | --- | --- |
| Existing Underthesea NER checkpoint | Apache-2.0 metadata; inspected card has no substantive training/provenance description | Keep as measured control. Do not assume the fine-tuning data is fully documented because the checkpoint has a license tag. [Card](https://huggingface.co/undertheseanlp/vietnamese-ner-v1.4.0a2) |
| Meddies Vietnamese synthetic PII | Publisher describes synthetic medical/admin data and declares CC-BY-NC-4.0; broad date labels and related derived views differ from this app's policy | Do not import into a distributable-training path in this study. Permission, lineage and policy mapping remain unresolved. [Dataset card](https://huggingface.co/datasets/Meddies/meddies-pii) |
| VLSP2016 NER | Inspected SEACrowd card declares CC-BY-NC-4.0; official VLSP resource access requires a signed agreement | Do not treat a public mirror as sufficient reuse clearance; news NER also does not cover the full private-type list. [Card](https://huggingface.co/datasets/SEACrowd/vlsp2016_ner), [official access](https://vlsp.org.vn/resources) |
| NVIDIA Nemotron-PII | Publisher declares synthetic English PII and CC-BY-4.0 | Potential future source after attribution/lineage review and policy remapping; not Vietnamese final validation. No rows imported. [Dataset card](https://huggingface.co/datasets/nvidia/Nemotron-PII) |
| Newly authored OfflineMask synthetic records | Explicit author, source ID, scenario family, template, review state and annotations | Admit to development preparation. No public license is granted by this work; repository publication terms remain the owner's decision. |

These are conservative admission decisions based on publisher declarations, not legal clearance or claims that all public data is unusable. No author was contacted. The previously screened PhoBERT PII lead remains held at its documented preprocessing/provenance gaps; this plan does not broaden into an unbounded model search.

## Capability contract

The [machine-readable contract](detector-feasibility/capabilities.json) enumerates 19 target types under the **existing six UI categories**. It is a development target, not a new completeness promise.

| Existing choice | Target private types | Responsibility |
| --- | --- | --- |
| Họ và tên | Full person name in context | Contextual detector, exact boundaries |
| Địa chỉ | Complete address and relevant location in context | Contextual detector plus shared boundary policy |
| Email / Số điện thoại | Complete contact value | Existing local parsers and policy |
| Tài khoản và mã định danh | Labelled account, identity, passport, tax, transaction, customer ID | Explicit labels/local recognition; contextual evidence must not override clear field meaning |
| Thông tin riêng tư khác | Organization, birth date, card, CVV, PIN, username, password, API key, IP | One contextual detector plus validated local semantics; card/CVV/PIN and IPv4 coverage gaps need targeted work |

Retain operational dates, amounts, rates, counts, versions, HTTP codes, instructions, headings and missing-value descriptions. Use organization names as sensitive only within the declared workflow policy; do not equate every capitalized phrase with a private entity. Bare numeric cells without context are unsupported for guessing identity. Contextual distinctions cannot be delegated to number length or checksums alone. Credentials containing other recognizable values retain their complete opaque span and correct category.

If the eventual training head uses BIO tags for all 19 types, that is 39 labels including `O`; this is a proposed training schema, not a count of new product options. Annotate full original spans first. Explicitly reconcile nested values to the workflow's outer opaque entity, rather than emitting contradictory overlap targets. Special/padding tokens must not become entity training labels; fast-tokenizer offsets and label alignment require validation. [Transformers tokenizer alignment](https://huggingface.co/docs/transformers/main_classes/tokenizer), [token classification](https://huggingface.co/docs/transformers/tasks/token_classification).

Future Excel headers and OCR/PDF source mappings remain adapter work. The development seed uses plain text; it does not qualify cells, regions, extraction or secure file export.

## Data preparation delivered

Added **29 development records across 28 authored families**, including one NFD/emoji variant of the same person record, all 19 target types, and nine wholly ordinary families. Author review is recorded honestly; there is no independent review. Invented identifiers are examples, not verified unused real-world identifiers. No detector was run on these records, but they are visible development material and must never become a final holdout.

The [validator](../../desktop/scripts/detector-feasibility/corpus.mjs) checks provenance declarations, malformed/unknown/nested annotations, whitespace and grapheme boundaries, duplicate IDs, same-family/template leakage, and normalized text/entity-masked-template collisions across splits. It preserves exact UTF-16 spans for NFC/NFD and emoji. It rejects normalized full-text reuse from all 362 existing regression cases. Reports count families rather than inflation from representation variants. No tokenization or model download is needed to run it.

These checks do not prove truthful provenance, correct semantics, no near-paraphrases or disjoint value vocabularies. That requires review and a separately frozen split inventory. A reviewer field alone cannot establish an independent human audit. Final-validation readiness deliberately remains false in this tool.

The audit passes structural checks but returns **`pilotReady: false`**: there are no training records or final records, and development coverage is far below the declared pilot quotas. This prevents a small illustrative seed being presented as training-ready data.

Proposed pilot minimum: 200 training families and 80 development families, at least 30% wholly ordinary families and 20 distinct families per private type in each partition. Families can contain multiple types; noisy, NFD, upper/lowercase and simulated extraction variants stay with their original family. Split template and scenario families before rendering. Do not reuse the 362 observed regression fixtures for training, threshold selection or teacher-generated targets.

Proposed final minimum: 300 separately authored families, including 100 ordinary families and 30 families per private type, with independent annotation review. Freeze scenario/template/value partitions and candidate identity before the one-use final run. No final records were authored now, so they cannot leak into the imminent admission work. Final-set counts are engineering coverage quotas, not a statistical guarantee about banking documents.

## Proposed resource and quality gates

These are predeclared **prototype targets**, not already accepted shipping promises or measured achievements. They can change only with an explicit rationale before a new scored candidate run; preserve prior failed evidence.

| Target | Admission/qualification budget |
| --- | --- |
| Optional recognition pack, all weights/tokenizer/support files | ≤300,000,000 bytes; no weights in default app |
| Runtime contextual models | One |
| Cold ready after process launch | ≤5 seconds |
| 2,000-character input | p95 ≤300 ms after warmup, including tokenizer, policy and worker transfer |
| 50,000-character supported maximum | ≤8 seconds |
| Peak app + worker + child-process memory | ≤1 GiB above the OS, measured as process-tree resident memory with its metric documented |
| Cancellation acknowledgement | ≤250 ms; no partial success or stale preview; subsequent job must work |

First reference machine: current Apple M1 Pro, 16 GiB, CPU only. A named Windows 8 GiB reference and exact OS/CPU must be fixed and tested before a cross-platform release claim. Measure disconnected packaged runtime, full tokenizer costs and cold caches where feasible; developer precomputed tokenization and Node-only inference are insufficient. Report shared runtime/installer costs separately from the pack.

Quality gates retain the current per-category/full-value thresholds and short ordinary-character limit. The future fixed final set of 100 ordinary families permits at most one affected negative family; also report per-document counts and all partially exposed values. Require zero request/offset errors and zero misses or wrong-category critical values on the declared critical set, including card, CVV, PIN, password and API key. Against the incumbent on observed regressions, disclose every complete/partial loss and newly masked ordinary position; no candidate may pass simply by trading critical losses for a better total. All frozen final types must meet their own threshold. Passing remains evidence on synthetic fixtures only.

## Pilot training envelope, only after admission and data readiness

Use a token-classification fine-tune rather than train an encoder from scratch. First run a maximum 100-step local smoke experiment, with no final set, to verify gradients, label alignment, resource use and checkpoint reload. Stop on any nonfinite loss, span mismatch or out-of-budget memory. A small training set can establish plumbing, not accuracy.

If both data quotas and admission gates pass, cap the initial pilot at 2,000 optimizer steps or three epochs, whichever comes first, one fixed seed and development-only early stopping. Run a second seed only if the first improves the predeclared development objective without critical regression. No broad hyperparameter sweep, distillation from the failing pair or paid/cloud job is part of this plan. Pin the exact training/export environment before any run. Transformers and Optimum documentation were checked with Context7; no new dependency environment was installed. [Optimum export and quantization](https://huggingface.co/docs/optimum/onnxruntime/usage_guides/quantization).

For roughly 117M parameters, FP32 weights, gradients and two Adam moments alone are about 1.87 GB decimal, before activations, optimizer implementation overhead and export copies. This is a lower-bound planning calculation, not a measured training-memory requirement. Training speed, total time and cloud price remain unmeasured; time a local smoke run before estimating or authorizing larger compute. The 16 GiB host is a possible probe environment, not a confirmed training budget.

**Immediate next action:** perform the single pinned MiniLM tokenizer/export/embedding-compression admission probe. In parallel development planning, expand the authored corpus and obtain independent annotation review. If the probe cannot meet size and source-position requirements, stop this candidate before training and document the failure; do not quietly add another model or claim the old pair is final.

## Reproduction and limits

```sh
mise exec -- node scripts/detector-feasibility/audit.mjs
mise exec -- pnpm test
```

The audit writes synthetic-only counts/fingerprints to ignored `artifacts/detector-feasibility/`; it does not import model runtimes, contact services, or log source content. The structural checks cannot determine whether arbitrary supplied text is truly synthetic, so only the reviewed development files may be passed to this workflow. No training/export code or release-ready checkpoint is delivered by this feasibility step.

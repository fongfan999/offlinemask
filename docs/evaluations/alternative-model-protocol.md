# Alternative model evaluation and alignment repair

Date: 10 September 2026. User authorized fixing alignment, then benchmarking Underthesea and BigMed before changing the optional pack.

## Alignment repair

Transformers.js 4.2.0's token-classification pipeline decodes each token ID with special-token skipping. The pinned Small model maps “Ầ” to an unknown ID, and the pipeline omits it. OpenMed's text alignment then cannot place the later uppercase pieces of the ordinary `negative-upper` fixture reliably.

`predictAllTokens` now pairs raw tokenizer pieces with their actual model logits. It verifies token counts and the single-CLS/single-SEP encoder layout before indexing. Unknown source pieces and their predicted labels survive; standalone SentencePiece whitespace markers are excluded without renumbering later tokens. OpenMed still handles source alignment and BIO decoding. Malformed dimensions, scores, labels, or unsupported token layouts fail closed. This repairs the observed SentencePiece unknown-token failure, not every possible tokenizer's alignment problem.

The existing three configurations were rerun twice on the unchanged 66-case corpus after the repair. The uppercase failure disappeared, and full entity coverage/excess lexical masking totals were unchanged. The original 11 regressions passed; the uppercase fixture was then added to the ongoing suite, bringing it to 12. Unit tests cover unknown-token predictions, whitespace indices, and malformed output. The production model manifest and installed user files stay unchanged.

Current documentation was consulted through Context7: [Transformers.js token-classification implementation](https://github.com/huggingface/transformers.js/blob/main/packages/transformers/src/pipelines/token-classification.js), [tokenizers.js encoding contract](https://github.com/huggingface/tokenizers.js), and [native tokenizer source-offset tracking](https://huggingface.co/docs/tokenizers/quicktour). The installed JavaScript tokenizer does not expose native exact offsets; it must not be confused with the Rust/Python implementation.

## Candidate provenance and conversion

- BigMed: `OpenMed/OpenMed-PII-Vietnamese-BigMed-Large-278M-v1-onnx-android`, pinned revision `2c996ac92e24c939755a8197c3f574c4f65874cf`. Evaluate its publisher-provided INT8 graph.
- Underthesea: `undertheseanlp/vietnamese-ner-v1.4.0a2`, pinned revision `a51e05fc09e1b1f0800dbad8ae84e86ad311debd`. Evaluate a local ONNX FP32 export and a dynamic INT8 MatMul quantization. Keep FP32 as a reference so quantization losses are visible.

Both source repositories declare Apache-2.0. The explicit developer downloader records revisions, size and SHA-256 for every file; LFS weights are checked against the upstream SHA-256, and ordinary metadata against its Git blob hash. Files live only under ignored `artifacts/alternative-models`. No candidate download or Python tooling is included in the app, normal build, or startup.

Underthesea conversion uses an isolated Python 3.12 environment: Torch 2.8.0, Transformers 4.57.6, Optimum 2.1.0 / optimum-onnx 0.1.0, ONNX 1.19.0 and ONNX Runtime 1.22.1. The full installed requirements and export-script hash are stored with the evaluation manifest. Optimum validates the FP32 export; dynamic quantization uses QInt8 MatMul weights without per-channel quantization. This is a measured export, not an estimated fourfold compression or a publisher-provided optimized package. Sources remain offline during conversion; custom remote code is disabled.

## Fairness and integration boundaries

The main comparison uses the same 66 synthetic cases and scoring protocol, local contact/banking recognizers, final span policy, and Node CPU runtime. It includes the repaired original Small, Large and pair, BigMed, Underthesea INT8 and Underthesea FP32. Each configuration gets two separate sequential processes. No detector thresholds or annotated expectations are tuned to candidates. Reports retain request failures.

Underthesea supplies PER/LOC/ORG/MISC rather than a broad privacy label set. Map PER to names, LOC to addresses/locations, ORG to organizations. MISC is not automatically sensitive. This model therefore cannot claim passwords, birth dates, or banking identifiers beyond what the shared local recognizers detect. General location recognition is not equivalent to complete postal address recognition.

Its WordPiece tokenizer can produce unrecoverable unknown strings and alignment failures in the current JavaScript adapter. To separate integration failures from model quality, run a second **quality-only reference** with the native tokenizer's exact source offsets, converting Unicode codepoint offsets to UTF-16. This reference runs local ONNX on CPU and uses the same downstream OpenMed decoding, label mapping, final span policy and scoring. It uses 384-token overlapping native windows (64-token overlap), which differ from the JavaScript character-window planner on long input. Do not mix its runtime/memory with Node measurements or present it as an implemented desktop integration. FP32/INT8 reference differences are measured, not assumed.

This corpus has already been observed during development. Results diagnose candidates, not prove production accuracy. Any selected replacement still needs a complete app-compatible tokenizer path and evaluation on separate independently reviewed examples before changing the pack.

## Reproduction

1. Explicitly run `python3 scripts/download-alternative-models.py` to fetch the pinned candidates, or supply their verified files locally.
2. In the isolated evaluation Python environment, run `scripts/export-underthesea.py`. Capture `pip freeze` into `artifacts/alternative-models/conversion-requirements.txt`.
3. Run `mise exec -- node scripts/prepare-alternative-evaluation.mjs` to verify source hashes and record the exported candidate hashes and sizes.
4. Run `mise exec -- pnpm models:check`, then `mise exec -- node scripts/compare-models.mjs artifacts/model-alternatives --alternatives`. Candidate hashes are checked before the run; inference fetches are disabled.
5. For the native-offset reference, serialize parsed `model-comparison.json` fixtures using `parseFixture` to `artifacts/alternative-models/corpus.json`; run `scripts/reference-underthesea.py`, then `mise exec -- node scripts/score-underthesea-reference.mjs`.
6. Run the ongoing regression gate for the candidate with `mise exec -- node scripts/evaluate-model.mjs --alternative bigmed` (or the Underthesea variant name). Candidate failures are expected evaluation outcomes and must be reported; they do not mean the production suite passes for that candidate.

Only synthetic source and results belong in tracked reports. No real user text is used in these evaluations.

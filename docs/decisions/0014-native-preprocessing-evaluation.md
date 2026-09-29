# 0014 — Native BigMed preprocessing and candidate eligibility

Date: 15 September 2026. Status: evaluated; BigMed not selected, PhoBERT challenger held at preprocessing eligibility.

## Decision

Resolve BigMed's tokenizer-ID mismatch by using native tokenization for counts, inference IDs and original positions in an isolated developer provider. Keep production code, dependencies, model files and downstream detection policy unchanged. The [comparison](../evaluations/native-preprocessing-comparison.md) completes all 262 observed cases twice without errors and with identical outputs, but still fails the unchanged quality screen. BigMed is now rejected as a release replacement on measured quality, rather than left unrankable because of seven preprocessing failures.

Do not replace the current development pack with BigMed. It covers 308/328 values versus the pair's 315/328, gaining six complete values and losing thirteen. Twelve losses are names. Lower overall ordinary masking and better “other” coverage do not offset the name failures for the proposed shared core.

## Implementation boundary

`scripts/native-preprocessing/` is never imported by app code. A persistent local Python tokenizer prepares every query requested by the unchanged shared chunk planner, with content/full IDs and source offsets validated. The process closes before Node ONNX Runtime inference. The prepared cache makes the provider's synchronous token-count interface deterministic for the known fixture set. This is an evaluation bridge, not an approved desktop architecture or an unbounded cache for user input.

The same installed Node CPU ONNX Runtime 1.24.3 executes the existing publisher INT8 graph using native IDs, with no JavaScript retokenization. The common decoding and masking policy are reused unchanged. Tensor resources are released on both success and failure. The new provider needs a separate shipping implementation and performance/packaging assessment before it could be used by a desktop release.

Context7 was consulted for [ONNX Runtime's JavaScript session contract](https://github.com/microsoft/onnxruntime/blob/main/js/common/lib/inference-session.ts). The native Tokenizers 0.22.2 contract was established in Decision 0013. No dependency versions or export artifacts changed.

The experiment uses a new frozen protocol referencing the previous shared-core protocol and report by hash; historical sources/results remain intact. Five new unit tests verify planning, encodings, actual tensor inputs/disposal, source spans and process failure. All 87 unit tests pass. Previous production parity/build evidence is preserved, not claimed as newly rerun for developer-only changes.

## Challenger screen

The [PhoBERT PII metadata screen](../evaluations/vietnamese-pii-challenger-screen.md) confirms 54 entity types encoded in 109 BIO labels and a roughly 538 MB FP32 weight file. No weights were downloaded. The fine-tuned preprocessing/source-position contract is not documented, and the inspected demo uses a different XLM-R checkpoint. Hold scored admission until preprocessing, source alignment, context budget and local export are specified and verified. Do not infer quality from language tags, parameter counts or a label inventory.

No release model is selected. One optional Vietnamese pack remains the user-facing direction, with manual downloads/updates only. There are no input uploads, telemetry, correction collection or automatic network checks. Development evaluation uses synthetic fixtures; the candidate screen reads public metadata only.

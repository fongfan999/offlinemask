# 0019 — Data and export gates before single-detector training

Date: 18 September 2026. Status: feasibility preparation implemented; training and candidate admission pending.

The owner asked to continue after rejection of the existing model candidates. Prepare a bounded single-detector direction with a concrete capability/data contract and resource targets. The [feasibility report](../evaluations/detector-feasibility.md) distinguishes current implementation from proposed training and release claims.

Nominate pinned Microsoft Multilingual MiniLM L12-H384 for an engineering admission probe, not as a release selection or already admitted quality candidate. It needs a new token-classification head and verified BERT/XLM-R tokenizer integration. Its FP32 word embeddings alone exceed the proposed 300 MB pack limit; compression/export/operator/offset gates must pass before spending effort on training. Current MatMul-only quantization cannot establish that result.

Do not automatically import Vietnamese NER/PII datasets or reuse a fine-tuned checkpoint based solely on an open license tag. Record source revisions and publisher declarations. This study imports no external data rows or weights. Start with authored synthetic data and document missing review and publication rights.

Implement a developer-only annotation/split auditor and a 29-record development seed across 28 families. Preserve all 19 target private types under existing user categories, including cards under “other.” Exact Unicode source spans and provenance remain explicit. Reject normalized regression reuse and family/template/text leakage between splits. Seed validity is not semantic correctness or training readiness; the current audit must fail the readiness gate until corpus quotas and review are met.

Keep one optional recognition pack and no weights by default. No UI, production scope, dependencies, inference code, model installation, telemetry, private-input persistence, background update checks or external messages change. The existing pair remains only a development control. New budgets are prototype objectives to qualify before release, not promises derived from these small synthetic examples.

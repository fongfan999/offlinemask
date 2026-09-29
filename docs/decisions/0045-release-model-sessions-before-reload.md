# 0045 — Release model sessions before reloading

Date: 21 September 2026.

An isolated packaged test reproduced a web-view restart during its second model reload. The original reset terminated the worker and immediately constructed another one without explicitly disposing the ONNX sessions. The OS termination reason is unknown; do not present this as a confirmed memory-kill diagnosis.

Reset now rejects the cancelled caller immediately, drains/aborts current inference, awaits model disposal, and only then starts the queued request in the same worker/runtime. This avoids overlapping replacement sessions and follows the [Transformers.js pipeline disposal lifecycle](https://github.com/huggingface/transformers.js/blob/main/packages/transformers/src/pipelines/_base.js), checked through Context7. Ordinary provider failures use the same release path. A reset may need to wait for an in-progress load before it can dispose its result; a 30-second bound retains hard termination as a fallback. Cooperative warm cancellation keeps its existing five-second bound and loaded models. Shutdown uses immediate worker destruction.

Request IDs continue to suppress stale progress/results and native tokenizer replies. Disposal blocks new model acquisition. A cancelled source is not inferred after loading completes. Original text and sessions remain in UI memory; there is no new private persistence, telemetry, download or network check.

The first fixed trial completed three reloads where the baseline failed at the second. Peak sampled RSS was still high (about 5.1 GiB); this is not a memory-usage improvement claim. Fatal-runtime recovery, low-memory systems and cross-platform qualification remain separate requirements. [Evidence and reproduction](../evaluations/recognition-reload-v1/README.md).

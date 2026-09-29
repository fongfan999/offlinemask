# 0025 — Prefer cached two-thread native execution for further qualification

Date: 18 September 2026. Status: component runtime budgets met on the reference Mac; privacy-model selection and normal activation remain held.

Phase profiling shows native inference, rather than tokenization, dominates the workload. A bounded request-local encoding cache preserves source windows, token IDs and raw/masking offsets. Moving the same graph from one to two CPU threads reduces the profiled long-document time from 9.749 to 5.525 seconds and warm p95 from 459 to 277 ms. Peak sampled footprint across the profile is 824 MB. No second contextual model or new dependency is needed for this improvement.

A separate focused run records 205 ms warm p95, 5.224 seconds for 50,000 characters, 4 ms maximum timer delay and 34 ms maximum frame interval, with zero focus losses. Both thread configurations retain 20/20 CPU-reference agreement. Active tokenizer cancellation now passes (2 ms acknowledgement, 11 ms drain), as do graph cancellation/recovery and late-result suppression. All 122 application tests pass; normal and feature-enabled native checks pass.

Keep the scope precise: foreground timing is a separate normally launched run without network-deny or memory sampling. Preserve the original one-second background timer gaps and failed foreground attachment attempt. Background scheduling is a plausible explanation, not a proven cause. Timings exclude final entity decoding/shared masking policy and do not qualify the whole feature.

Use cached two-thread native execution for subsequent experiments on this machine. Keep it feature-gated and leave the normal pack unchanged. The roughly 204 MB optional candidate pack is still an encoder with an untrained 39-label head; it is not a usable privacy detector, a final model decision or an installer change.

The next substantive step is training-data readiness: expand the authored development/training families against the existing capability contract, verify provenance and split separation, and obtain independent annotation review. Do not relabel observed fixtures as fresh validation, train on production input, infer independent review from an author field, or start training before the declared readiness gates pass. Repeated-use/cold-load cancellation, the named Windows reference and complete trained-pipeline tests also remain open. No telemetry or automatic internet checks are introduced.

Evidence: [phase profile](../evaluations/minilm-profile.md), [foreground follow-up](../evaluations/minilm-focus.md), and their frozen results. Earlier rejected measurements remain intact.

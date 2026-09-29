# 0024 — Continue with native execution, retain the performance hold

Date: 18 September 2026. Status: native packaged comparison measured; default activation remains held.

Using the same graph/tokenizer and one CPU thread, the packaged native candidate retains 20/20 reference agreement, lowers sampled physical footprint from 2.32 GB to 835 MB and lowers 50,000-character processing from 19.97 seconds to 10.64 seconds. Active graph cancellation and recovery pass with an 8 ms observed completion time. Prefer this backend for the next technical investigation; no ensemble or new model is needed for this improvement.

Do not promote it yet. Warm 2,000-character p95 is 485 ms against 300 ms, long processing exceeds 8 seconds, a 1,032 ms heartbeat delay is unexplained, and the direct tokenizer-cancellation probe completed before cancellation was accepted. Record that probe as failed/inconclusive for active cancellation rather than substituting the separate late-result unit test.

Next profile native inference separately from tokenization/planning and IPC, preserve source/window identity while eliminating duplicate work, and strengthen the cancellation harness. Keep numerical tolerance and resource targets unchanged. Packaged macOS sampling is not universal cross-platform or memory qualification.

See the [native comparison](../evaluations/minilm-native-desktop.md), [specification](../evaluations/minilm-native-desktop/spec.md) and [frozen results](../evaluations/minilm-native-desktop/results.json). The normal UI and installed recognition pack remain unchanged. Training-data review and learned privacy quality remain independent blockers; MiniLM still has an untrained head.

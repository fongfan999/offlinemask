# 0023 — Hold the packaged MiniLM WASM path on resource budgets

Date: 18 September 2026. Status: opt-in desktop integration tested; normal builds remain unchanged in behavior.

The packaged Tauri/WebKit prototype verifies the native tokenizer through IPC and passes all 20 CPU-reference inference comparisons at the original tolerance. Native cancellation drains in 23 ms in the tested warm case, busy/stale requests are rejected, and worker restart recovers. The app completes using local assets under a network-deny launch profile.

Resource measurements fail the proposed targets: 794 ms p95 for 2,000 characters versus 300 ms, 19.969 seconds for 50,000 characters versus 8 seconds, and 2.32 GB peak sampled app/new-WebKit physical footprint versus 1 GiB. Keep the feature disabled by default. Do not relax targets or confuse the 204 MB download with runtime memory.

Next, isolate tokenizer/IPC allocation and compare native graph execution using the same pinned graph, source-offset contract and fidelity tolerance. Preserve this packaged failure evidence. No ensemble, model installation, training or production migration follows from this experiment.

See the [desktop report](../evaluations/minilm-desktop.md), [specification](../evaluations/minilm-desktop/spec.md) and [frozen results](../evaluations/minilm-desktop/results.json). Memory ownership is conservative and sampled; cancellation timings do not establish immediate memory reclamation. macOS evidence does not qualify Windows/Linux or learned privacy quality.

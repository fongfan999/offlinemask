# 0021 — Prefer Gather-only compression for the MiniLM technical prototype

Date: 18 September 2026. Status: bounded repair verified; training/release admission remains held.

The more aggressive 140 MB prototype failed cross-runtime fidelity. Quantizing only Gather weights produces a 203.89 MB complete prototype and passes all 20 CPU/Node-hosted WASM comparisons at the unchanged tolerance. Prefer this variant for future technical qualification; preserve the previous failed evidence. Do not infer post-training quality or final download size from an untrained head.

Explicit grapheme-wise NFC and reversible UTF-16 mapping resolve the observed ID/mask discrepancies across 407 inputs and 476 original windows. Native fast-tokenizer offsets agree with original SentencePiece lexical source associations on these diagnostics. This is an executable Python reference, not an app offset implementation or proof for arbitrary Unicode.

Before training admission, implement and qualify a shipping local tokenizer/source-offset contract, then test the packaged runtime and resource budgets. Reviewed training data remains independently required. Do not use a Python sidecar, silently migrate the installed detector, weaken the tolerance, or call these reused probes independent quality evidence.

See the [repair report](../evaluations/minilm-repair.md), [predeclared specification](../evaluations/minilm-repair/spec.md) and [frozen results](../evaluations/minilm-repair/results.json). Production files and dependencies remain unchanged. No telemetry, private-input collection or automatic network check was added.

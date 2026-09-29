# 0020 — MiniLM fits the pack budget but remains held at integration

Date: 18 September 2026. Status: technical probe completed; candidate not admitted to training.

The owner asked us to continue the pinned MiniLM export/compression and source-position prototype. An explicit developer-only source download and isolated Python tools were necessary for that authorized probe. No app model or dependency was replaced.

Gather plus MatMul quantization reduces the graph to 118.07 MB, and the complete prototype is 140.24 MB including tokenizer/support files and notice. The proposed 300 MB size target is feasible for this export. A random 39-label head exercises token-classification output; no privacy training or accuracy evaluation occurred.

Hold admission because the converted fast tokenizer differs from the original SentencePiece IDs on 16 inputs, existing source alignment fails six inputs, and compressed CPU/WASM outputs exceed the predeclared tolerance on six of 20 probes. JavaScript matches original SentencePiece IDs on all 476 planned windows; copied fast offsets therefore are not a valid fix. The FP32 WASM control passes and helps isolate the compressed-execution discrepancy.

Repair one exact tokenizer/source-mapping contract and isolate the quantization/runtime discrepancy before training. Preserve failure evidence and requalify any proposed change. Packaged runtime, resource budgets, independently reviewed data and final privacy quality remain separate gates. See the [admission report](../evaluations/minilm-admission.md).

Production code, model manifest, UI, private-session storage, manual-only networking and offline/no-telemetry behavior remain unchanged. Passing a size target does not supersede the rejection of the current release candidates or select MiniLM for release.

# 0022 — Use a native offset-producing library for the MiniLM prototype

Date: 18 September 2026. Status: native adapter verified on bounded diagnostics; production integration pending.

Replace the Python-only feasibility path with a reusable Rust prototype using Hugging Face Tokenizers 0.22.2, local checksum-verified tokenizer JSON, grapheme-wise NFC and reversible UTF-16 mapping. Disable HTTP/default features and pin the separate developer crate's dependencies. This produces offsets alongside the exact encoded IDs and avoids a Python sidecar or permissive text-search alignment.

Keep raw tokenizer offsets separate from masking boundaries. The independent boundary checks found that raw spans can include a preceding space or CRLF. Trim only edge whitespace graphemes for masking while retaining token indices and raw alignment evidence. Preserve both initial failures and successful reruns.

The adapter matches all 883 frozen records, passes 31 boundary/failure checks and feeds WASM inference with 20/20 CPU-reference comparisons at the original tolerance. Four Rust tests, 118 application tests and Clippy pass. See the [report](../evaluations/minilm-native.md) and [frozen results](../evaluations/minilm-native/results.json).

The next step is feature-gated Tauri integration, offline packaged execution and resource/lifecycle qualification. Keep the normal application and installed pack unchanged until the candidate qualifies. Training-data review, learned privacy quality, post-training compression and final detector selection remain open; this prototype has an untrained head.

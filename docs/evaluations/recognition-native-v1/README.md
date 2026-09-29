# Selected-pair native runtime evaluation

This developer experiment keeps the owner-selected Underthesea INT8 + mSuperClinical INT8 files fixed. It evaluates execution cost, not a new model choice. The normal application still uses its WASM worker.

The new feature-gated `recognition-native-check` executable reads the release-pack catalog, verifies local assets and runs ONNX Runtime 1.24.3 through the existing optional `ort 2.0.0-rc.10` dependency. Its launcher verifies the local runtime's pinned hash. There are no downloads or telemetry. The previous native experiment and its older model manifest remain unchanged.

The harness reuses production chunking, BIO decoding, policy and NFC-to-original source restoration through `createRecognition`. Underthesea uses the shipping Rust tokenizer for validated source offsets; both models use the same JavaScript tokenizer/token-score conversion as production. Only graph execution crosses bounded JSON-lines into the native child. Four CPU threads per session, serial inference. This transport is a developer harness, not proposed shipping IPC.

## Reproduce

Requires the existing local model files and frozen synthetic quality-first artifacts. Results refuse overwrite; provide a new output path for another run.

```sh
mise exec -- cargo build --manifest-path src-tauri/Cargo.toml --release --features native-inference-prototype --bin recognition-native-check
mise exec -- cargo build --manifest-path src-tauri/Cargo.toml --release --features recognition-evaluation --bin recognition-tokenizer-check
mkdir -p artifacts/recognition-native-v1
mise exec -- python3 scripts/recognition-native-v1/monitor.py
# In a separate terminal:
mise exec -- /usr/bin/sandbox-exec -p '(version 1) (allow default) (deny network*)' node scripts/recognition-native-v1/evaluate.mjs
```

The memory sampler records only the exact developer Node parent, inference child and tokenizer child, at 500 ms intervals. It includes RSS and macOS physical footprint (including compressed memory). It does not measure the user's app or the cost of a future packaged native integration.

## Measured result — 21 September 2026

- **398/398 saved outcomes matched**, both complete and category-selected previews. Existing quality result unchanged: 495/500 annotated values covered in their own category and 467 ordinary lexical positions overmasked. No additional quality claim.
- Run under macOS network denial, with `fetch` also replaced by a rejecting counter: **zero attempted fetches**. This validates the developer process tree, not the packaged UI.
- Load/preparation: **7,970 ms**, including child startup, runtime validation, graph hash checks/loading and tokenizer preparation. This is not first-request UI latency.
- Warm 161-character fixture: **47 / 48 / 47 ms**.
- 2,000 characters: **866 ms**; 10,000: **4,789 ms**; 50,000: **23,871 ms**.
- All six timed fixtures produced three preview findings and complete address coverage in a post-run `analyzeText` check.
- Memory sampled every 500 ms across all three developer processes: **1,949,564,928 bytes peak aggregate RSS (1.82 GiB)**; **3,534,960,672 bytes peak aggregate physical footprint (3.29 GiB)**. These peaks need not occur at the same time. Footprint includes compressed memory; do not present only the smaller RSS as total memory cost.
- Invalid model, oversized frame, unknown fields, missing pack, cancellation while loading/processing, and successful fresh-child restart passed separately under OS network denial. These are native-child checks, not desktop worker/IPC validation.
- 166 application tests, TypeScript checking, frontend production build, default native formatting/Clippy, two new native executable tests and feature-enabled executable Clippy passed.

The earlier packaged WASM run took **224,585 ms** for the identical 50,000-character fixture. This native run is **9.4× faster** in a different execution boundary (developer Node orchestration plus Rust child vs packaged WebView worker), on the same Mac. Four native intra-op threads versus one WASM thread is part of this comparison. It is a promising integration result, not a promise of packaged speed. A TypeScript check briefly overlapped the replay; runs were not controlled isolated-system benchmarks. Memory remains substantial, and the existing WASM RSS sample is not directly comparable to native physical footprint.

See [results](results.json), [memory samples](memory.json), [lifecycle checks](lifecycle.json), and [source/artifact hashes](protocol.json). Historical evidence is unchanged.

## Admission boundary

Passing the saved corpus means parity on existing synthetic examples, not additional accuracy evidence. The 398 records contain 386 independent records plus 12 overlapping owner-review overlays. A native runtime must also qualify packaged source mapping, startup/preload, cancellation, crash recovery, memory and offline behavior before changing the shipping default. Cross-platform runtime distribution, licenses and signing remain separate work.

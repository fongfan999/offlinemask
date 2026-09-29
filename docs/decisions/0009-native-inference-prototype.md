# 0009 — Isolated native inference prototype

**Model selection update:** The [11 September comparison](0010-vietnamese-model-selection.md) rejects all three current model configurations for release on both tested runtimes. Native remains a runtime experiment, not a selected detector solution.

Date: 10 September 2026. Status: **evaluation only; not the production detector**.

## Why

The desktop WASM sequence now completes 50,000 characters after resource cleanup and yielding preparation, but took 400.708 seconds and peaked at 7.20 GiB physical footprint on the reference Mac. A Node/native CPU reference was much faster and differed by one finding. The owner authorized a native prototype and output comparison before switching.

## Boundaries

`loadDetector` accepts an optional `InferenceProvider`. A provider supplies tokenizer token counts, all token predictions and disposal; the existing chunk construction, exact source alignment, OpenMed BIO decoding, category policy, address completion and alias analysis remain shared. The default provider retains the existing Transformers.js pipeline. No new UI, production IPC command, automatic runtime download or installed-pack mutation is introduced.

A separate `offlinemask-native-prototype` Rust executable is built only with `--features native-inference-prototype --bin offlinemask-native-prototype`. The normal app explicitly remains the default Cargo binary. The optional `ort` dependency and prototype executable are absent from the default dependency graph/build. The existing Cargo lockfile records the optional dependencies; pnpm dependencies and lockfile are unchanged by this experiment.

The Node developer adapter retains the same tokenizer, validates its CLS/content/SEP layout, sends token IDs to the child process and converts returned logits using the same prediction function. The child verifies every model asset against the existing pinned manifest before loading. It accepts only manifest model indices and bounded integer token IDs, not arbitrary per-request file paths. Frames are limited to 16 KiB, inputs to 384 tokens and output shapes to the pinned label count. Non-finite logits fail closed. It uses CPU inference with four intra-op threads and sequential requests.

Cancellation terminates the child process and rejects the pending request; a subsequent detector gets a fresh child. No partial output is presented as completion. Input/outputs are confined to pipes and process memory. The Node launcher discards provider stderr and forwards sanitized failures. The prototype executable has no networking code. Rust error messages never include the request or provider exception. The harnesses accept only repository synthetic fixtures and persist evaluation results, not private user text.

This is an executable/pipe integration prototype behind the core interface, **not** a packaged Tauri-native integration. Shipping still requires a reviewed app-to-child transport, verified/signed runtime packaging, supported-platform builds, process lifecycle handling, crash-dump/log review and offline instrumentation. Do not ship Node or assume the developer adapter is the final product architecture.

## Dependencies and provenance

- `ort` **2.0.0-rc.10**, unofficial Rust ONNX Runtime bindings, MIT OR Apache-2.0. Pinned exactly; `default-features = false`, `std` and `load-dynamic` only. No build-time ONNX binary download feature. This is a release candidate and needs a maintained-version review before production adoption.
- `ort-sys` **2.0.0-rc.10** is locked transitively.
- The experiment loads the **1.24.3** macOS arm64 ONNX Runtime dynamic library already present in the locked `onnxruntime-node` development dependency. Its exact size and SHA-256 are checked by the launcher against `scripts/native-prototype/runtime-manifest.json`. No runtime library is downloaded or bundled into the app.
- The observed executable is 485,360 bytes and the dylib is 35,937,208 bytes: roughly 34.74 MiB combined, uncompressed, excluding tokenizers and model weights. This is component size, not a measured installer increase. Platform libraries, signing and distribution could change it.

Context7 guidance for [dynamic loading](https://github.com/pykeio/ort/blob/v2.0.0-rc.10/docs/content/setup/linking.mdx) and [session/tensor APIs](https://github.com/pykeio/ort/tree/v2.0.0-rc.10/src/session) informed the implementation. We also checked the pinned source. An initial custom logger callback caused a native segmentation fault during session setup; that approach was removed. The current prototype sets session logging to fatal and discards stderr in the parent. This observation is not a general ONNX Runtime stability claim.

## Evaluation and adoption gate

See the [native comparison report](../evaluations/2026-09-10-native-inference.md) for measured results: 147/147 exact agreement with the CPU baseline and 135/147 with WASM. The 12 differences include a native sensitive-name coverage regression; the adoption gate is not met. Exact output comparison checks source offsets, entity type and value after the shared policy. Equal findings do not imply adequate detection quality; the existing labeled corpus remains the quality reference. The four input-length fixtures additionally expose backend differences near chunk boundaries. The automated WASM reference uses the same pinned WebGPU/asyncify distribution under Node, not WebKit, and is not desktop timing evidence.

Do not change the production backend until differences are understood and accepted against the labeled corpus, full-length performance and memory are measured in the packaged app, cancellation and restart pass, and the default installer/offline behavior remain verified. The optional two-model pack remains the current quality choice.

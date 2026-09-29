# Packaged MiniLM path: correctness passes, resource budgets fail

18 September 2026. The native tokenizer now runs through opt-in Tauri commands in a packaged macOS app, feeding a local WASM inference worker. **All 20 reference comparisons and lifecycle checks pass. Latency and sampled memory exceed the proposed budgets. Keep this path disabled in normal builds.** MiniLM remains an untrained feasibility candidate.

## Integration delivered

The `minilm-desktop-prototype` Cargo feature adds the frozen native tokenizer library and commands for local encoding, cancellation, idle status and a checksum-verified graph path. Normal builds exclude the dependency and commands; the normal dependency tree was checked. No normal UI route, model selection, installed pack, update behavior or private-session persistence changed.

Native encoding runs through `spawn_blocking`, with one active request and monotonically increasing request IDs. Cancellation marks that request, suppresses its result and leaves the slot occupied until actual work finishes; it does not pretend a running tokenizer call was forcibly interrupted. Subsequent requests recover after completion. The frontend adapter also discards a late response when the backend has already completed, and exposes only generic provider failures.

The diagnostic app uses its own identifier, `dev.offlinemask.minilm.desktop20260918`, and copies verified local artifacts into that identifier's data directory. It never reads user input or normal sessions. Its compile-time-only report command accepts a bounded structure of numeric/boolean metrics and fixed enum categories, not arbitrary text, offsets, paths or logits. The report is create-only. The test app exits after writing metrics.

The graph remains the 181.71 MB Gather-only export inside the previously measured 203.89 MB recognition pack. Runtime assets are bundled locally. No checkpoint or model download occurred. Optional Cargo build dependencies are separate from offline application execution.

## Measured result

One packaged run on macOS 26.6.2, MacBookPro18,3, Apple Silicon, 16 GiB RAM. Inference uses the existing single-threaded ONNX Runtime WASM dependency in an actual WebKit worker. Cold timing begins in the loaded diagnostic page; it includes graph verification/read, tokenizer loading, WASM/session initialization and one inference, but excludes OS app-launch/page-load time.

| Check | Result | Proposed target |
| --- | ---: | ---: |
| Packaged WebKit vs CPU reference | **20/20**, max error 2.682e-7 | atol=rtol=1e-4 |
| Cold processing path | **2.565 s** | ≤5 s |
| Warm 2,000-character path, p95 of 10 runs | **794 ms** | **≤300 ms — fails** |
| 50,000-character path, 46 windows | **19.969 s** | **≤8 s — fails** |
| Native cancellation acknowledgement | **2 ms** | ≤250 ms |
| Native cancelled work completion | **23 ms** | ≤250 ms |
| Worker cancellation acknowledgement | **1 ms** | ≤250 ms |
| Maximum 50 ms heartbeat delay | **34 ms** | Descriptive |
| Peak sampled physical footprint | **2,322,142,080 bytes (2.32 GB / 2.16 GiB)** | **≤1 GiB — fails this sample** |

All behavior checks passed: native busy rejection, stale-ID rejection, recovery after native cancellation, worker restart/recovery, duplicate decomposed-name boundaries, CRLF preservation and a blocked remote-fetch probe. Windowing retained full original-source coverage and verified UTF-16 rebasing. The async window planner follows the existing 1,200-unit/384-token/96-unit-overlap strategy with native count calls; these timings include planning, IPC and inference. They do not isolate model execution cost.

The native cancellation check used a warm tokenizer and a 49,700-unit input. Worker cancellation was immediate after dispatch: this verifies result suppression, termination and recovery, but not physical memory reclamation within 1 ms or interruption of a kernel known to have begun. Cold-load cancellation and every lifecycle timing permutation are not qualified. The two adapter unit tests separately verify late-result suppression when native cancellation is too late, overlap rejection and input-safe errors.

## Offline and memory evidence boundaries

The executable was launched through `sandbox-exec` with `(version 1) (allow default) (deny network*)`; it completed successfully. Graph/tokenizer assets were local and checksum-verified, runtime loader/WASM files were bundled, the CSP rejects remote connections, and the explicit remote-fetch probe failed. No system-wide connectivity setting was changed. The profile applies at main-process launch; macOS WebKit XPC services have separate sandboxing. This is evidence of successful local execution under that launch profile, not a packet-capture proof about every operating-system helper.

RAM was sampled every 200 ms using macOS physical-footprint and RSS data. The monitor observed the isolated app plus three new WebKit processes: GPU, Networking and WebContent. It conservatively includes all newly observed WebKit processes during the run rather than proving precise responsibility. It may miss transient peaks. The peak footprint occurred around 13.6 seconds; sampled peak RSS was 1,871,136 KiB. These measurements are sufficient to withhold the memory gate, not to claim exact model-only memory or diagnose an allocator leak.

## Decision

Keep the verified tokenizer/offset contract and feature-gated integration. Do not enable this WASM path as the new default and do not treat a small download as proof of a lightweight runtime. The next bounded investigation is native graph execution using the same pinned graph and source mappings, comparing it with this packaged reference for fidelity, latency, cancellation and memory. Profile tokenizer/IPC and inference allocations separately so the remedy follows evidence.

This result does not require a second detector or overlapping ensemble. It also does not select MiniLM for release: its classifier head remains random, with zero training steps. Independently reviewed training data, trained-model evaluation, post-training compression checks and cross-platform qualification remain open.

## Validation and reproducibility

- **120 application tests pass**, including the two new cancellation/privacy-boundary tests.
- Production frontend build and normal native formatting/Clippy checks pass.
- Feature-enabled native Clippy passes with warnings denied.
- The isolated `.app` bundle built and completed all diagnostics with exit code zero.
- All earlier evaluation source/raw hashes verify unchanged. The current shared detection source is unchanged.

This integration intentionally changes `src-tauri/Cargo.toml`, its lockfile and `src-tauri/src/lib.rs`, and adds the gated module. Before/after hashes are retained; do not repeat the earlier blanket statement that all production files are unchanged. Existing dependency versions were preserved while resolving optional additions. Both production lockfiles remain present; the JavaScript lockfile was not edited.

The [predeclared specification](minilm-desktop/spec.md) and [frozen results](minilm-desktop/results.json) record gates, source hashes, timings, intentional changes and measurement limits. Raw process samples, before-file snapshots, build logs and the app report are in ignored `artifacts/minilm-desktop/`. Context7 and installed sources were used for Tauri command/configuration APIs and local ONNX Runtime WASM loading.

With the prior local prototype artifacts available:

```sh
mise exec -- node scripts/minilm-desktop/build.mjs
mise exec -- pnpm tauri build --features minilm-desktop-prototype --config artifacts/minilm-desktop/tauri.conf.json --bundles app
mise exec -- python scripts/minilm-desktop/run.py
```

The launch script is macOS-specific and refuses to overwrite a completed report. Archive previous evidence and the isolated app's report before an explicitly intended rerun. Python here is only the developer process/memory monitor; it is not used by the application. Do not add this feature or diagnostic frontend to normal release commands.

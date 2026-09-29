# Packaged native graph: memory improves, latency still held

18 September 2026. The same MiniLM graph and native tokenizer now execute through a separate opt-in Tauri CPU path. **The sampled memory gate passes; latency still fails.** Keep this candidate disabled in normal builds. Its classifier is untrained, so these results establish execution fidelity and resource behavior, not privacy-detection quality.

## Comparison

Both probes use the same synthetic documents, local Gather-only graph, original source-offset contract, 1,200-unit/384-token window strategy and one inference thread on this macOS arm64 machine. Runs occurred separately, not as a randomized repeated benchmark.

| Measurement | Packaged WASM | Packaged native CPU | Target |
| --- | ---: | ---: | ---: |
| CPU-reference agreement | 20/20 | **20/20** | atol=rtol=1e-4 |
| Cold processing path | 2.565 s | **3.367 s** | ≤5 s |
| Warm 2,000 characters, p95 of 10 | 794 ms | **485 ms** | **≤300 ms — fails** |
| 50,000 characters, 46 windows | 19.969 s | **10.642 s** | **≤8 s — fails** |
| Sampled physical footprint | 2.322 GB | **834,522,760 bytes (835 MB / 796 MiB)** | ≤1 GiB |
| Graph cancellation through actual completion | Immediate worker termination; kernel entry unproven | **8 ms**, backend run phase observed | ≤250 ms |
| Maximum heartbeat delay | 34 ms | **1,032 ms** | Descriptive; investigate |

Native logits agree with the CPU reference with maximum absolute error 1.461e-8. The tokenizer/boundary checks, busy and stale request rejection, graph cancellation, recovery and blocked remote fetch pass. The native tokenizer cancellation assertion **fails in this run**: its cancellation command returned false and the request returned normally. This is consistent with work completing before the cancellation message arrives; it is not proof of mid-tokenization cancellation. The adapter's separate unit tests already cover suppressing late results, but those do not convert this failed diagnostic into a passing active-cancellation measurement.

The 1,032 ms heartbeat delay is a responsiveness concern even though numerical output is correct. This probe did not attribute that stall to a specific operation. Large IPC responses, synchronous serialization, runtime initialization and host scheduling need phase-level measurement before choosing a remedy.

## Native implementation

The `minilm-native-desktop-prototype` feature depends on the previous tokenizer integration and the existing optional `ort` dependency. It loads the checksum-verified **ONNX Runtime 1.24.3** macOS arm64 dylib already present in `onnxruntime-node`, through **ort 2.0.0-rc.10**. The runtime is 35,937,208 bytes, SHA-256 `76831409ce6eded92b4cb343cf422c458a60c1ea1d5f3cfa69692ab7fcc67f0f`. No new model/runtime download occurred. Native runtime packaging, signing and redistribution notices still need release review.

Both graph and library are verified before loading. Telemetry is disabled. A blocking-pool task owns a session during inference, leaving the UI thread free. Each run gets separate `RunOptions`; a concurrent command can set its termination flag. Only one graph request is accepted at a time, IDs must increase, and cancelled results are suppressed. Every input is bounded to 2–384 token IDs in the known vocabulary, output dimensions are checked and nonfinite values are rejected. Provider errors are generic and contain no input.

The backend marks its run phase immediately before calling ONNX Runtime. The cancellation test waits for that phase, requests termination, awaits actual completion and verifies subsequent inference. This is stronger than cancelling immediately after worker dispatch, but is not an instrumented assertion about which kernel had begun.

The diagnostic frontend requests logits only for synthetic reference comparisons; timed cases return token count only. This measures a runtime candidate, not final entity decoding/masking output. The frontend still makes multiple IPC calls for window token counts and final encoding; duplicate work remains in this baseline deliberately so the first comparison retains the preceding planner.

The separate app identifier is `dev.offlinemask.minilm.native20260918`. Its assets and numeric-only report stay outside the normal app's model directory. The normal UI, installed pack, JavaScript dependency lockfile and default feature set are unchanged. The native feature adds no new Cargo lockfile entries beyond the preceding optional tokenizer integration.

## Offline, memory and validation limits

The isolated `.app` completed with exit code zero under the same main-process network-deny launch profile. Assets are local, telemetry is disabled, CSP rejects remote requests, and the remote-fetch diagnostic fails as expected. WebKit XPC services have their own sandboxing; this is not system-wide packet capture or a proof about all OS services.

The same 200 ms memory sampler observed the isolated app and newly appearing WebKit processes. Peak sampled RSS is 718,240 KiB; peak sampled physical footprint is 834,522,760 bytes. Attribution is conservative rather than exact process ownership, and sampling can miss transient peaks. Passing this sample is useful evidence, not universal qualification under repeated use or all supported hardware.

The measured machine is macOS 26.6.2, MacBookPro18,3, 16 GiB RAM. No Windows/Linux binary was built. No training occurred. The graph retains its deterministic random 39-label head. Corpus and reference probes are previously observed synthetic diagnostics, not fresh independent privacy-quality data.

Feature-enabled compilation and Clippy pass; normal formatting/Clippy checks pass. The preceding 120 application tests remain the current frontend/core validation, including cancellation late-response handling. They were not rerun merely to restate unchanged JavaScript core behavior. A first frontend build had a duplicate diagnostic variable; it was corrected before packaging or measurement, and the failed build log is retained.

## Decision and next bounded work

Prefer native CPU execution for the next technical iteration: it materially reduces this measured footprint and improves long-document latency without changing the graph or adding another detector. **Do not activate it as the app's new default.** The warm and long-text targets still fail, and UI responsiveness/cancellation evidence needs refinement.

Next, instrument token counting, encoding, IPC and inference phases separately; remove redundant tokenization only with unchanged IDs/windows/source boundaries; test a bounded thread-count comparison if inference dominates. Replace timing-sensitive direct tokenizer-cancellation assertions with an explicit active-state handshake and an independent late-result test. Preserve the failed measurements and do not relax the budgets. Repeat long/repeated-use memory and cancellation checks after that implementation changes.

Once technical admission is solid, independently reviewed training data and trained-detector evaluation remain necessary. Neither this result nor the earlier overlapping-model control decides the final privacy model.

## Evidence and reproduction

See the [predeclared specification](minilm-native-desktop/spec.md) and [frozen results](minilm-native-desktop/results.json). Before-file snapshots account for the deliberate additional Cargo feature and handler changes. Earlier evaluation raw evidence is unchanged; the report checks previously frozen shared-file hashes against those snapshots rather than silently rewriting history. All earlier standalone tokenizer/compression sources remain unchanged.

With local previous artifacts and a clean isolated report destination:

```sh
mise exec -- node scripts/minilm-native-desktop/build.mjs
mise exec -- pnpm tauri build --features minilm-native-desktop-prototype --config artifacts/minilm-native-desktop/tauri.conf.json --bundles app
mise exec -- python scripts/minilm-native-desktop/run.py
```

The application requires no Python; the developer launch/memory monitor does. The report writer is a separate archival step with historical snapshot prerequisites. Do not include either prototype feature or diagnostic frontend in normal release commands.

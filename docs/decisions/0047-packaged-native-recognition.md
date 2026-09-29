# 0047 — Packaged native recognition qualification

Date: 2026-09-21

Status: macOS packaged comparison and UI smoke checks passed; opt-in only.

## Purpose and implementation

Qualify the selected Underthesea INT8 + mSuperClinical INT8 models in the actual desktop worker/IPC path before changing the default backend. This follows the developer-native comparison in Decision 0046. Neither weights nor detection policy changed.

`recognition-native-desktop` enables local Rust ONNX sessions; `VITE_NATIVE_RECOGNITION=1` selects the worker provider in isolated builds. The verified pack remains optional and separate. The runtime dylib is bundled as a Tauri resource and checked against its existing version/size/hash pin before loading. Four native CPU threads per session, sequential model/chunk execution. No new dependencies, automatic internet checks, model downloads, telemetry or input persistence were introduced.

Tokenization and shared masking policy stay in the worker. Bounded token IDs/logits cross explicit local commands. Native session operations run on blocking worker threads under one mutex; monotonically increasing session generations reject stale inference, and an old release cannot dispose a newer generation. The adapter forwards initialization replies even without an active document and discards replies to destroyed workers. Provider errors are replaced by generic failures.

## Measured result

The [packaged benchmark](../evaluations/recognition-native-desktop-v1/README.md) matched all 398 recorded full/category-selected previews. After eight seconds of background preparation, short input completed in 256 ms. Three normal reloads, loading cancellation/retry and three warm cancellations/retries passed. The 50,000-character fixture took 18.777 seconds versus the earlier packaged WASM result of 224.585 seconds. These are measured trials on one M1 Pro Mac, not universal timings or new accuracy evidence.

Host plus renderer physical footprint peaked at 3.22 GiB (RSS 2.40 GiB). This remains substantial. Normal UI smoke checks preserved original decomposed Unicode, produced five expected masks, restored only the unchecked name, masked the complete contextual name H’Hen Niê, and cleared temporary sessions on restart. The user's existing app was not restarted.

167 application tests, TypeScript checks, 13 native unit tests, feature-enabled Clippy and default native formatting/Clippy passed. Two pack-download integration tests stayed opt-in; this comparison used verified local assets. Benchmark and normal-UI native macOS bundles built successfully.

## Why the default remains unchanged

The native runtime currently shares the host process. A hung native chunk must return before cooperative release; the existing worker timeout does not terminate a native graph or contain a native crash. For production reliability, qualify an isolated native process or another explicit recovery strategy before promotion. A full OS-network-blocked GUI launch again had no attachable window, so that check remains inconclusive; the earlier native developer replay under OS network denial is separate passing evidence. Runtime distribution notices/signing and Windows/Linux qualification are not complete.

Proceed with native runtime hardening, preserving the selected pack and shared policy. Do not reopen the model decision or promote this experiment solely on speed.

The final normal macOS build passed with the default WASM backend unchanged. Its bundle was rebuilt but the user's running app was not relaunched.

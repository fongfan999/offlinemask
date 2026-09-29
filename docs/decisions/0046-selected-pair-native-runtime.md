# 0046 — Qualify native execution of the selected pair

Date: 2026-09-21

Status: Developer comparison passed; packaged integration pending. Production default unchanged.

## Problem

The selected Underthesea + mSuperClinical models work in the production WASM adapter, but a 50,000-character synthetic document took 224.6 seconds, and model reloading reached substantial memory use. Replacing the selected models would reopen a separate quality decision.

## Change

Add a feature-gated native evaluation executable using the existing pinned optional `ort` dependency and verified local ONNX Runtime 1.24.3. Use the authoritative release-pack assets, not the historical native prototype's model catalog. Reuse the production orchestration, source mapping, chunking and policies. Extracting `createRecognition` is the only production-core change; its loader and backend remain the same.

Native graph inference receives bounded token-ID frames. Four CPU threads per session, sequential requests, no telemetry, network API, downloads or private data collection. The development runtime is not bundled into the normal app by this change. Existing provenance remains in `scripts/native-prototype/runtime-manifest.json` (MIT runtime, 35,937,208 bytes). Current ort documentation confirmed local dynamic initialization and session thread configuration; no new dependency was introduced.

## Evidence

The [evaluation](../evaluations/recognition-native-v1/README.md) matched all 398 saved selected-pair outcomes under OS network denial. The same long fixture completed in 23.9 seconds (9.4× faster than the previous packaged WASM run, across different runtime boundaries). Warm short input took 47–48 ms. Aggregate sampled native-harness physical footprint peaked at 3.29 GiB; RSS peaked at 1.82 GiB. Do not describe the runtime as lightweight or the difference as a packaged-app guarantee.

Cancellation/restart and malformed/missing-asset checks passed for the native child. Application tests, TypeScript, frontend build, native checks and executable tests passed. No user app was restarted.

## Next admission requirement

Proceed to an isolated packaged native integration using these exact assets and shared policy. Confirm actual desktop performance and memory, offset/preview parity, background preparation, cancellation, recovery, and offline operation before switching the default. Qualify runtime packaging, licensing/signing and supported operating systems separately. No automatic network checks or pack changes are authorized by this runtime experiment.

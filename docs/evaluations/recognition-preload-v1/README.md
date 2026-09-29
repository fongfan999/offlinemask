# Background recognition loading

Developer-only synthetic test using the shipping worker, WebKit/WASM backend, pinned selected pair and native tokenizer. Separate app identity: `dev.offlinemask.recognition.preload20260921`. No private inputs or normal-app data are used.

Reproduce with `mise exec -- node scripts/recognition-preload-v1/build.mjs`, then `mise exec -- pnpm tauri build --bundles app --config artifacts/recognition-preload-v1/tauri.conf.json`. Launch **OfflineMask Preload** and click **Run benchmark**. Local fixture hashes are verified and hard-linked into the isolated pack directory. No download is needed.

The harness calls the production `prepare` method once the pack reports ready, waits eight seconds, then submits the same 161-character synthetic text used in the previous runtime benchmark. Three further requests measure warm reuse. It does not submit text during preparation. Timing metrics are persisted only in this separate developer frontend, allowing interrupted runs to remain visible. `preparationLeadMs` records the actual timer delay; detection time excludes that lead and native pack verification, but includes remaining loading and inference. `firstProcessingMs` is the first completed chunk, not a pure loading measure.

This tests the mechanism used by the app's ready-pack startup hook. A small timing run is not a cross-platform performance guarantee or new detection-quality evidence. The previous hard-reset interruption remains an open issue; background preparation does not fix or conceal it. Model weights, inference settings, source offsets, masking policies and category choices are unchanged.

## Measured result

On Apple M1 Pro, 16 GiB, with the optimized app build finished before measurement:

- Preparation started 8,007 ms before the first masking request.
- Remaining detection time was **4,418 ms**, including remaining loading and inference.
- Three subsequent requests took **673, 662 and 704 ms**.
- Every result contained three findings and covered the complete synthetic address.
- The UI timer's largest delay was 595 ms; preparation is off the main thread but is not free of system resource contention.

This is one local trial. The combined lead and first detection took about 12.4 seconds; earlier cold requests varied from about 10 to 13 seconds. Do not promise a fixed two-second wait after eight seconds or attribute run-to-run variation to an inference speed improvement. The benefit is moving the same initialization earlier and sharing it with the eventual request.

All 163 application tests and TypeScript checks passed. Tests explicitly cover shared loading, no early inference, local-only requests, failure retry, cancellation while awaiting loading, and one-worker reuse. The masking model and policy code remain unchanged from the previous parity-validated version. No additional 398-case replay is claimed for this scheduling-only change.

The normal optimized macOS app build also passed. It was not launched or restarted, preserving the owner's existing sessions.

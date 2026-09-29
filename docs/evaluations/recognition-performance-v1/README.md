# Shipping recognition runtime: cancellation recovery

Local synthetic evaluation on Apple M1 Pro, 16 GiB, macOS. Uses the pinned Underthesea + mSuperClinical pack, production worker, WebKit/WASM and native Rust tokenizer. No model weights or inference settings changed.

## Reproduction

Run `mise exec -- node scripts/recognition-performance-v1/build.mjs`, then `mise exec -- pnpm tauri build --bundles app --config artifacts/recognition-performance-v1/tauri.conf.json`. Launch **OfflineMask Performance**, and explicitly press **Run benchmark**. The separate identifier `dev.offlinemask.recognition.performance20260921` isolates its pack and synthetic metrics from the normal app. This developer-only frontend accepts no user text. It stores timing/count metrics in its own localStorage so interrupted runs remain observable; production does not collect these metrics.

The script verifies local fixture asset hashes and hard-links the previously evaluated pack; it does not download anything. Close this test app before rebuilding. Do not close the user's normal app to run the benchmark.

The fixed 161-character synthetic text is in `main.ts`. The baseline covers a fresh worker, three warm requests and a hard worker reset. The final harness covers a fresh worker, three warm requests and cancellation after the first processing progress message on 2,000 characters followed immediately by the same short request. Timings start after the native pack reports ready and end when detection returns; they exclude startup pack verification and preview rendering. `firstProcessingMs` includes loading **and the first completed chunk**, so it is not a pure load measurement. The reset comparison approximates the old cancellation recovery path; it is not a baseline active-cancellation measurement.

## Baseline and limits

`baseline.json` was transcribed from the packaged benchmark's accessibility output before cancellation changes. First short detection: 12,674 ms; three warm detections: 649, 649, 635 ms; same short text after terminating its worker: 11,680 ms. All found three items and covered the synthetic address. One main-thread heartbeat delay reached 679 ms during this run.

This is a small local timing sample, with other ordinary desktop apps running. The native build had finished before timing started. It is not a percentile, cross-platform budget, cold filesystem-cache test, or guarantee for arbitrary document lengths. The earlier unmeasured multi-minute GUI delay was not reproduced here and must not be represented as a measured speedup.

`parity.json` replays all 398 existing synthetic records through the changed production adapter on CPU with the pinned native tokenizer. All selected/full predictions match the frozen chosen recipe; fetch attempts remain zero. This is regression evidence, not a new independent quality set. Existing false positives and misses remain unchanged.

The first updated run (`interrupted.json`) completed cold/warm cases, then the web view reloaded during the forced hard-reset load. The saved phase confirmed an interrupted run. Its cause is not established; this is a reliability concern, not a successful recovery test. The final harness removes that forced reset so cooperative cancellation can be measured independently. Repeated hard-reset/load reliability remains open.

## Completed focused run

`updated.json` records a complete packaged run: cold short detection 9,902 ms; warm requests 643, 669 and 676 ms; immediate retry after cancelling a 2,000-character run **1,721 ms**, including the cancellation drain. All short results retain three findings and complete address coverage. The cancellation promise rejected with AbortError and created no result; the subsequent request succeeded. Maximum main-thread heartbeat delay was 615 ms.

Compared with the baseline 11,680 ms reset/reload, this demonstrates avoiding a cold reload in this scenario. The cold-time difference between runs is not attributed to this code change. It is one measured cancellation trial, not a p95 claim.

Validation: 158 application tests, TypeScript checks, all 398 CPU parity records, and the normal optimized macOS app build passed. The normal app was not launched or restarted, preserving existing user sessions.

## Cancellation contract

An explicit **Hủy xử lý** after processing begins rejects the caller immediately, asks the worker to stop at a chunk boundary, and suppresses every late progress/result using a request ID. The next request waits for acknowledgement before reusing the models. Cancelled predictions never create a session. An outstanding native-tokenizer promise is rejected locally on cancellation; any late IPC reply is ignored.

Cancellation during loading, navigation during processing, and unmount still terminate the worker. If cooperative cancellation fails to acknowledge within five seconds, the worker is terminated and a queued retry starts on a fresh worker. No subsequent chunks are scheduled after the worker observes cancellation; an already-running graph operation may finish. Models are retained, not previous source text or predictions. The draft remains in the UI as before.

Unit tests exercise stale replies, queued retry cancellation, runtime failure, timeout fallback, and provider reuse after abort. The packaged benchmark separately exercises real worker cancellation and recovery.

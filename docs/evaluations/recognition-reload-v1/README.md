# Recognition reload and stress checks

Local, synthetic-only checks on Apple M1 Pro, 16 GiB. The same Underthesea INT8 + mSuperClinical INT8 assets, single-thread WASM backend, tokenizer and masking rules are retained. Other ordinary desktop applications remained open. Native builds finish before timed UI runs.

## Reproduction and boundary

Run `mise exec -- node scripts/recognition-reload-v1/build.mjs`, then `mise exec -- pnpm tauri build --bundles app --config artifacts/recognition-reload-v1/tauri.conf.json`. Open **OfflineMask Reload**, click **Run benchmark**. Its separate identity is `dev.offlinemask.recognition.reload20260921`. The developer frontend accepts no user input and persists synthetic timing/count metrics only. It verifies/hard-links existing local pack assets without downloading. Normal app data and sessions are untouched.

The first two recorded versions ran a short cold request followed by three explicit reset/reload cycles. The final harness adds cancellation while loading, three warm cancellations and immediate retries, then 2,000-, 10,000- and 50,000-character documents. It requires exact short-input prediction equality across reset/retry, and complete synthetic address coverage in every successful result. It reports Interrupted on a web-view restart rather than restarting the benchmark automatically.

## Reproduced baseline

`baseline.json`: cold detection 15,829 ms, first reload 17,131 ms, then the web-content process (PID 19777) exited during the second reload. The view restarted and displayed the interrupted phase. This reproduces the earlier failure. The OS termination cause was not obtained, so this is not a proven out-of-memory diagnosis.

`baseline-memory.json` sampled that isolated process's RSS and CPU once per second using `ps`. Sampling ended when the process exited. Peak sampled RSS was 3,141.9 MiB. RSS excludes compressed/swap accounting and is not total physical footprint or a memory budget.

## Explicit release before reloading

`updated.json`: all three reloads completed without a view restart. Cold request: 14,299 ms; reloads: 14,011, 8,285 and 8,353 ms. All returned three findings and full address coverage. Main-thread timer delay peaked at 600 ms.

The worker now aborts/drains its active request, awaits pipeline/session disposal, and acknowledges reset before the next request is sent. It reuses the existing WASM worker rather than allocating a replacement immediately. The engine serializes new preparation behind disposal, including disposal requested while a load is pending. Normal provider errors use this release path too. Fatal worker errors or bounded timeouts still terminate a worker; app shutdown has a separate immediate `destroy` path.

`updated-memory.json` sampled the isolated replacement test process (PID 21321). Peak RSS was **5,188.4 MiB**, higher than the failed baseline's sampled maximum; the process later settled near 1,289 MiB. Do not claim reduced peak memory or infer the baseline's termination reason from these samples. The result supports a more reliable normal reload lifecycle in this trial, not a universal memory-safety guarantee. Low-memory hardware and real fatal-worker recovery still need qualification.

The updated focused trial precedes the small follow-up routing ordinary provider errors through the same release handshake. The subsequent stress build includes that follow-up. No model weights or detection policy changed.

## Completed broader stress run

`stress.json` records the final implementation: three further resets/reloads, cancellation during model loading, three warm cancellations and immediate retries, and all long-document cases passed without a view restart. Every short output exactly matched the initial predictions. Every cancellation rejected with AbortError. Full synthetic address coverage was retained at every length.

Warm cancel/retry: 1.717–1.772 seconds. Cancel during loading/retry: 19.810 seconds, because the aborted load must finish and be disposed before replacement sessions load. This is a reliability tradeoff, not a fast cold-cancel result.

2,000 characters: 8.757 seconds; 10,000: 45.278 seconds; 50,000: **224.585 seconds**. Maximum UI timer delay was 1,366 ms. These are completion/recovery results, **not acceptable-speed claims**, and the synthetic repetitive filler does not represent every document. Long-text speed and lower-memory qualification remain release concerns.

All 166 application tests and TypeScript checks pass. The unchanged model and masking logic retain previous quality limitations; this run is not new independent accuracy evidence.

## First-use UI and build

The separate [fresh-install UI check](first-use.md) passed local-only masking, explicit R2 download, pause at 228 MB, restart without automatic resume, manual resume, installation, restart and full five-category synthetic masking. Original decomposed Unicode was preserved. Normal optimized macOS app build passed; the user's open app was not restarted. A network-denied GUI launch could not be automated and is explicitly inconclusive. Windows/Linux runtime validation remains pending.

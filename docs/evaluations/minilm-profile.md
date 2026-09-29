# Native phase profile: two threads meet the measured processing budgets

The packaged probe now measures native tokenization and inference separately from total round-trip time. **Inference dominates.** A bounded two-thread comparison passes the original warm/long targets without changing the graph, token IDs, window boundaries or source spans. The candidate remains disabled in normal builds and its classifier head remains untrained.

## What the profile established

Each variant processed ten synthetic 2,000-character documents and one 50,000-character document. Variants ran in this fixed order in one isolated macOS app; the comparison is not randomized or a repeated hardware qualification.

| Variant | Warm p95 | 50,000 characters | Encoding calls | Cache hits |
| --- | ---: | ---: | ---: | ---: |
| One thread, uncached control | 592 ms | 9.882 s | 132 | 0 |
| One thread, request-local cache | 459 ms | 9.749 s | 121 | 11 |
| **Two threads, same cache** | **277 ms** | **5.525 s** | 121 | 11 |
| Original target | ≤300 ms | ≤8 s | — | — |

Across the cached one-thread workload, native kernel time totals 12.567 seconds; native tokenization totals only 36.9 ms. Encoding round trips total 298 ms and inference round trips 13.286 seconds. Inference accounts for about 92% of total workload wall time, meeting the predeclared condition for a two-thread comparison. At two threads, kernel time falls to 6.591 seconds. The wall-time residuals include IPC, scheduling and serialization together; they are not isolated serialization measurements.

The cache is bounded to 16 window encodings, keyed by source start/end, and exists only inside the document iterator. It is cleared on completion, early stop or error. It saves repeated encoding of identical source windows; it does not reuse results across documents or exploit the fixture's repeated text. The planner also collects grapheme boundaries without first retaining every segment object. The measured cache improvement is modest; it is not presented as the main performance gain. Full offset arrays still cross IPC for count requests in this prototype. The profile shows that this is secondary to inference here, so a new count-only API was not added just to optimize a small measured cost.

Every measured cached window is compared with the uncached baseline for start/end, all token IDs, raw offsets and masking offsets. Window rebasing and full-source coverage are asserted. Unit tests additionally compare the async planner with the existing shared planner on empty, short, decomposed, emoji and long unbroken inputs, and check cache disposal after early stop.

## Fidelity, cancellation and memory

The original 20 CPU-reference cases pass at one and two threads using the unchanged `atol=1e-4, rtol=1e-4` tolerance. No token or boundary mismatch occurred. The local graph, tokenizer and native library retain their previous hashes.

The new active-ID command lets the probe distinguish active work from a request already completed. This run accepted tokenizer cancellation on its first attempt: **2 ms acknowledgement, 11 ms until completion**. No already-completed attempts occurred. A separate check through the real frontend adapter confirms late-cancel suppression. Native graph cancellation completed in **1 ms** after the run phase was observed, followed by successful recovery. The run-phase marker is just before the runtime call, not kernel instrumentation.

Peak sampled physical footprint across all three variants was **823,856,704 bytes (824 MB / 786 MiB)**, below 1 GiB. Sampling used the same 200 ms conservative app/new-WebKit attribution, which can include unrelated newly created WebKit processes and miss transient peaks. Cold processing was 2.308 seconds; it excludes OS launch and initial page load.

The main executable completed under the same network-deny launch profile using only verified local assets. WebKit XPC helpers have separate sandboxing; no packet capture or system-wide networking change is claimed. No private inputs, correction collection, telemetry or background downloads were added.

## Responsiveness qualification

Interval-based heartbeat measurements still showed roughly one-second gaps in each background-launched variant. The similar gaps under both fast and slow variants suggest a scheduling effect, but this run alone cannot establish the cause. A separate [focused-window follow-up](minilm-focus.md) records focus/visibility and animation-frame timing. Keep these original observations rather than replacing them with more favorable foreground measurements.

## Validation and next boundary

**122 application tests pass.** Normal formatting/Clippy and feature-enabled Clippy pass; the packaged probe completed with all behavioral checks passing. Normal app features and the installed recognition pack remain unchanged. The diagnostic native load command now accepts only one or two threads and drops the previous session before creating a comparison session. Its output includes native kernel timing; the tokenizer response includes native encoding timing. These fields are feature-gated diagnostics, not analytics.

Use the cached two-thread native path as the preferred configuration for the next technical qualification on this machine. This is evidence for runtime feasibility, not selection of a trained privacy detector or a supported-hardware guarantee. Cross-platform behavior, repeated-use memory, cold-load cancellation, trained-model performance and independently reviewed training data remain separate requirements. Do not activate the candidate in the normal UI.

## Reproduction and evidence

The [specification](minilm-profile/spec.md) precedes measurement and [frozen results](minilm-profile/results.json) contain phase totals, per-run metrics, gates, source hashes and preserved historical-source snapshots. The earlier evaluation outputs remain unchanged; intentional changes to the three feature-gated Rust files are matched against before-file hashes. The failed resource measurements remain part of the history.

```sh
mise exec -- node scripts/minilm-profile/build.mjs
mise exec -- pnpm tauri build --features minilm-native-desktop-prototype --config artifacts/minilm-profile/tauri.conf.json --bundles app
mise exec -- python scripts/minilm-profile/run.py
```

The test uses `dev.offlinemask.minilm.profile20260918`, cached model/runtime assets, and a numeric-only report. Python is only the developer launch/memory monitor. Report destinations must be empty or explicitly archived before rerunning. The reporter additionally requires historical snapshots. ONNX Runtime threading APIs were checked with Context7 and the installed ort source; no new dependency was added.

# macOS text runtime investigation — 10 September 2026

## Reference environment

Apple M1 Pro, 16 GiB RAM, macOS 26.6.2 (25G83), arm64. A release Tauri bundle with a separate benchmark identifier uses the production text adapter, worker, pinned two-model pack, and single-threaded ONNX WASM backend. Existing local weights are hard-linked into the isolated app's support directory; there is no download or change to the user's installed pack. Other applications were open. This is a development measurement, not a hardware support certification.

## Initial run: failed

The initial benchmark completed short requests and the 2,000-character case, then its WebContent process terminated during the 10,000-character case. The last observed progress was chunk 8/30. The 50,000-character case did not run. The UI reloaded and lost the original in-memory benchmark report.

Captured partial timing evidence:

| Case | Detection time | Full synthetic address covered |
| --- | ---: | --- |
| Cold short, 161 UTF-16 units | 17,831 ms | Yes |
| Warm short 1 | 868 ms | Yes |
| Warm short 2 | 773 ms | Not captured in full |

Other timings were not recovered and must not be inferred. Cold includes worker/model initialization with warm OS file caches. The first-processing measurement is not pure model load time.

At 17:05:24 local time, macOS WebKit logs explicitly reported `ExceededMemoryLimit`. Its physical footprint was 13,749 MiB after a failed pressure-relief attempt, above an 8,192 MiB threshold. Most memory was compressed (13,127 MiB); resident memory at termination was only 614 MiB. The sampled peak combined RSS of the isolated app and its launch-associated WebKit processes was 3,562,512 KiB. **RSS alone concealed the severity of this failure.** These are different memory metrics, not conflicting measurements.

Ignored diagnostic artifacts: `artifacts/native-benchmark/memory-webcontent-reset.json` and `webcontent-reset.log`. The OS log associates WebContent PID 64846 with benchmark app PID 64833. The replacement WebContent PID was 65467. No private input was used.

## Implemented changes and retests

- Dispose direct inference input and output tensors in `finally`, including failure paths and extra outputs. Predictions retained by the application are plain values. A regression checks cleanup after successful inference, invalid token layout, rejected inference, and invalid logits.
- Yield the worker event loop between chunks, rather than depending on WASM promises to yield to another task.
- Collect grapheme offsets incrementally instead of retaining all segmentation objects before extracting their indices. Source boundaries are unchanged.
- Persist only synthetic benchmark metrics in the isolated harness, render each result separately, and record the current phase before processing and analysis. A terminated run can be distinguished from completion. This storage is absent from the production application and accepts no user input.
- Sample macOS `proc_pid_rusage` physical footprint alongside RSS and stream samples to disk as they arrive. The structure is based on the installed macOS SDK's `rusage_info_v2` definition. Missing footprint readings remain unavailable, rather than zero.

The first cleanup retest completed 10,000 characters in 65,490 ms, but terminated at chunk 1/150 of the 50,000-character request. WebKit again reported `ExceededMemoryLimit` (13,343 MiB after relief; the sampled combined footprint peaked at 13.43 GiB). Tensor cleanup and yielding alone were insufficient. The harness recovered all completed case metrics and the interrupted phase correctly.

A subsequent change segments bounded windows and carries the complete final grapheme into the next window. This retains the context for combining accents, emoji/ZWJ sequences, regional-indicator pairs, CRLF and Indic clusters, while avoiding full-document segmentation on large input. A surrogate pair cannot be cut at a window boundary; a single cluster longer than the window expands the window rather than splitting the cluster. The same helper also protects manual selection on large text. Tests compare the results against whole-input `Intl.Segmenter`, including 50,000 characters and clusters longer than a window.

Bounded segmentation alone was also insufficient: its retest terminated at chunk 9/150 of the 50,000-character case (sampled peak footprint 13.34 GiB). The next change exposes chunk planning as an iterator and yields between tokenizer windows as well as inference windows. This addresses a previously uninterrupted preparation phase, where the memory trace showed a sharp increase. The synchronous wrapper remains available to evaluations and fixtures. The exact WebKit/runtime allocation mechanism has not been isolated; do not describe these observations as proof of an upstream memory leak.

The latest changes passed 59 fast tests, 14 real-model regression cases, 120 real-tokenizer source-offset checks, application/benchmark type-checking, and both isolated and normal release builds. The normal bundle identifier is `dev.offlinemask.desktop`; its frontend excludes model weights and the benchmark entry point.

## Completed desktop sequence

With yielding tokenizer preparation, the same seven-request sequence completed, including all 150 inference windows for 50,000 UTF-16 units. Each result contained three findings and covered the entire synthetic apartment address at the end of the input. This verifies that processing reached the tail; it is not a general detection accuracy estimate.

| Input | Detection time |
| --- | ---: |
| Cold short, 161 units | 12.933 s |
| Warm short, three requests | 0.892 / 0.876 / 0.807 s |
| 2,000 units | 14.774 s |
| 10,000 units | 62.611 s |
| 50,000 units | 400.708 s (6 min 41 s) |

The three warm requests have a median of 0.876 s. Peak sampled combined physical footprint was **7.20 GiB**, falling to **4.52 GiB** near completion. Peak sampled combined RSS was 3,859,136 KiB (3.68 GiB). There were 881 samples during the measured run, on a nominal 500 ms interval plus sampling overhead. The same app/WebKit PIDs (1505, 1520, 1521, 1522) remained throughout. The largest observed 50 ms main-thread heartbeat lateness was **374 ms**; this is an event-loop observation, not an input-latency guarantee.

A separate manual cancellation smoke test during cold model loading returned to Cancelled with Run enabled. No cancellation-latency or memory-recovery claim is made from that interaction. The isolated benchmark was closed afterwards.

One completed sequence establishes that the earlier failure was not reproduced in this test. It does **not** certify stability across inputs, repeated maximum-size runs, machines, or operating systems. Long-request latency and the 7.20 GiB peak remain unacceptable evidence for declaring a lightweight production runtime. The installed model files and category/quality policy are unchanged. See [machine-readable results](2026-09-10-desktop-runtime.json) for exact measurements and source hashes.

## Native CPU reference

An offline Node/ONNX CPU reference ran the same sequence separately, after closing the desktop benchmark and before starting another build. Reproduce with `mise exec -- node scripts/benchmark-text-cpu.mjs`. It uses native CPU defaults rather than the desktop's single WASM thread; it is **not** a controlled backend-only speed comparison or a packaged native implementation.

| Input | CPU reference |
| --- | ---: |
| Cold short | 4.268 s |
| Warm short median (three requests) | 0.053 s |
| 2,000 units | 1.364 s |
| 10,000 units | 8.399 s |
| 50,000 units | 38.167 s |

Every case covered the complete test address. The maximum-length case returned **four findings**, compared with three in WASM. Other cases returned three. No output-equivalence claim is made, and the additional finding has not yet been classified as correct or false positive. The reference records no memory measurement. Default threading, separate execution times and runtime differences prevent interpreting the roughly tenfold long-input timing difference as a guaranteed product speedup.

The next engineering step is a native inference prototype behind the existing detector interface, followed by a span-by-span comparison on the quality corpus, measured memory, cancellation, and fully offline packaged testing. It must preserve the small default installer and optional pack lifecycle. Do not replace the shipped runtime or remove either checkpoint solely on these preliminary timings.

## Scope

Do not promote a smaller checkpoint solely to conceal a runtime failure. The separate quality evaluation still favors the two-checkpoint policy for name coverage. Runtime viability and detection quality must both pass before this pack is considered reliable for release.

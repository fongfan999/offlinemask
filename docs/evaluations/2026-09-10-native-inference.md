# Native inference prototype — 10 September 2026

The prototype runs successfully and matches the existing Node/native CPU baseline, but **is not approved to replace the production WASM detector**. The same models produce different masking decisions across native and WASM execution. At least one native difference loses sensitive-name coverage; other differences add unnecessary masking.

## What was implemented

A feature-gated Rust executable loads the verified local models through `ort` and communicates with a developer adapter over bounded pipes. The adapter plugs into the existing `loadDetector` provider interface, retaining the same tokenizer, source offsets, chunk windows, category policy and alias analysis. Runtime telemetry is explicitly disabled. Cancellation terminates the child, and restart creates a fresh process. The production app still selects its original WASM provider.

The normal release build succeeds and excludes the native prototype, its optional dependencies and ONNX runtime library. No model or runtime downloads, settings changes or user pack modifications were made. See [decision 0009](../decisions/0009-native-inference-prototype.md) for API, dependency and distribution details.

## Comparison method

All three providers processed the same 147 case entries: 66 comparison fixtures, 12 reliability fixtures, 24 address development fixtures, 16 address validation fixtures, 12 final address checks, 13 text regressions and four input-length cases. Some fixtures repeat similar or identical material; these are not 147 independent trials. These are existing synthetic development/regression sets, not fresh held-out validation.

Exact parity compares each final span's UTF-16 start/end, entity type and text value after the shared policy. It does not compare raw logits. Fixture hashes are checked before comparison; all 147 cases completed without processing errors for each provider.

- Rust/native versus Node/native CPU: **147/147 identical**.
- Rust/native versus ONNX WASM: **135/147 identical**, **12 differing cases**.

The automated WASM comparison uses the production-pinned ONNX WebGPU/asyncify distribution under Node. It is not a fresh WebKit measurement. It uses local model bytes and blocks `fetch`; there is no CDN or Hub fallback. Native uses ONNX Runtime 1.24.3 with four intra-op threads; the pinned WASM distribution is 1.26.0-dev.20260416-b7804b056c with one thread. Runtime version, backend implementation and execution configuration all differ. The observations do not isolate floating-point rounding as the cause.

## Differences that matter

| Case | Native relative to WASM | Assessment against fixture |
| --- | --- | --- |
| `address-locality` | Classifies Huế as address rather than name | Better category assignment |
| `mixed-no-diacritics` | Misses “Do” in “Do Thi Kim Ngan” | Coverage regression; both still miss other name material |
| `mixed-multiline-letter` | Also masks “Tôi” | Added false positive |
| `other-org` | Keeps the organization in one finding | Better grouping; covered characters unchanged |
| `other-birth-prose` | Keeps Lục Anh Duy in one finding | Better grouping; both still incompletely mask birth date |
| `negative-dates` | Masks another “26” in an ordinary date | Added false positive |
| `negative-upper` | Avoids masking CẦU and DỊCH | Improvement |
| `fresh-negative-uppercase` | Masks BÁO CÁO | Added false positive |
| `fresh-negative-unicode` | Masks literal `[CLS]` as a phone | Added false positive |
| `validation-nbsp` | Different street/locality spans and categories | Mixed; both fail complete address coverage |
| `uppercase-unknown-token` | Avoids masking CẦU and DỊCH | Improvement; repeats the uppercase failure pattern |
| `runtime-lengths/50000` | Masks one “h” as email near the suffix | Added false positive; confirmed source of the extra finding |

Across the five exhaustively annotated sets, both runtimes fully cover 151/164 entities, but that aggregate conceals partial-coverage and category differences. Native masks 91 ordinary characters versus WASM's 84. In the 66-case set, address-only selection covers 16/17 addresses in native versus 15/17 in WASM. Neither runtime is universally better; matching the CPU baseline is not sufficient adoption evidence.

## Performance and size

On the same M1 Pro / 16 GiB macOS development machine, the initial four-thread native prototype took 37.667 seconds for 50,000 UTF-16 units. The earlier packaged WASM run took 400.708 seconds. This is a direction-finding comparison across separate runs and hosts, not a promised tenfold product speedup. The synthetic address near the end remained covered. Native initialization included model hash verification and took 9.719 seconds; it is not pure inference time.

During the native sequence, sampled peak physical footprint was 3.33 GiB for the parent JavaScript test host and native child combined. The child peak was 3.06 GiB; the parent peak was 1.24 GiB at a different time. Those individual maxima must not be added. The earlier packaged WASM peak was 7.20 GiB. A packaged native UI may have different memory use; this does not establish support for low-memory machines.

The initial prototype executable was 485,360 bytes and its existing development dylib was 35,937,208 bytes (about 34.74 MiB combined, uncompressed). These are component sizes, not installer sizes. The normal app has **no native-runtime payload increase** because the experiment is excluded. A shipping native implementation would need platform-specific runtime packaging and signing; Node is not proposed as a shipped dependency.

## Verification and next gate

59 fast tests, 147-case evaluations, two Rust protocol/unit tests, native cancellation/restart checks, Clippy and the normal macOS release build passed. The final native binary with telemetry explicitly disabled replayed all 147 cases with exactly the same spans as the measured native run. [Machine-readable evidence](2026-09-10-native-inference.json) includes fixture/runtime hashes, differences, timings and the final binary hash. A concurrent test-fixture directory collision was found in existing download tests and fixed with a process-local atomic sequence; all five download-manager tests then passed. The custom logger approach that initially crashed was removed and provider stderr is discarded by the developer adapter.

Before app integration, address the sensitive-name regression and structural false positives using shared, corpus-tested policy or a better validated runtime/model configuration. Evaluate changes on a fresh set rather than tuning only these 12 examples. Then test a packaged native transport, memory, cancellation, crash handling and attempted network activity. No new production backend, smaller model or user-facing model choice is approved by this experiment.

# Production pair integration — 20 September 2026

The shipping adapter matched all **398** recorded selected-pair outcomes, comparing both complete previews and per-category masking. This is a regression/integration replay, not fresh model selection or an independent accuracy benchmark.

- Runtime: production `recognition.ts` with local Transformers.js CPU execution and the shipping Rust `tokenizers 0.22.2` module through a developer stdin harness.
- Models/files: exact published Underthesea INT8 + mSuperClinical INT8 pack hashes.
- Policy: per-model contextual findings, NFC-to-original mapping, then shared rules.
- Ranking population: 386 independent synthetic cases, 500 annotated values. Twelve owner-review cases are overlapping overlays.
- Result: 495/500 own-category values; 467 ordinary lexical positions masked. Zero output differences from the selected recipe and zero attempted fetches. Model quality limitations remain unchanged.
- Source wording is excluded from parity because production identifies the recognition pack rather than evaluation-provider names.

[Results](results.json) contain each case. [Source hashes](protocol.json) identify the integrated implementation. Original frozen evaluation files were not rewritten.

## Desktop smoke checks

An isolated macOS app bundle (`dev.offlinemask.packqa`) used the same shipping commands, worker, models and UI with its own data directory. The existing user app was not closed or its private sessions altered.

- A synthetic decomposed Vietnamese name, CCCD, organization, full street address and email produced five complete masks. The original view retained the decomposed text exactly.
- Turning off one detected name restored just that value in the preview. Copy reported success.
- The reviewed `H’Hen Niê` sentence produced one complete name mask with surrounding prose preserved.
- Cancelling a 6,840-character synthetic document returned to its unchanged draft without creating a session; a subsequent request completed. Reloading the WASM models after cancellation was noticeably slow; cold-start/restart latency needs a dedicated performance check.
- The uppercase negative example produced two incorrect name masks, matching the known CPU/evaluation false positives. This is recorded as a quality limitation, not a successful detection result.
- Restarting cleared all three temporary sessions. Settings recognized the selected pack and showed 1.14 GB installed.

These manual packaged checks exercise WASM and the worker-to-native IPC path. They are separate from the complete 398-case CPU replay; do not describe the entire corpus as tested through the desktop UI.

## Reproduce

```sh
mise exec -- cargo build --manifest-path src-tauri/Cargo.toml --release --features recognition-evaluation --bin recognition-tokenizer-check
mise exec -- node scripts/recognition-production-v1/evaluate.mjs
```

The replay requires the existing pinned local model files and synthetic quality-first artifacts. It refuses to overwrite `results.json`; use a new evidence directory for a new run. The harness is gated behind `recognition-evaluation` and is not included in the normal app build. No public/private user examples are collected.

## OS network-denied replay and build checks

A second complete 398-case CPU/Rust replay ran under macOS `(version 1) (allow default) (deny network*)` and again matched every recorded outcome. See [offline results](offline-results.json). This is an OS-denied production-core replay, not a claim that the entire desktop UI was exercised under that profile: the sandbox-launched UI could not be attached by the native automation tool, so that attempted UI check is inconclusive.

The default macOS app bundle builds successfully. TypeScript checking, all 153 JavaScript tests, 12 native unit tests, formatting and Clippy passed. The two explicit 712 MB pack integration tests remain opt-in and were verified in Decision 0041. No Windows/Linux validation was performed in this change.

```sh
mise exec -- /usr/bin/sandbox-exec -p '(version 1) (allow default) (deny network*)' node scripts/recognition-production-v1/evaluate.mjs docs/evaluations/recognition-production-v1/offline-results.json
```

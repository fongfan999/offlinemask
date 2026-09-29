# Foreground native MiniLM follow-up

The cached two-thread prototype completes its focused macOS run with **205 ms warm p95** and **5.224 seconds for 50,000 characters**. The maximum interval-timer delay is **4 ms**, the maximum animation-frame interval **34 ms**, and no focus or visibility loss was recorded. This resolves the immediate question of whether this workload necessarily causes the earlier one-second UI gaps; none appeared in this focused run. It does not establish the precise cause of the background gaps.

The graph still has an untrained classifier head. These measurements qualify a runtime experiment, not privacy detection or the complete masking feature.

## Results and scope

| Measurement | Focused run |
| --- | ---: |
| Cold tokenizer/graph load and first inference | 2.450 s |
| Ten 2,000-character inputs, warm p95 | 205 ms |
| 50,000-character input, 46 windows | 5.224 s |
| CPU-reference agreement | 20/20 |
| Maximum absolute reference error | 1.4614e-8 |
| Maximum 50 ms timer delay / observations | 4 ms / 192 |
| Maximum animation-frame interval / observations | 34 ms / 541 |
| Focus/visibility losses | 0 |

Same M1 Pro, 16 GiB, macOS 26.6.2; same local graph, tokenizer, library and synthetic input as the [phase profile](minilm-profile.md). The nearest-rank p95 of ten samples is their maximum. Timing covers tokenization, planning, IPC and inference; final entity decoding and shared masking policy are not included. Cold timing excludes OS launch and initial page load. These are measured component budgets, not a complete end-to-end qualification.

The first shell-launched attempt used the network-deny profile but could not be attached to through native UI automation. It waited at the start button and timed out after 600 seconds without processing. Its failed launch and idle memory samples remain preserved and are **not** used as processing evidence.

The successful run was launched normally through native app automation, then started by clicking **Run focused check** in the visible window. It did not use the network-deny launcher and had no memory sampler. The prior profile's 823,856,704-byte sampled peak and network-denied execution are separate evidence, not measurements of this run. No network payloads were needed, and no telemetry or automatic downloads were added. No packet-capture claim is made.

Both timer and animation measurements count only focused/visible observations, and a blur or hidden event disqualifies the focus check. The original 989–1,043 ms background timer gaps remain in the previous report. The difference is consistent with background scheduling, but controlled scheduling attribution has not been performed.

## Reproduction and evidence

The [specification](minilm-focus/spec.md) predates the run. The [frozen result](minilm-focus/results.json) contains numeric observations, source/output fingerprints and the failed launch distinction. Its reporter verifies that the preceding profile's sources and raw evidence remain unchanged and refuses to overwrite results.

```sh
mise exec -- node scripts/minilm-focus/build.mjs
mise exec -- pnpm tauri build --features minilm-native-desktop-prototype --config artifacts/minilm-focus/tauri.conf.json --bundles app
```

Open `src-tauri/target/release/bundle/macos/OfflineMask MiniLM Focus.app` normally, keep it focused and click its start button. The app writes a create-only numeric report to `~/Library/Application Support/dev.offlinemask.minilm.focus20260918/minilm-desktop-report.json` and exits. Archive existing reports explicitly before a new run; never overwrite this evidence. Copy the resulting report to the experiment's ignored artifact directory before running its reporter. The archived `run.py` represents the unsuccessful shell-launch method, not the successful foreground reproduction.

The packaged build passes. The preceding profile also passed all 122 application tests, default native checks and feature-enabled Clippy. This follow-up changes only the isolated probe frontend and evidence tooling. Normal UI and installed recognition pack remain unchanged.

Next: review training-data readiness for the single detector. Repeated-use memory, cold-load cancellation, a named Windows reference and the complete trained masking pipeline remain qualification requirements. A successful synthetic runtime experiment cannot select the final privacy model.

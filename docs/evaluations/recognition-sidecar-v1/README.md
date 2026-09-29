# Isolated native recognition recovery

The opt-in `recognition-native-sidecar` desktop backend runs the same selected pair in a bundled helper process. The host no longer loads ONNX Runtime. Normal builds still use WASM; the previous in-process experiment remains separately available.

The supervisor uses bounded request/reply pipes, generation and request IDs, a 120-second deadline per model load, and a 15-second deadline per inference chunk. Failure destroys and reaps the child; a later explicit retry loads a fresh one. Release/new load can interrupt an active child without waiting on its I/O lock. No automatic document retries, telemetry, downloads, external processing or private-input logs were added. Child stderr is discarded and failures are generic.

The helper monitors stdin on a separate thread and exits when its parent pipe closes, and this was checked with real loading/inference requests outstanding. It verifies the exact release-pack hashes before graph loading, uses four CPU threads and retains the existing token/label semantics. Shared worker policy, original source mapping and preview logic are unchanged.

## Reproduce

```sh
mise exec -- cargo build --manifest-path src-tauri/Cargo.toml --release --features native-inference-prototype --bin recognition-sidecar
mise exec -- node scripts/recognition-sidecar-v1/build.mjs
mise exec -- pnpm tauri build --features recognition-native-sidecar --bundles app --config artifacts/recognition-sidecar-v1/tauri.conf.json
```

The benchmark and full-UI scripts create separate Sidecar QA/UI identities and use verified local pack fixtures. They do not test downloading or change the user's existing application data. The test build bundles the helper and the pinned runtime as local resources; release signing, notices and other operating systems still require qualification.

## Completed benchmark and recovery checks

- **398/398** saved full/category-selected previews matched. This is the existing synthetic regression set, not a new independent accuracy sample.
- After eight seconds of preparation, the short fixture took **1,874 ms** in this run. Cold loading varies; this is not a fixed two-second promise.
- Reloads: **7,468 / 7,518 / 6,615 ms**. Cancellation while loading plus retry: **11,418 ms**. Warm cancel/retry: **115 / 103 / 109 ms**.
- 2,000 / 10,000 / 50,000 characters: **994 / 4,057 / 19,637 ms**. All timed fixtures had three findings and full address coverage. Short outputs matched across reload/cancel cases. Maximum sampled UI timer delay: 30 ms.
- Peak sampled aggregate host + renderer + helper: **2,708,963,328 bytes RSS (2.52 GiB)**; **3,559,265,224 bytes physical footprint (3.31 GiB)**. Peaks may differ in time; 500 ms sampling can miss brief peaks. The helper PID was rediscovered during reloads; six generations were observed. This is still a substantial memory requirement.

The normal text UI then passed deliberate fault injection. SIGSTOP stalled the exact test helper; the configured 15-second chunk deadline removed it, kept the draft unchanged, and showed a retryable error without creating a partial session. Retry produced the expected name mask using a new helper. SIGKILL during a 50,000-character masking request similarly preserved the full draft; retry created the expected three-mask preview. The host PID stayed unchanged, and earlier sessions remained available. See [fault observations](ui-faults.json) and the [prewritten protocol](ui-fault-protocol.md).

Real helper pipe-close checks passed during loading and with an inference request outstanding (968 ms and 124 ms respectively), under OS network denial. The completed desktop GUI benchmark/fault tests used the normal network environment. The earlier full-GUI network-denial limitation remains; do not describe these GUI trials as OS-blocked.

## Shutdown hardening

After the recovery trial, an explicit Tauri `RunEvent::Exit` cleanup was added: close the supervisor, kill/reap its child, and reject new loads. This covers a completely stopped child that cannot run its own pipe watcher. Unit tests exercise release and shutdown against a stalled child and check it has been reaped. The pipe watcher separately protects against loss of the parent connection during ordinary native execution.

The current GUI recovery evidence was captured before this exit-only addition; its binary hash is retained in `ui-faults.json`. The final rebuilt UI is checked separately for quitting with a stopped child. The recognition, request deadline and retry paths were not changed by the exit hook.


The final rebuilt UI passed the stopped-child shutdown check: SIGSTOP was applied to the exact helper, then the app was quit through its menu. Both host and helper disappeared; the original user processes remained alive. [Shutdown evidence](shutdown.json) records the final binary hash. Restart also showed no temporary sessions from the fault trial.

Validation: **167 application tests**, TypeScript checking, **15 native app tests** (two explicit pack-install tests remain opt-in), **two helper tests**, feature-enabled Clippy, default native formatting/Clippy and both packaged macOS builds passed. The default app remains WASM and its running processes were not restarted. Models, masking policy and network behavior are unchanged.

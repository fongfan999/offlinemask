# Packaged native recognition qualification

This is an opt-in macOS test build using the selected Underthesea INT8 + mSuperClinical INT8 pack. Normal builds keep WASM. It adds no model download, update check, telemetry or user-input logging.

The native feature loads a bundled, hash-pinned ONNX Runtime 1.24.3 library. The worker keeps tokenization, chunking, source mapping and masking policy; bounded token IDs and logits cross local Tauri IPC. Graph work runs off the main thread. A mutex serializes load/run/release, and session generations reject stale calls. Cooperative cancellation stops between bounded chunks; an already-running native chunk must return before release. A hung or crashing native runtime is not isolated from the host process in this experiment.

The harness has a separate app identifier, installed-model directory and synthetic-only metrics storage. The user's existing OfflineMask process is not restarted. The benchmark uses the production worker and adapter, eight seconds of background preparation, reload/cancel/retry exercises, the same length fixtures, and complete/category-selected preview parity against the 398 saved native CPU outcomes.

## Reproduce

Existing verified local model assets and frozen synthetic results are required. The script hardlinks model fixtures into the isolated application profile; this does not test downloading or installation.

```sh
mise exec -- node scripts/recognition-native-desktop-v1/build.mjs
mise exec -- pnpm tauri build --features recognition-native-desktop --bundles app --config artifacts/recognition-native-desktop-v1/tauri.conf.json
```

Open `src-tauri/target/release/bundle/macos/OfflineMask Native QA.app` and run the synthetic benchmark. The bundle adds the development runtime through Tauri's resource mapping. Developer signing/runtime provenance is not a signed/notarized distribution qualification. Windows and Linux are not tested here.

## Packaged benchmark result

The macOS benchmark completed without a worker/WebContent restart and matched **398/398** saved complete and category-selected previews. These remain the same synthetic cases; this does not increase the independent accuracy sample.

| Exercise | Measured time |
| --- | ---: |
| Short input after eight seconds of preparation | 256 ms |
| Three explicit reloads | 6,228 / 5,848 / 6,262 ms |
| Cancel while loading, then retry | 12,405 ms |
| Three warm cancel/retries | 103 / 101 / 99 ms |
| 2,000 characters | 775 ms |
| 10,000 characters | 3,713 ms |
| 50,000 characters | 18,777 ms |

The same long fixture took 224,585 ms in the previous packaged WASM run (about 12× slower). This is one Mac comparison, four native threads versus one WASM thread, not a cross-device guarantee. Each timed fixture had three findings and complete address coverage. Every short result matched the first byte-for-byte across reloads/cancellations. Maximum observed main-thread timer delay was 8 ms.

Sampled host plus WebContent peaks: **2,577,825,792 bytes RSS (2.40 GiB)** and **3,454,997,232 bytes physical footprint (3.22 GiB)**. These peaks need not occur simultaneously. Sampling was every 500 ms and can miss brief peaks. Footprint includes compressed memory; native inference still has a substantial memory cost. The sampler identifies the host by its isolated bundle executable and the sole new WebContent PID observed at launch; network/GPU helpers are not included.

[Metrics](results.json) were transcribed from the completed app accessibility report; [memory samples](memory.json) are recorded by the local process sampler. The normal app's processes were left running untouched.

## Offline validation boundary

The prior native developer replay passed with OS network denial. For this GUI build, an outbound-IP-denied launch was attempted using `(version 1) (allow default) (deny network-outbound (remote ip "*:*"))`. A separate connection probe returned `EPERM`, but the directly launched GUI process had no attachable running-app window. It was terminated by its exact test PID. This attempt is **inconclusive**, not a passing offline GUI test. The completed packaged benchmark ran with the normal network environment; no update check or download was requested, and processing remains restricted to verified local assets by code and CSP.

## Normal application UI smoke checks

A second isolated bundle (`OfflineMask Native UI`, identifier `dev.offlinemask.recognition.nativeui20260921`) uses the normal Vue application and native feature/provider. Build with `scripts/recognition-native-desktop-v1/build-ui.mjs`, then the same Tauri command with `artifacts/recognition-native-desktop-v1/ui.tauri.conf.json`.

- Entered the 170-UTF16-character synthetic fixture used in prior production validation: decomposed `Nguyễn Ngọc Hà`, CCCD, organization, full address and email. The preview contained exactly five masks.
- Original-text accessibility value matched the full original fixture, including decomposed accents.
- Unchecking only the name restored that original value and left the other four masks intact.
- A second session with `Khách hàng H’Hen Niê đề nghị cập nhật thông tin liên hệ.` masked the complete name and preserved the surrounding sentence.
- Quit/reopen displayed no temporary sessions. Test bundles were closed afterward. The original user application was not closed or restarted.

167 application tests and TypeScript checks passed. Native feature tests: 13 passed, two explicit pack-install integration tests remained ignored. Feature-enabled Clippy and default formatting/Clippy passed. Packaged native benchmark and regular-UI builds succeeded.

The native host crash/hang boundary is still open: worker cancellation is cooperative between chunks; terminating a worker cannot terminate a stuck in-process native graph. Keep this backend opt-in pending recovery and distribution qualification.

The final normal/default macOS bundle also rebuilt successfully in 2m 11s with WASM still selected. It was not launched; existing user processes remained untouched.

# 0077 — Native recognition for Windows x64, and a native dev mode

Date: 13 October 2026. Status: requested by the owner, who chose the native runtime over further WASM tuning ("go with A, my users are likely using windows") after a 1 058-row statement took about three minutes to mask in `tauri dev`. This extends [0049](0049-native-release-packaging.md), which made native recognition the macOS arm64 release default on 29 September; the owner's earlier "WASM stays the default" direction now applies only until each platform passes its own checks.

## Why

`tauri dev` and every non-macOS build run the two-model pack in single-thread ONNX Runtime WASM. Measured on this M1 Pro with the installed pack and invented, uppercase bank-note text (12 013 characters, the app's own 384-token windows):

| Engine | Threads | Underthesea | Multilingual | Total | Per character |
| --- | --- | --- | --- | --- | --- |
| WASM (from [0046](0046-selected-pair-native-runtime.md): 50 000 characters in 224.6 s) | 1 | | | ≈ 54 s | ≈ 4.5 ms |
| Native helper (`recognition-sidecar`) | 1 | 5.1 s | 6.3 s | 11.4 s | ≈ 0.95 ms |
| Native helper | 2 | 3.3 s | 6.0 s | 9.3 s | ≈ 0.77 ms |
| Native helper | 4 (the app's setting) | 1.5 s | 2.7 s | 4.2 s | ≈ 0.35 ms |

Model loading took 6–8 s once per session. The owner's statement sends about 27 000 characters to the models after [0076](0076-spreadsheet-files.md)'s reductions: about 2 minutes on WASM, about 10 s native on this Mac. Weaker 2–4-core Windows laptops are expected to be several times slower than this Mac with either engine, which is why the native engine matters most there. These are single-machine measurements, not guarantees.

## Decision

- **Pinned runtime per target.** `scripts/native-runtimes.json` and `src-tauri/src/native_runtime.rs` pin ONNX Runtime 1.24.3 from the lockfile-resolved `onnxruntime-node` package: `libonnxruntime.1.24.3.dylib` for macOS arm64 (unchanged) and `onnxruntime.dll` for Windows x64 (23 850 016 bytes, SHA-256 `4bc16811…2a84`, Microsoft-signed). The Windows DLL delay-loads DirectML, d3d12 and dxgi, which the CPU provider never touches, and imports the Visual C++ C++ runtime.
- **Windows packaging.** `scripts/prepare-native-desktop.mjs` now handles Windows: it copies `onnxruntime.dll`, the app-local Visual C++ runtime (`msvcp140.dll`, `msvcp140_1.dll`, `vcruntime140.dll`, `vcruntime140_1.dll`) from the build machine's Visual Studio redistributable folder, and `recognition-sidecar.exe`. Rust binaries link the C runtime statically on Windows (`.cargo/config.toml`, as Tauri's distribution guide suggests), so the app and helper start without the Visual C++ Redistributable.
- **Windows integrity.** macOS checks the sealed bundle with `codesign`; Windows has no offline equivalent for unsigned resources. `scripts/build-native-desktop.mjs` passes the SHA-256 of every shipped native file to the release build (`OFFLINEMASK_NATIVE_SHA256`), and the app refuses to start the helper if any file differs. The helper starts with `CREATE_NO_WINDOW`, so no console window appears.
- **Verification.** `scripts/verify-native-desktop.mjs` checks, on Windows, the shipped hashes, the licence notices, the absence of model weights, and the PE import tables: the runtime and helper may import only Windows system DLLs and the bundled C++ runtime. `scripts/smoke-native-helper.mjs` starts the packaged helper and requires a protocol reply, which proves the runtime (and on Windows its C++ runtime) loaded on that machine; a fake runtime makes it fail. Every native release build now runs both.
- **CI.** `.github/workflows/windows-native.yml` builds the Windows native package on `windows-latest`, runs the Rust tests with the native feature, the verifier and the smoke test, and uploads the NSIS and MSI installers with their provenance.
- **Default stays evidence-based.** `pnpm desktop:build` keeps native as the default on macOS arm64 only. Windows x64 is built with `pnpm desktop:build:native` and becomes the default after the checklist below passes on a Windows PC. The native frontend omits the WASM runtime, so a Windows build that fails to load the helper cannot fall back; this is why the default waits for evidence.
- **Native dev mode.** `pnpm desktop:dev:native` runs `tauri dev` with the opt-in sidecar feature, the pinned runtime and a release-profile helper, so development runs at release speed. Plain `pnpm desktop:dev` is unchanged.

## Windows qualification checklist

On a Windows 10 or 11 x64 PC (ideally a modest 4-core laptop) with the CI installer:

1. Install with the NSIS installer; the app opens with no console window.
2. Download the recognition pack in Settings; it reaches "Sẵn sàng".
3. Mask the sample text and a real-size spreadsheet; record the time and compare with the same file on the WASM build.
4. Cancel during masking, then mask again.
5. Disconnect the network, restart the app, and mask again.
6. Replace `native\onnxruntime.dll` in the install folder with any other file: masking must refuse with the recognition error, the draft must stay, and restoring the file must make masking work again.
7. Check memory in Task Manager during masking.

When these pass, add `win32-x64` to the native list in `scripts/build-desktop.mjs` and record the results in an evaluation.

## Verified here

`pnpm lint`, `pnpm typecheck`, `pnpm test` (222), `cargo fmt --check`, Clippy with `-D warnings` for the default, sidecar and release features, and the Rust tests with the sidecar feature passed. On this Mac, `pnpm desktop:build:native` ran end to end with the reworked scripts: build, ad hoc signing, bundle-seal and dependency verification (no model weights, 49.7 MB of resources), and the smoke test started the helper inside the signed app and got its reply. The smoke test fails as expected against a fake runtime file. The Windows DLL's import table was read with the verifier's own parser and passes its allowlist.

## Not verified here

The Windows code paths were not compiled or run on this Mac: cross-checking needs the Windows C toolchain for dependencies such as `ring`. The first Windows compile, verifier and smoke run happen in the CI job. Code signing for Windows (Authenticode) and the redistribution notice for the Visual C++ runtime files under the Visual Studio licence are open items for public releases. Context7 was not available in this session; Tauri's static-CRT advice and resource handling were applied from its distribution guide as used in 0049.

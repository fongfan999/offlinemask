# 0107 — The recognition helper is its own crate

Date: 20 October 2026. Status: requested by the owner after the warm-cache measurements in [0104](0104-faster-release-builds.md) ("fix the Windows dead-code warnings and compile the library once for the helper and the app").

## Problem

A warm native release job spent its time in two Cargo release builds of the same package: 1.7 minutes for `recognition-sidecar` and 3.3 for the app on Windows. The helper was a `[[bin]]` of the app package behind the `native-inference-prototype` feature, so building it compiled the whole app library first, and the app build then compiled that library again with its own feature set. The helper itself uses only `ort`, `serde`, `serde_json` and `sha2`; it never linked the library it paid for.

Separately, three items in `background.rs` (`SERVICE_EVENT`, `ServiceRequest`, `ServiceFiles::offer`) exist for the macOS Services ([0094](0094-macos-services.md)) and are dead code on Windows and Linux. CI runs Clippy only on macOS, so the warnings in the Windows build log would have failed `check:native` for a Windows contributor.

## Decisions

- **`desktop/src-tauri/recognition-sidecar/` is a package of its own**, with the four dependencies above pinned as before (`ort` `=2.0.0-rc.10`, `load-dynamic`, no default features) and the source moved unchanged from `src/bin/recognition_sidecar.rs` to `src/main.rs`. `src-tauri/Cargo.toml` becomes a Cargo workspace rooted at the app package, with `members = ["recognition-sidecar"]`, one `Cargo.lock`, one `target/` and the same release profile. The helper's `[[bin]]` entry and its `required-features` leave the app package; the prototype binaries stay as they were.
- **One version, declared once.** `[workspace.package] version = "2.0.0"` with `version.workspace = true` in both packages; the release workflow's check still reads the single `version = "…"` line in `src-tauri/Cargo.toml` ([0102](0102-first-release-is-2-0-0.md)).
- **Build scripts build the package, not the feature.** `prepare-native-desktop.mjs` and `dev-native-desktop.mjs` run `cargo build --locked --release --package recognition-sidecar`; the output path, the staging, the hashes, the verifier and the smoke test are unchanged. The Windows compiled-in hash check in the app ([0077](0077-native-recognition-windows.md)) is untouched: the app library still reads `OFFLINEMASK_NATIVE_SHA256` at compile time, and it is now compiled exactly once per release build.
- **`check:native` and `test:native` cover the workspace** (`cargo fmt --all`, `cargo clippy --workspace --all-targets -D warnings`, `cargo test --workspace`). The helper had never been linted in CI because its feature gate kept it out of `--all-targets`; it passes Clippy as it is.
- **The Services items carry `#[cfg_attr(not(target_os = "macos"), allow(dead_code))]`**, which names the platform that uses them instead of silencing the lint everywhere.

## Checked

Locally on macOS arm64: `pnpm -C desktop check:native` (rustfmt and Clippy over both packages, the helper included for the first time), `pnpm -C desktop test:native`, `cargo metadata --locked` after the lockfile gained the member, and `pnpm -C desktop desktop:build:native`: the helper compiled in 13 s on its own, the app once in 2 min 23 s, the verifier passed and the packaged helper loaded the runtime in the smoke test; the dmg is 18.9 MB as before. The CI numbers for the native jobs are recorded with the next dry run of the release workflow.

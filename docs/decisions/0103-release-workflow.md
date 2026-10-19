# 0103 — Release builds for macOS (Apple Silicon, Intel), Windows and Linux on a tag

Date: 19 October 2026. Status: requested by the owner ("set up a CI that will auto build Windows, MAC (Silicon and Intel) and Linux when release a version").

## Decision

- **One workflow, `.github/workflows/release.yml`, on tags `v*`** (and "Run workflow" on an existing tag). A first job refuses to build unless the tag equals the version in `package.json`, `tauri.conf.json` and `Cargo.toml`, so a release can never carry a number its manifests do not ([0102](0102-first-release-is-2-0-0.md)).
- **Four runners, the project's own build commands.** `macos-latest` and `windows-latest` run `desktop:build:native`, the verified and smoke-tested native path ([0049](0049-native-release-packaging.md), [0077](0077-native-recognition-windows.md)); `macos-15-intel` and `ubuntu-22.04` run `desktop:build`, the plain Tauri build with WASM recognition, because no native ONNX Runtime is pinned for those targets in `scripts/native-runtimes.json`. Runner labels follow the current [runner-images](https://github.com/actions/runner-images) list; Ubuntu 22.04 keeps the Linux bundles' glibc floor low, as the [Tauri pipeline guide](https://v2.tauri.app/distribute/pipelines/github/) recommends.
- **The publish job attaches, it does not decide.** Bundles and per-platform provenance go to the GitHub release for the tag with a `SHA256SUMS.txt`. A missing release is created as a draft with the matching `CHANGELOG.md` section as notes; the owner publishes it. An existing release gets the files added. The build jobs have read-only tokens; only the publish job may write.
- **Signing is opt-in through secrets.** Without them macOS apps are signed ad hoc, which the Tauri guide recommends so Apple Silicon does not call them damaged. With `APPLE_CERTIFICATE` and friends the certificate is imported into a temporary keychain first, since `prepare-native-desktop.mjs` signs the helper before the Tauri CLI runs, and the CLI notarizes. Secrets are exported only when set, never as empty strings. Details in [docs/release/github-actions.md](../release/github-actions.md).
- **Windows ships the native build.** [0077](0077-native-recognition-windows.md) made native the Windows default only after a manual checklist. The release workflow ships the native package anyway, because the alternative is a WASM build about 13× slower for the owner's main audience, and the package is the same one the `Windows native build` workflow has verified and smoke-tested on every push. The checklist now runs against a release artifact; until it passes, the README keeps saying Windows is unqualified.

## Not done

Windows code signing; Linux arm64 and Windows arm64 runners (no evidence the app runs there); automatic publishing of the draft; an updater (the app has none by design, [SECURITY.md](../../SECURITY.md)); `pnpm test:models` in the pipeline (it needs the 1.1 GB pack).

## Checked

`prettier --check` on the workflow, a YAML parse, and `bash -n` on each of its eight shell steps; the changelog extraction and the version comparison run against the repository as it is. The workflow itself was verified by dispatching it twice for `v2.0.0` on 19 October 2026:

- [Run 39286548372](https://github.com/fongfan999/offlinemask/actions/runs/39286548372): macOS arm64 (16.0 min), Windows x64 (12.5 min) and Linux x64 (6.6 min) built with cold caches; the Intel job failed in mise, which resolves pnpm from the aqua registry and finds no macOS x64 binary for pnpm 11. The attach job was skipped, as designed when any build fails.
- [Run 39287812900](https://github.com/fongfan999/offlinemask/actions/runs/39287812900), after the Intel runner was switched to installing pnpm through npm: all four built (Linux 12.1, macOS arm64 14.3, Windows 11.2, macOS Intel 15.1 min) and the publish job attached ten files to the existing release: `OfflineMask_2.0.0_aarch64.dmg` (18.5 MB), `OfflineMask_2.0.0_x64.dmg` (9.5 MB), `OfflineMask_2.0.0_x64-setup.exe` (9.4 MB), `OfflineMask_2.0.0_x64_en-US.msi` (13.3 MB), `OfflineMask_2.0.0_amd64.deb` and `OfflineMask-2.0.0-1.x86_64.rpm` (10.2 MB each), `OfflineMask_2.0.0_amd64.AppImage` (84.9 MB), the two provenance files and `SHA256SUMS.txt`.

Nearly all of each native job is the Rust release link: the profile uses fat LTO with one codegen unit, and the helper and the app are linked separately. The Rust cache restored on Windows (the build step went from 11.1 to 9.9 min) but not on Linux, whose key changed between the runs; the action hashes every rustc on the runner, including the image's preinstalled one. Speed-ups (thin LTO, a lockfile-only cache key, fewer Linux bundle formats) are a separate decision.

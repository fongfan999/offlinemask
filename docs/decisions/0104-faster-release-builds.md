# 0104 — Faster release builds: thin LTO, a stable cache key, no AppImage

Date: 20 October 2026. Status: cache key revised in [0124](0124-release-cache-across-tags.md); requested by the owner after the first runs of the release workflow ("well, quite long and heavy"; then "apply thin LTO, the lockfile-only cache key and drop the AppImage, record the decision, and rebuild to measure").

## Problem

The two runs recorded in [0103](0103-release-workflow.md) took 11 to 16 minutes per platform, nearly all of it in the Rust release link: `[profile.release]` used fat LTO with one codegen unit, from Tauri's size guide, and the native jobs link twice (helper, app). The Rust cache helped little where it restored (Windows, 11.1 to 9.9 min) and did not restore at all on Linux, because the cache action's key hashes every rustc on the runner, including the image's preinstalled one, which drifts between runs. The Linux AppImage was 85 MB against 10 MB for the deb and rpm, for a platform nobody has run the app on.

## Decisions

- **Thin LTO, default codegen units.** `lto = "thin"` and no `codegen-units` line in `src-tauri/Cargo.toml`; `opt-level = 3`, `panic = "abort"` and `strip = true` stay. Thin LTO keeps most of fat LTO's cross-crate optimisation while linking in parallel; the cost is a somewhat larger binary, measured below. The same profile applies to every platform and to local `desktop:build`, so what the owner builds by hand is what CI ships.
- **Cache key from the pinned inputs only.** `swatinem/rust-cache` now gets `key: release-<platform>-<hash of mise.toml, Cargo.lock, Cargo.toml, .cargo/config.toml>` with `add-job-id-key` and `add-rust-environment-hash-key` off. The key changes when the toolchain pin or the dependency graph changes and at no other time; Cargo's own fingerprints handle anything else.
- **Linux ships deb and rpm.** The Linux job runs `desktop:build --bundles deb,rpm`. The AppImage returns when someone has run OfflineMask on Linux and asks for it; until then it is 85 MB of untested download per release.
- **A dry run builds without attaching.** "Run workflow" without a tag builds the chosen branch and keeps the bundles as run artifacts; the publish job is skipped. This is how the change above was measured without moving the published `v2.0.0` tag, and how a contributor can try the pipeline.

## Measured

Build step of each job in minutes, same source (v2.0.0), from [run 39287812900](https://github.com/fongfan999/offlinemask/actions/runs/39287812900) (fat LTO, cold), the first dry run [39292520677](https://github.com/fongfan999/offlinemask/actions/runs/39292520677) (thin LTO, cold: the new cache key had nothing to restore yet) and the second dry run [39295314812](https://github.com/fongfan999/offlinemask/actions/runs/39295314812) (thin LTO, warm cache):

| Platform | Fat LTO, cold | Thin LTO, cold | Thin LTO, warm |
| --- | --- | --- | --- |
| Linux x64 | 10.8 | 7.0 | 2.2 |
| macOS Intel | 12.6 | 13.9 | 4.9 |
| Windows x64 | 9.9 | 14.0 | 7.2 |
| macOS arm64 | 13.2 | 11.3 | 8.8 |

The cache key was the lever: cold runs differ by runner noise more than by the LTO mode, warm runs are two to five times faster, and every release after the first is warm unless `mise.toml` or the Cargo manifests change. Thin LTO made the bundles 4 to 7 % larger (deb 10.2 to 10.9 MB, arm64 dmg 18.5 to 18.9 MB, msi 13.3 to 13.6 MB, Intel dmg 9.5 to 9.9 MB) and is kept for the parallel link on cold runs. Of the warm Windows step, 0.6 minutes were the typecheck, 1.7 the helper build, 3.3 the app build and 0.6 the installers, verifier and smoke test; the two Rust builds are addressed in [0107](0107-helper-crate.md).

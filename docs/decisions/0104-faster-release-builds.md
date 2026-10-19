# 0104 — Faster release builds: thin LTO, a stable cache key, no AppImage

Date: 20 October 2026. Status: requested by the owner after the first runs of the release workflow ("well, quite long and heavy"; then "apply thin LTO, the lockfile-only cache key and drop the AppImage, record the decision, and rebuild to measure").

## Problem

The two runs recorded in [0103](0103-release-workflow.md) took 11 to 16 minutes per platform, nearly all of it in the Rust release link: `[profile.release]` used fat LTO with one codegen unit, from Tauri's size guide, and the native jobs link twice (helper, app). The Rust cache helped little where it restored (Windows, 11.1 to 9.9 min) and did not restore at all on Linux, because the cache action's key hashes every rustc on the runner, including the image's preinstalled one, which drifts between runs. The Linux AppImage was 85 MB against 10 MB for the deb and rpm, for a platform nobody has run the app on.

## Decisions

- **Thin LTO, default codegen units.** `lto = "thin"` and no `codegen-units` line in `src-tauri/Cargo.toml`; `opt-level = 3`, `panic = "abort"` and `strip = true` stay. Thin LTO keeps most of fat LTO's cross-crate optimisation while linking in parallel; the cost is a somewhat larger binary, measured below. The same profile applies to every platform and to local `desktop:build`, so what the owner builds by hand is what CI ships.
- **Cache key from the pinned inputs only.** `swatinem/rust-cache` now gets `key: release-<platform>-<hash of mise.toml, Cargo.lock, Cargo.toml, .cargo/config.toml>` with `add-job-id-key` and `add-rust-environment-hash-key` off. The key changes when the toolchain pin or the dependency graph changes and at no other time; Cargo's own fingerprints handle anything else.
- **Linux ships deb and rpm.** The Linux job runs `desktop:build --bundles deb,rpm`. The AppImage returns when someone has run OfflineMask on Linux and asks for it; until then it is 85 MB of untested download per release.
- **A dry run builds without attaching.** "Run workflow" without a tag builds the chosen branch and keeps the bundles as run artifacts; the publish job is skipped. This is how the change above was measured without moving the published `v2.0.0` tag, and how a contributor can try the pipeline.

## Measured

Recorded below from the dry run on `main` after this change, against run 39287812900 (fat LTO, v2.0.0).

# 0124 — Release cache shared across tags

Date: 23 October 2026. Status: requested by the owner after the v2.0.3 release ("github actions for building apps is slow, is that normal?").

## Problem

[0104](0104-faster-release-builds.md) measured a warm Rust cache at two to five times faster and expected every release after the first to be warm. None has been. [Run 39800369709](https://github.com/fongfan999/offlinemask/actions/runs/39800369709) (v2.0.3) logged `No cache found` on all four platforms and spent 6.5 (Linux) to 17 (macOS Intel) minutes compiling every dependency. Two causes, both missed by 0104's dry runs, which ran twice on the same branch:

- **The key changed with every release.** It hashed `Cargo.toml` and `Cargo.lock`, and both change when the version is bumped (the `offlinemask` package's own version line).
- **Tag caches are invisible to other tags.** GitHub scopes a cache to the ref that saved it; a run for `v2.0.3` can restore its own caches and the default branch's, never `v2.0.2`'s. Each release saved about 2.4 GB of tag caches (four platforms, 550 to 670 MB each) that nothing could read, pushing useful entries towards the 10 GB eviction limit.

## Decisions

- **Key from the toolchain pin only.** `key: release-<platform>-<hash of mise.toml, .cargo/config.toml>`. `swatinem/rust-cache` appends its own hash of the Cargo manifests and lockfile, and on a miss restores the newest cache that matches the key without that hash ([config.ts](https://github.com/Swatinem/rust-cache/blob/v2/src/config.ts), `restoreKey`). A version bump or a dependency update now restores the previous build and Cargo's fingerprints recompile only what changed.
- **Only main saves.** `save-if: github.ref == 'refs/heads/main'`. Tag runs restore main's cache and save nothing.
- **A dry run of main twice a week.** `schedule: 0 3 * * 1,4` (Monday and Thursday) runs the workflow without a tag, which builds and keeps the bundles as run artifacts and attaches nothing (0104). It refreshes main's cache after dependency changes and keeps it inside GitHub's seven-day eviction window between releases. The repository is public, so the runner minutes cost nothing. "Run workflow" on main does the same by hand, for example right before tagging after a dependency update.

## Expected

The warm column of 0104 for every release once main has a cache: 2 to 9 minutes per platform instead of 6.5 to 18. The first tag after this change is warm only if a dry run of main has finished since; the last main caches date from 20 October and will have been evicted. The final compile and link of the app crate itself (about 5.5 minutes on macOS Intel) happens on every release regardless.

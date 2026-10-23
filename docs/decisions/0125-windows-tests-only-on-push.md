# 0125 — Windows push builds run the tests only

Date: 23 October 2026. Status: requested by the owner ("I guess we only need to build by a release rather than always when a file changes?"; then "ok" to the proposal below).

## Problem

`windows-native.yml` ([0077](0077-native-recognition-windows.md)) ran on every push to main that touched the native layer, its scripts, the desktop package or the lockfile. Each run took 14 to 17 minutes: 4.5 for `cargo test` with the native feature, then 12 for a full `desktop:build:native` (installers, bundled-file verifier, helper smoke test) and an upload of the installers. It ran five times on 22 October alone. Nothing consumes those installers: since [0103](0103-release-workflow.md) the release workflow builds, verifies and smoke-tests the same Windows package on every tag, and since [0117](0117-microsoft-store-msix.md) also installs and certifies the MSIX.

## Decisions

- **On push, Windows runs the Rust tests only.** The workflow, renamed "Desktop: Windows tests", keeps `cargo test --features recognition-native-sidecar` on `windows-latest`, because Windows-only defects (such as those fixed in 2.0.3, [0121](0121-windows-pack-path-and-window-order.md) and [0122](0122-windows-popover-own-window.md)) should fail the push, not the release. The packaging step and the installer upload are gone.
- **Narrower watch paths.** It runs on changes to `desktop/src-tauri/`, `desktop/.cargo/`, the toolchain pin, `.gitattributes`, `docs/licenses/` and the workflow itself. The packaging scripts and the desktop package are no longer watched, since this job no longer runs them.
- **A Rust cache for the tests.** `swatinem/rust-cache` keyed like the release cache ([0124](0124-release-cache-across-tags.md)): the toolchain pin, plus the action's lockfile hash with a prefix fallback. The job only runs on main, so main's cache is the one it saves and restores.
- **Installers on demand.** To try a Windows installer before tagging, run the release workflow on main without a tag ("Run workflow"); the dry run keeps the installers and the MSIX as run artifacts.

## Consequence

A change to the Windows packaging scripts (`prepare-native-desktop.mjs`, `verify-native-desktop.mjs`, `smoke-native-helper.mjs`, `build-msix.mjs`) is first exercised by a release run. Run a dry run of the release workflow after changing one of them, before tagging.

# Release builds on GitHub Actions

[`.github/workflows/release.yml`](../../.github/workflows/release.yml) builds the desktop app for every supported platform and attaches the bundles to the GitHub release for a tag ([Decision 0103](../decisions/0103-release-workflow.md)).

## How to release

1. Bump the version in `desktop/package.json`, `desktop/src-tauri/tauri.conf.json` and `desktop/src-tauri/Cargo.toml` (run `cargo metadata --locked` in `desktop/` so `Cargo.lock` follows), add the section to `CHANGELOG.md`, commit.
2. Tag and push:

```sh
git tag -a v2.1.0 -m "OfflineMask 2.1.0" && git push origin main v2.1.0
```

3. The workflow checks that the tag equals the version, builds on four runners, and attaches the files to the release for that tag. If no release exists it creates a **draft** with the changelog section as notes; publish it after looking at the files. If the release already exists (as for 2.0.0), the files are added to it.

To build or rebuild an existing tag, open Actions › Release › Run workflow on `main` and enter the tag name; the workflow as it is on `main` checks out that tag. Leave the tag empty for a **dry run**: the chosen branch is built, the bundles stay as run artifacts for 90 days, and nothing is attached to any release. From the command line:

```sh
gh workflow run release.yml --ref main -f tag=v2.0.0
```

```sh
gh workflow run release.yml --ref main
```

## What each runner produces

| Runner | Command | Recognition | Files |
| --- | --- | --- | --- |
| `macos-latest` (Apple Silicon) | `pnpm -C desktop desktop:build:native` | Native helper, verified and smoke-tested ([0049](../decisions/0049-native-release-packaging.md)) | `OfflineMask_<v>_aarch64.dmg`, `provenance-macos-arm64.json` |
| `macos-15-intel` | `pnpm -C desktop desktop:build` | WASM (no native runtime is pinned for x86_64) | `OfflineMask_<v>_x64.dmg` |
| `windows-latest` | `pnpm -C desktop desktop:build:native` | Native helper, verified and smoke-tested ([0077](../decisions/0077-native-recognition-windows.md)) | `OfflineMask_<v>_x64-setup.exe`, `OfflineMask_<v>_x64_en-US.msi`, `provenance-windows-x64.json` |
| `ubuntu-22.04` | `pnpm -C desktop desktop:build --bundles deb,rpm` | WASM | `.deb`, `.rpm` (no AppImage until Linux has been tried, [0104](../decisions/0104-faster-release-builds.md)) |

The publish job adds `SHA256SUMS.txt` over every attached file. Each platform keeps a Rust build cache keyed on `mise.toml`, the Cargo manifests and `.cargo/config.toml`; the release profile uses thin LTO so the link runs in parallel ([0104](../decisions/0104-faster-release-builds.md)). With a warm cache a release takes about 2 (Linux) to 9 (macOS arm64) minutes per platform, all in parallel. The native helper is its own crate in the `src-tauri` Cargo workspace, so a native job compiles the app library once ([0107](../decisions/0107-helper-crate.md)). Ubuntu 22.04 is used on purpose: the bundles link against its glibc and WebKitGTK, so they run on distributions at least that old.

## Signing

Without secrets the macOS apps are signed ad hoc (so Apple Silicon does not report them as damaged) and Gatekeeper asks the user to allow them once; Windows installers are unsigned. These are the limits recorded in [macos-arm64.md](macos-arm64.md).

With these repository secrets the macOS builds are signed with Developer ID and notarized by the Tauri CLI, following the [Tauri macOS signing guide](https://v2.tauri.app/distribute/sign/macos/):

| Secret | Content |
| --- | --- |
| `APPLE_CERTIFICATE` | The Developer ID Application `.p12`, base64 (`openssl base64 -A -in certificate.p12`) |
| `APPLE_CERTIFICATE_PASSWORD` | Its export password |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: Name (TEAMID)` |
| `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` | Notarization with an Apple ID and an app-specific password |
| `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_CONTENT` | Or notarization with an App Store Connect key; the content is written to a file and passed as `APPLE_API_KEY_PATH` |

The workflow imports the certificate into a temporary keychain before building, because the native build signs the recognition helper itself before the Tauri CLI runs. Only variables that are set are exported, so an unset secret never reaches the build as an empty string. Windows code signing is not configured.

## What the workflow does not prove

A green run shows that each platform builds and, on macOS arm64 and Windows, that the packaged helper loads its runtime. It is not a test of the app: only macOS Apple Silicon has been used by hand, Windows awaits the checklist in Decision 0077, and the Intel and Linux builds have never been launched. The README states this per release.

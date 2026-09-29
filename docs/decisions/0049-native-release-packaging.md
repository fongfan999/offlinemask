# 0049 — Verify offline UI and prepare signed native packaging

The owner approved completing offline verification, runtime packaging and platform-specific promotion after the isolated native recovery work. The selected Underthesea + mSuperClinical pack and shared masking policy remain unchanged.

## Offline verification

The LaunchServices QA wrapper resolves the earlier unattached GUI problem. It applies IP denial before exec of the unchanged host and proves IPv4/IPv6 TCP/UDP `EPERM` first. Full UI first-open, missing-pack guidance, safe failed manual download, installed-pack masking, cancellation/draft preservation and retry passed. See [observations and scope](../evaluations/recognition-offline-v1/README.md). The denial applies to host/children; separately managed WebKit XPC services were not independently probed. Shipping CSP remains local-only. No user network settings changed.

## Reproducible packaging

`prepare-native-desktop.mjs` stages the exact lockfile-resolved macOS arm64 runtime only after checking its upstream SHA-256 and size, compiles the locked helper, builds the normal frontend with native recognition, and bundles runtime/license notices. It does not copy models, seed app data, or fetch anything. Builds can download ordinary missing toolchain dependencies; app startup never does.

`desktop:build:native` uses the `recognition-native-release` feature and Tauri signing. The default signature is ad hoc for local QA; an explicit `APPLE_SIGNING_IDENTITY` is respected. Public distribution still requires the owner's Developer ID/notarization setup and project licensing decisions. Ad hoc signing is not Gatekeeper/notarization approval.

## Signing-aware integrity

A real re-signing probe changed the runtime SHA-256 from `76831409…` to `b5f51223…` without changing its inference code. The experimental per-load whole-file hash therefore cannot be retained for signed builds. Release preparation still pins the upstream bytes; the signed-release feature checks the complete local app bundle with `/usr/bin/codesign --verify --deep --strict --all-architectures` before starting recognition. This verifies sealed resources after signing and does not request online trust validation. The original experiment retains its original-file checksum check.

This does not authenticate an ad hoc signer as the product publisher. That requires the distribution certificate/notarization step. Replacing the entire app with a freshly signed malicious build is outside the resource-integrity check, just as replacing the host executable was outside the previous library-only checksum check.

`verify-native-desktop.mjs` additionally checks the completed bundle signature, runtime notices, native dependency paths, and absence of model weights. A passing build is not a new detection-quality result or qualification for untested hardware/platforms.

## Promotion gate

The signed release candidate must pass a real UI mask, offline wrapper restart and resource-tamper rejection before selecting this path by default on macOS arm64. Other targets and browser development retain WASM until separately qualified. Final measurements and completed checks are recorded in the adjacent evaluation rather than inferred from compilation.

Tauri 2 packaging/signing references were checked through Context7: [bundle resources/frameworks](https://v2.tauri.app/distribute/macos-application-bundle/) and [macOS signing](https://v2.tauri.app/distribute/sign/macos/). The app uses bundled local resources and Tauri's signing stage; no JavaScript shell plugin or arbitrary executable command is exposed to the frontend.

## Gate result — 29 September 2026

The signed candidate passed normal and IP-denied UI masking, resource-tamper rejection with preserved draft/no partial session, and explicit retry after restoring the signed resource. The bundle verifier passed. [Release evidence](../evaluations/native-release-v1/README.md) records measurements and the precise limits. `desktop:build` now selects native release packaging for macOS arm64 only; the existing development and other-platform paths remain unchanged.

The build explicitly signs resource code before the app. An ad hoc hardened helper cannot load an ad hoc non-platform dylib because neither has a Team ID; this was reproduced. Local ad hoc inner code uses options `0`; Developer ID inner code uses hardened runtime with the same identity. The complete bundle seal is verified in both cases. A corrected explicitly signed copy passed UI inference; real Developer ID/notarization remains untested.

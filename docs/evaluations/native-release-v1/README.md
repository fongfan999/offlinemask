# Signed native release candidate — 29 September 2026

The macOS arm64 release candidate was built on 21 September and its final UI checks completed on 29 September. It uses the unchanged selected models and masking policy. Model data was installed only into the isolated Release QA identity using verified local fixture hardlinks.

- Complete ad hoc bundle signature verified with strict/deep checks. Runtime notices are present; no model weights are bundled; native dependencies resolve to system libraries/frameworks and the pinned runtime.
- App files total **48,887,693 bytes**. A local ZIP made with `ditto -c -k --keepParent` is **18,045,607 bytes**. This is the measured QA ZIP, not a notarized public DMG size. The optional recognition pack remains a separate 712 MB download.
- Normal signed app: full name, apartment/street address and email were masked in the 161-character synthetic fixture. Ordinary date and amount remained visible.
- The release executable also passed in the QA IP-denial wrapper. IPv4/IPv6 TCP/UDP probes returned EPERM before exec. The local bundle-signature check and native inference both completed without IP access. The prior host/helper versus WebKit-XPC boundary still applies.
- Changed one byte at the end of the disposable QA runtime. `codesign` rejected the bundle; app preparation did not spawn a helper. An explicit masking request displayed the generic failure, retained the exact draft, and created no partial session.
- Restored the original runtime without changing the running host or draft; signature verification passed again, and explicit retry produced the expected three masks.
- Quit all test instances afterward. No existing user app was running at the start of the 29 September continuation; none was opened or modified.

The earlier 167 application tests, TypeScript checks, 15 Rust tests (two opt-in installation tests ignored), and release-feature Clippy passed. The previous 398-preview parity and crash/hang recovery evidence applies to the unchanged inference implementation; it was not reclassified as new detection-quality evidence.

`pnpm desktop:build` now selects the native release packaging path on macOS arm64. Other hosts keep the previous Tauri/WASM build. Direct `tauri dev` and browser development remain WASM. Public Developer ID/notarization, complete application redistribution review, and qualification on other/low-memory hardware remain separate prerequisites. This does not establish banking compliance or perfect detection.

## Explicit inner-code signing follow-up

Tauri's observed signing log sealed the host/app but did not separately sign the helper stored under Resources. Preparation now explicitly signs the runtime and helper before the outer bundle. A deliberate hardened/ad hoc combination failed with Apple's different-Team-ID library-validation error; it retained the draft safely. Local ad hoc helpers therefore use signing options `0`, matching the original non-hardened helper execution mode. Developer ID preparation uses hardened runtime for both files with the same identity; that certificate path still requires real release qualification.

The corrected explicitly signed local copy passed strict/deep bundle verification and produced the same three-mask UI result. Its runtime SHA-256 differs from the upstream file, directly exercising the signing-aware integrity design. The earlier offline/tamper observations above used the original inner signatures and unchanged inference executable; they are preserved rather than presented as a second full replay. No library-validation entitlement was added and no system protection was changed.

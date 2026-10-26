# macOS arm64 public release gate

Local QA signing is complete. Public Developer ID signing/notarization and actual 8 GB hardware qualification are **not complete**.

## Signing setup

Install a valid Developer ID Application certificate with its private key into the build machine's keychain. Set `APPLE_SIGNING_IDENTITY` locally to its exact name or SHA-1. Do not paste certificates, passwords, private keys or credential values into chat or commit them.

Configure one complete notarization authentication set locally:

- Apple ID: `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), `APPLE_TEAM_ID`.
- App Store Connect: `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_PATH` (readable private key file).

These are the [Tauri 2 documented signing/notarization inputs](https://v2.tauri.app/distribute/sign/macos/). The inner runtime/helper are signed with the same identity before the app. Runtime downloads and pack installation are not part of this release check.

Run a read-only preflight:

```sh
mise exec -- pnpm -C desktop exec node scripts/check-macos-release.mjs
```

Once configured, this explicit command builds and submits the app to Apple's notarization service through Tauri, then validates its stapled ticket and Gatekeeper assessment:

```sh
mise exec -- pnpm -C desktop exec node scripts/build-macos-release.mjs
```

It stops before building when signing prerequisites are missing. The normal local `desktop:build` remains available for ad hoc QA. A valid local signature alone is not a notarization result. Distribute only the exact verified artifact; record SHA-256, build commit, macOS/architecture, notarization outcome and hardware run. Do not publish automatically.

Signing also decides whether the two macOS Services of [decision 0094](../decisions/0094-macos-services.md) appear: Finder and the Services menu list them only for an app with a Developer ID signature ([decision 0158](../decisions/0158-finder-services-need-a-signed-app.md)); an ad hoc build registers them but shows no menu item.

## Actual 8 GB Apple Silicon qualification

Use a separate test identity or a clean test account. Use synthetic data only. Never clear a user's app data or quit an app holding their private sessions. Do not manufacture memory pressure on the owner's active machine and call it an 8 GB test.

1. Record device/model, physical RAM, OS, app artifact hash, pack manifest hash and power mode. On an actual 8 GB machine, test both an otherwise idle desktop and the tester's ordinary browser/office workload; record competing workload without capturing its contents.
2. First launch without a pack: built-in email/phone/customer-code masking works; contextual selections clearly request the pack; startup performs no download. Confirm failed manual download retains draft, then install the pack explicitly and restart.
3. With Internet unavailable, cold launch and mask after 8 seconds of typing. Record remaining wait and exact preview. Use the 161-character synthetic fixture from `docs/evaluations/recognition-sidecar-v1/README.md` / the native benchmark script. Expected findings: name, complete apartment/street address, email; ordinary date/amount retained.
4. Run 2,000, 10,000 and 50,000-character benchmark fixtures. Cancel a long request, verify the entire draft, retry, and reopen the earlier session. Repeat cold launch and long processing three times; report every outcome, not only the fastest.
5. Capture aggregate host + renderer + inference-helper RSS/physical footprint, memory pressure and swap before/during/after. Account for changed helper PIDs. Record peak values and sampling interval; memory pressure/swap and completion matter more than a single RSS value.
6. Quit and verify no helper remains. Reopen and confirm temporary sessions are gone. Confirm the optional pack remains available offline.

Required behavioral pass: no crash, OS kill, frozen window, lost draft, partial session, wrong fixture output, runaway retry or orphan helper in any trial. Report timings, pressure and swap for product review; no acceptable 8 GB performance threshold has yet been established. A 16 GB success, process memory limit, or synthetic stress allocation cannot close this hardware gate.

Record observations and failures with artifact hashes in `docs/evaluations/`; never collect real user content. The existing synthetic detection evaluation remains separate from hardware qualification.

## Current local blockers

Read-only inspection during this task found zero valid code-signing identities and no complete notarization credential set. This Mac is `MacBookPro18,3` with 17,179,869,184 bytes physical memory (16 GiB). Signing tools are installed. No notarization submission or 8 GB test was attempted, and no global network/security setting was changed.

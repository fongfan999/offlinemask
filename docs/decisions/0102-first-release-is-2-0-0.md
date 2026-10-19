# 0102 — The first public release is 2.0.0

Date: 19 October 2026. Status: requested by the owner ("the first version should be 2.0.0, not 1.0.0"), who follows the [Larry Ellison combative-strategy doctrine](https://www.stratrix.com/founder-doctrine/larry-ellison-s-combative-strategy-doctrine); its version-numbering lesson is Oracle's first release, which shipped as version 2 because a 1.0 tells buyers the product is untested.

## Decision

- **The first tagged release is `2.0.0`.** `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock` carry the same number, as [product direction](../product-direction.md) requires; the sidebar and Cài đặt › Ứng dụng read it from `package.json`, the installers and the macOS bundle from the Tauri and Cargo manifests.
- **Semantic versioning from here.** Patch releases fix behaviour; minor releases add formats, categories or quick actions; the major number changes when a stored or exchanged format breaks: the vault file (`OMV1`), the pack contract in `packs/<id>.json`, the alias codes a user may hold in an AI conversation, or the masked-file layout.
- **A changelog starts** at [`CHANGELOG.md`](../../CHANGELOG.md), in Keep a Changelog form, one entry per release, written for users rather than contributors (the decisions carry the detail). The release commit is tagged `v2.0.0`.
- The `1.0.0` that earlier decisions and product-direction entries mention is history and stays as written; the number never shipped.

## Not changed

The version does not imply more than the README states: macOS on Apple Silicon is the only platform tested by hand, Windows x64 awaits the checklist in [0077](0077-native-recognition-windows.md), Linux is untested, and signing and notarization are still open in [docs/release/macos-arm64.md](../release/macos-arm64.md).

## Checked

`pnpm lint`, `pnpm typecheck`, `pnpm test` (299), `pnpm check:native`, `cargo test --locked`, and `cargo metadata --locked` after the lockfile change.

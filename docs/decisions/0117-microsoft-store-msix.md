# 0117 — Windows through the Microsoft Store as an MSIX

Date: 20 October 2026. Status: implemented, not yet submitted.

## Context

Unsigned Windows installers trigger SmartScreen, a paid certificate costs more than a free app justifies, and SignPath Foundation declined the project ([0116](0116-mit-license.md)). The Microsoft Store takes an unsigned MSIX and signs it with Microsoft's certificate, so Store installs show no warning. Individual developer accounts have been free since September 2025; the owner registered one on 20 October 2026. Submitting the existing EXE or MSI instead would require them to be signed with a CA certificate first. Tauri makes no MSIX ([tauri#4818](https://github.com/tauri-apps/tauri/issues/4818); its [Store guide](https://v2.tauri.app/distribute/microsoft-store/) covers signed EXE/MSI only).

## Decision

- **Package.** [`desktop/scripts/build-msix.mjs`](../../desktop/scripts/build-msix.mjs) runs after the native Windows build. It stages what the installers install (`OfflineMask.exe`, `native/`, `licenses/`) with three icons, fills [`desktop/store/AppxManifest.xml`](../../desktop/store/AppxManifest.xml) and packs with the Windows SDK's `makeappx`. The app is a full-trust desktop app (`runFullTrust`, `Windows.FullTrustApplication`), minimum Windows 10 1809, x64, Vietnamese. The version is the app version with a fourth part of 0, as the Store requires. `makeappx` is used directly rather than Microsoft's preview `winapp` CLI.
- **Identity is data.** [`desktop/store/microsoft-store.json`](../../desktop/store/microsoft-store.json) holds the Store ID and the Partner Center identity (Name, Publisher, PublisherDisplayName). While it is empty the script builds with a test identity and marks the file `_test-identity`; that package installs for testing but cannot be uploaded.
- **Release workflow.** The Windows job builds the MSIX, test-signs a copy with a throwaway certificate whose subject is the manifest Publisher, installs it on the runner, runs the helper smoke test from the read-only package folder, starts the app from the package and checks it is still running after 20 seconds, then uninstalls. It runs the Windows App Certification Kit when the runner has it and reports failures as warnings: a Tauri MSIX is reported to fail the S-mode "blocked executables" check ([tauri#14935](https://github.com/tauri-apps/tauri/issues/14935)), and whether that blocks a full-trust Store listing is unverified. The unsigned MSIX, the test-signed copy, its `.cer` and the WACK report are a run artifact (`msix-windows-x64`), not release assets: Windows will not install an unsigned MSIX from a download, and the publish job now attaches only `offlinemask-*` artifacts.
- **Landing page.** The Windows download switches to the Store only when `storeId` is set: Vite keeps the `windows-store` variants of `product.html` and drops the `windows-direct` ones. The Store variant is one "Tải từ Microsoft Store" button and a small "Máy không có Store?" link to the install guide, for work PCs where IT has disabled the Store. Mac and Linux keep direct downloads. Setting the ID before the listing is live would publish a dead link, so it is set only after certification.

## Behaviour that differs in the package (to test by hand)

- **App data** written under `%LOCALAPPDATA%` is redirected to the package's private `LocalCache` and removed on uninstall. The vault, settings and the recognition pack move there; nothing migrates from an earlier EXE/MSI install.
- **Start at login** (decision 0092) uses `tauri-plugin-autostart`, which writes the `Run` registry key. Registry writes from a packaged app are virtualized, so this is expected not to work from the Store build until a `windows.startupTask` extension replaces it.
- **WebView2** is not bootstrapped by an MSIX; the app relies on the Evergreen runtime that Windows 11 and nearly all Windows 10 machines have.
- The package folder is read-only; the app writes nothing beside its executable.

## Release order

1. Owner: reserve "OfflineMask" in Partner Center (MSIX or PWA app) and copy the identity values into `microsoft-store.json`, without `storeId`.
2. Dry-run the release workflow (Run workflow, no tag) and install the test-signed MSIX on a Windows PC: trust the `.cer` in Local Machine → Trusted People, open the `.msix`. Check masking, files, the recognition pack download, quick actions, the vault, start at login and uninstall.
3. Owner: submit the unsigned MSIX with the listing, age rating, privacy URL (`https://offlinemask.com/privacy`) and the runFullTrust justification. Certification takes up to three business days; there are no hot fixes after that point, only new submissions.
4. After the listing is live: set `storeId`, add the Store to `docs/install.md`, push to deploy the landing page.

## Not done

A `windows.startupTask` for start at login; scale variants of the tile icons; Store listing text; ARM64.

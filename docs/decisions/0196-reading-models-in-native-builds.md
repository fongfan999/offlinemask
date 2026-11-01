# 0196 — The native builds carry the reading models

Date: 1 November 2026. Status: decided; found by testing the installed Store build of 2.6.0. Follows [0191](0191-windows-reading-opened.md) (reading opened) and [0077](0077-native-recognition-windows.md) (the native Windows build).

## Problem

The Microsoft Store build 2.6.0.0, installed on the owner's PC and driven through WebView2's remote-debugging port, passed every flow (text, CSV, Word, folder, restore, settings, the pack download from packs.offlinemask.com) except one: a photographed form or a copier-scan PDF dropped on Tài liệu ended in "Không mở được tệp này", with "Missing model" in the console. Home still listed "Hình ảnh .png .jpg".

Two things had gone wrong.

- **The release build had no models.** `public/reading/` is gitignored and created only by `scripts/prepare-reading.mjs`, which `pnpm build` runs. The native builds of the release workflow, `desktop:build:native` on windows-x64 and macos-arm64, go through `scripts/prepare-native-desktop.mjs`, which builds the frontend with Vite on its own and copies whatever `public/` holds. On a fresh checkout that is nothing, so 0191's "a build without the models fails" never ran: the guard lived in a script the native path did not call. The owner's own release build of 31 October had the models because an earlier `pnpm build` had left the folder behind. The release sizes said the same: the Windows installer grew by 50 KB over 2.5.0, the Linux and Intel-Mac bundles, built with the plain `desktop:build`, by 11 MB.
- **The app promised them anyway.** `readingAvailable()` in `src/adapters/ocr.ts` asked whether `/reading/reading-v1.json` fetched with status 200. Tauri's asset server answers every unknown path with `index.html`, 200 and `text/html`, so the check passed on a build with no models and the app offered pictures it then could not read.

## Decision

- **`prepare-native-desktop.mjs` runs `prepare-reading.mjs`** before building the frontend, so the native path stages the models the way `pnpm build` does, and prepare-reading's own failure (no models while `readingShipped` is on) now reaches it. After copying `public/`, the script refuses a frontend without `reading/reading-v1.json` while the gate is on, and `provenance.json` records `readingBundled`.
- **The gate parses the manifest.** `readingAvailable()` is true only when the reply is JSON whose `id` is the one the worker was built with (`reading/reading-v1.json`), never for the fallback page, another pack's manifest, a 404 or a failed fetch. `tests/reading-gate.test.mjs` covers each; `tests/privacy-contract.test.mjs` requires both build paths to run prepare-reading and the native build to refuse a frontend without the models.
- **2.6.1 follows**, for Windows and Apple Silicon. Linux and Intel Macs have the models in 2.6.0; macOS 14 and later never needed them.

## Not changed

The Store app's own data lives under the package's `LocalCache` folder, not the plain app-data folder: the pack downloaded there from packs.offlinemask.com (1.08 GB in about two and a half minutes) under the new fingerprint of [0176](0176-packs-at-offlinemask-com.md), and the helper ran against it. The test also showed the 2.4.0 process crashing while the Store replaced it with 2.6.0; that is the old version dying during the update, not this release.

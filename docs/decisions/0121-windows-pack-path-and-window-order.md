# 0121 — Windows: a non-http pack path, and windows built after the app's state

Date: 22 October 2026. Status: found while testing the 2.0.1 MSIX ([0117](0117-microsoft-store-msix.md)) on a Windows 11 ARM VM (x64 under emulation, 4 GB). The owner reported that masking with the Vietnamese pack spun and then failed, and that Settings said "Mật mã và lịch sử chỉ có trong ứng dụng máy tính." The plain `OfflineMask_2.0.1_x64-setup.exe` behaves the same, so neither bug is specific to the MSIX.

## Masking: the tokenizer looked missing

The native helper ([0077](0077-native-recognition-windows.md)) loaded both models correctly: about 6 s and 53 s outside the app, the same CPU and memory profile inside it. The detection worker then failed in `AutoTokenizer.from_pretrained` with `Cannot read properties of undefined (reading 'tokenizer_class')`, released the helper, and the page showed "Chưa xử lý được văn bản trên thiết bị."

Transformers.js 4.2 first asks whether `tokenizer_config.json` exists. That check reads the local path only when the path is not `http:`/`https:`, and otherwise falls back to the Hub, which the pack disables. On macOS the pack root is `asset://localhost/…`; on Windows Tauri serves custom protocols as `http://asset.localhost/…`, so the check reported the file missing without a request, and the tokenizer was built from an empty file list.

**Decision.** `configureLocalModels` gives Transformers.js a fixed non-http path, `offlinemask-pack:/`, and its `fetch` maps that prefix back to the pack root before the ranged fetch. Every platform now takes the local-file path. Nothing new is reachable: the mapped URLs are the same asset URLs as before, still under the asset protocol scope and the CSP.

## Vault: the first command arrived before its state

Tauri 2 builds the windows from `tauri.conf.json` before it runs the app's `setup` hook, and `setup` is where `Vault` and `Models` are managed. On the VM the webview's first `vault_status` was answered about 1 s after launch while the main thread was still busy with startup (`set_theme` took until about 4–5 s). A command answered before its state is managed fails, `useVault` treats any failure as "not the desktop app", and the card stayed that way for the whole launch. A reload, or any later call, succeeded.

**Decision.** Both windows are `"create": false`. `setup` registers the plugins and managed state first, then builds every window Tauri left uncreated, then sets up the tray, menu and background start as before. No command can reach the app before the state it needs exists, however slow the machine.

## Not changed

The 120 s load and 15 s run deadlines in `recognition_process.rs` held: on this VM a cold load took 50–100 s with paging, and the helper was released by the frontend, not timed out.

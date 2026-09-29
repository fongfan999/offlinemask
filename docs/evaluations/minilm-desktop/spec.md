# MiniLM packaged desktop integration probe

18 September 2026. Add an opt-in Cargo feature for the frozen native tokenizer library and asynchronous Tauri commands. Normal builds must exclude the library and commands. The normal UI/model selection remains unchanged. Freeze old production files before the intentional Cargo/lib changes; never rewrite earlier evidence.

Build a separate diagnostic frontend/app identifier using synthetic fixtures only. Stage the pinned Gather-only graph/tokenizer in that identifier's local-data directory. No downloads or installed-pack edits. Native encoding executes off the UI thread with one active job, explicit cancellation and stale-result suppression. Record cancellation acknowledgement separately from background work completion. WASM inference stays in a terminable Web Worker.

Check all 20 frozen native-path tensor probes in actual packaged WebKit against Python CPU references (atol=rtol=1e-4). Check raw/masking offsets through IPC, rebasing, busy rejection, cancellation and recovery. Run short/2,000-character/50,000-character synthetic cases, with source-covered grapheme-safe windows. Measure cold path, warm p95, long-run time, responsiveness and sampled process memory; proposed budgets remain 5s cold, 300ms warm 2k, 8s 50k, 1 GiB footprint and 250ms cancellation. Diagnostic timing is not learned privacy quality.

Launch the isolated macOS app under an OS network-deny profile. No telemetry/private text/result logging. Diagnostic report persistence accepts metrics only, never arbitrary input or offsets, and exists only under the compile-time feature. Record platform/sampling limitations and any failed budgets rather than weakening them. No release promotion or training.

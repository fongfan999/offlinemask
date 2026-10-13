# 0073 — Pack status carries a revision so pausing cannot stick

Date: 13 October 2026. Status: bug fix reported by the owner (Settings stuck at "Đang tạm dừng…" with "Đang kết thúc phần tải hiện tại…" after pausing at 33 %).

## Cause

`useRecognitionPack.run("pause")` sends `cancel_model_download`, then reads `model_status` once. The native worker notices the cancel flag within one network read and pushes `paused`. The read and the push travel separately, so the read's reply ("cancelling", taken before the worker stopped) could land after the "paused" push and overwrite it. With nothing left to push, the screen stayed on "Đang tạm dừng…", and the native side was really paused.

## Decision

- `ModelStatus` gains `revision`, bumped on every access to the status mutex in `models.rs`, so any snapshot taken after a change is newer than every snapshot taken before it, whether it travels as a command reply or an event.
- `useRecognitionPack.apply` ignores a status older than the one shown. Mocks and the browser preview without a revision are treated as revision 0 and always apply.
- No change to what is downloaded, when, or from where; downloads remain explicit.

## Verification

`pnpm lint`, `pnpm typecheck`, `pnpm test` (209; the new test reproduces the out-of-order reply and fails without the guard), `cargo fmt --check`, `cargo clippy --all-targets -D warnings` and the `models` Rust tests passed. Not yet reproduced in the running desktop app; the dev app needs a restart to pick up the native change.

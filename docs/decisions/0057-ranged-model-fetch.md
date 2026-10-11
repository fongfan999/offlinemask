# 0057 — Fetch pack files in ranges so launch never blocks the window

Date: 11 October 2026. Status: accepted by the owner after the launch stall was traced.

## Problem

With a pack installed, the window drew and then showed a spinning pointer for about three seconds. Profiling the host on an M1 Pro (macOS 26.6.2, `tauri dev`) showed the main thread inside Tauri's `asset:` protocol handler for 2.8 s: it reads a whole model file (the multilingual graph is 916 MB) and hands that one buffer to WebKit's URL scheme task, all on the main thread, while the host's memory climbs to about 900 MB. Transformers.js requests each file with a single `fetch`, so nothing could interleave with events. The background preparation from [decision 0044](0044-background-recognition-loading.md) triggers this at launch; the first masking request would hit it otherwise.

A second, development-only cost: a debug build verifies a freshly installed pack by hashing 1.1 GB, and the unoptimized `sha2` crate ran for over 30 s at 90 % of a core.

## Decisions

- The detection worker gives Transformers.js a custom `env.fetch` (`src/core/detection/ranged-fetch.ts`) for URLs under the pack root. It asks for the file in `Range` requests, lets the server's first reply set the step (Tauri caps each range at 1000 KiB and exposes `content-range`), keeps a few ranges in flight, and forwards each reply's body pieces in order through one `Response` with the full `content-length`. Transformers.js preallocates from that header and reads the stream as before. A server that ignores `Range` gets its 200 reply returned as is; a reply whose range does not match the request fails the load.
- Range requests are sent with `cache: "no-store"`. Without it, WebKit kept the 1 MB partial replies in its memory cache, and the renderer's steady footprint after loading was about 1.1 GB higher than with the single request, which was too large to cache. With it, the footprint matched the previous path (3.8 GB on the measured machine).
- Only the transfer changed. The engine still memoizes one load per pack root, so a request made during preparation waits on the same promise and shows the existing loading status.
- `[profile.dev.package.sha2] opt-level = 3` in `src-tauri/Cargo.toml` makes the one-time verification take seconds in `tauri dev`. Release builds were already optimized.

## Rejected

- A custom asynchronous URI scheme in Rust with larger chunks. It would move the file read off the main thread, but wry still delivers each reply to WebKit on the main thread in one piece, so chunking is needed anyway; the fetch-side change needs no native code. Revisit only if the 1 MB cap makes the transfer too slow.
- Dropping the launch-time preparation. It would avoid the stall but reintroduce the cold first request that decision 0044 removed.

## Limits

This keeps the host responsive; it does not reduce the renderer's footprint while models load (about 2.3 GB on the WASM path). On a machine already swapping, the system can still stutter during that load. The native macOS release build loads models in the sidecar and never used this path; Windows and Linux builds, which keep WASM, benefit directly.

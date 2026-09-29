# 0048 — Contain native recognition failures in a helper process

Date: 2026-09-21

Status: Opt-in packaged sidecar qualification; production default unchanged.

## Problem

The packaged native backend preserves the selected model quality and is much faster than WASM, but an in-process native crash or hang can affect the whole app. The app must retain drafts and existing previews through model failures.

## Implementation

Add `recognition-native-sidecar`, which uses a bundled Rust helper for the exact selected graphs and pinned runtime. The host's worker, tokenization/source mapping, shared policy and UI stay unchanged. The earlier in-process experiment remains available as a separate feature; default builds keep WASM.

A local supervisor owns the child and bounded JSON-line transport. Request/generation checks reject stale output. Loads have a 120-second per-model deadline; chunks have a 15-second deadline. A fault kills/reaps the child. Explicit retry creates a fresh generation; source text is never silently resubmitted. Active I/O does not hold the supervisor state lock, so release or replacement can terminate a stalled child. On app exit, the supervisor closes, terminates the child and forbids new loads. The helper also watches its input pipe independently of native inference.

Only token IDs and logits cross local pipes. Requests/replies are capped, stderr is discarded, provider errors are generic, and no user data is logged or persisted. Runtime/pack verification and the four-thread CPU configuration are preserved. No network checks, model changes or dependencies were added. Tauri's official state/lifecycle documentation and installed 2.11.5 `App::run` source were consulted for the exit callback.

## Evidence

The [packaged trial](../evaluations/recognition-sidecar-v1/README.md) matched all 398 saved previews and completed the 50,000-character fixture in 19.637 seconds. Warm cancel/retry stayed near 100 ms. Memory still peaked around 3.31 GiB physical footprint across host, renderer and helper.

A completely stopped helper timed out and was reaped; the unchanged draft could be retried successfully in a new process. Killing a helper during a long request also retained the whole draft, preserved prior sessions and recovered without restarting the host. Parent-pipe closure with real models was tested under OS network denial. This closes the tested crash/hang recovery gap; it is not a claim about every possible OS/runtime failure.

## Remaining release qualification

The full GUI under OS network denial remains inconclusive, separate from the passing core/child offline checks. Signed runtime/helper packaging, required notices, lower-memory devices and supported Windows/Linux targets remain qualification tasks. Do not confuse passing integration/regression evidence with perfect privacy detection or new banking-domain accuracy evidence.

The final exit-hook build was also tested with a SIGSTOP-stalled helper: quitting terminated both processes, and reopening showed no temporary sessions. Validation passed: 167 app tests, 15 native app tests (two opt-in install checks ignored), two helper tests, type checking, native Clippy/formatting, and packaged macOS builds.

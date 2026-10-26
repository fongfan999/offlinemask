# 0157 — A worker's chunks never import its entry: WebKit evaluates it twice

Date: 26 October 2026. Status: implemented, in 2.3.0 before it was pushed. Owner, after the native build for 2.3.0: a PDF opened on Tài liệu, but "Ẩn thông tin" showed "Đang ẩn thông tin… 0 %" with Hủy and stayed there; "was that intentional?"

## What happened

Decision 0149 builds both workers as ES modules so pdf.js loads only when a PDF opens. Rollup (rolldown in this Vite) then placed the code shared between a worker's entry and its on-demand chunks *in the entry*, exported from it, and the chunks imported the entry back: `recognition-….js` (ONNX Runtime and the pack loader) imported `detection.worker-….js`, and `xls-….js` imported `files.worker-….js`. The pdf chunk shared nothing with its entry and imported nothing, which is why reading the PDF worked and masking did not.

Chromium treats the worker's entry as the module already in the worker's module map, so the import is a no-op. **WebKit fetches and evaluates the entry a second time.** Checked on this Mac (macOS 26.6, system WebKit) with a `WKWebView` loading a three-file page over `http://127.0.0.1`: an entry that posts "entry evaluated", exports an object, and on a message imports a chunk that imports the entry. The page received "entry evaluated" twice, and the chunk's copy of the export was a different object (`m.ref === shared` false in the first copy). The harness is not in the repository; it is 12 lines of Swift (a `WKWebView`, a `WKScriptMessageHandler` printing `window.webkit.messageHandlers.log` messages) and three files served by `python3 -m http.server`.

In the app, the second evaluation of `detection.worker.ts` ran its top level again: a fresh `onmessage`, a fresh engine, empty `pending` and `nativePending` maps. The first copy was awaiting the tokenizer's reply through `postMessage`; the reply reached the second copy, which knew no run with that id and dropped it. Nothing threw, so no "error" message was sent, the page never left the loading stage, and the sidecar was never asked to load (it sat idle at 0 % CPU). Hủy worked because it does not depend on the worker.

## Decision

1. **Shared code goes into a chunk of its own, never exported from a worker's entry.** Vite sets `preserveEntrySignatures: false` for every worker bundle after merging `worker.rollupOptions`, so the option cannot be set there; a plugin in `worker.plugins` sets it to `"strict"` in its `options` hook. The build now gives `detection.worker-….js` (3 kB) and `recognition-….js` both importing `policy-….js`, and `files.worker-….js` (11 kB) and `xls-….js` both importing `files-….js`. No chunk imports an entry, and an entry is evaluated once.
2. **The build fails if that regresses.** `scripts/check-worker-chunks.mjs` reads the built assets, takes the entry names from `src/workers/*.worker.ts`, and throws when any other file imports an entry with module syntax (`from "./x"`, `import "./x"`, `import("./x")`); the page's `new Worker(new URL("/assets/…"))` is not an import. `scripts/prepare-desktop.mjs` (the CI release, through `beforeBuildCommand`) and `scripts/prepare-native-desktop.mjs` (the owner's native build) run it on the staged front end. `tests/worker-chunks.test.mjs` covers the check with invented bundles. Run on the shipped 2.3.0 front end, it names both pairs above; on the new build, none.

The alternative, a bootstrap entry that only queues messages and imports the real worker, would also work in every engine but moves the problem into the workers' code and the replies' ordering. Keeping the entry a real module and shaping the chunks is the smaller change.

## Not changed

The workers stay ES modules with on-demand chunks (0149). The 2.3.0 changelog does not list this: the stall never reached a published build. `landing/privacy.html` is untouched: nothing about networking or storage changed.

## Verified

`pnpm lint`, `pnpm -C desktop typecheck`, `pnpm -C desktop test` (417) pass. `node scripts/check-worker-chunks.mjs` passes on the new `dist/assets` and fails on the previous native build's front end. The native build with the fix is the owner's check: open a PDF on Tài liệu and mask it, and open an .xls file, whose chunk had the same shape.

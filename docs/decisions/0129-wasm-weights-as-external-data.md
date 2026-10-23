# 0129 — WASM recognition loads its weights as external data

Date: 23 October 2026. Status: follows [0128](0128-webkit-kills-the-wasm-page.md), which stopped the circle from waiting on a page that WebKit had killed past 4 GB. This change keeps the page under that limit. It applies wherever recognition runs on WASM: `pnpm desktop:dev`, the macOS Intel release and Linux. Native recognition (macOS Apple silicon, Windows) is unchanged.

## Finding

ONNX Runtime Web builds a session from one buffer. It copies the whole `.onnx` file into the WASM heap, parses the protobuf (a second copy of every weight) and builds tensors from it (a third). WASM memory never shrinks, so the heap kept the high-water mark. `scripts/measure-wasm-heap.mjs` measures it with the pinned runtime and the installed pack:

| Load | Underthesea (195 MiB graph) | + multilingual (874 MiB graph) | After a 512-token run |
| --- | --- | --- | --- |
| Whole graph (before) | 548 MiB | 2 859 MiB | 2 859 MiB |
| Weights as external data (now) | 227 MiB | 1 218 MiB | 1 338 MiB |

Graph optimisation level, the CPU arena and memory patterns made no difference. Thirty inferences of random lengths did not grow the heap either.

In WebKit the heap sits in the "WebKit malloc" category of `footprint`. The file bytes and the 1 MB range chunks sit in "JS VM Gigacage". The detection worker allocates nothing while idle, so WebKit did not collect those buffers, and about 0.5 GB stayed after every load.

## Decision

- **External data.** `externalizeWeights` (`src/core/detection/external-weights.ts`) rewrites only the graph's protobuf. Each large top-level initializer gets an `external_data` entry pointing at its own bytes, at their offset in the original file. The runtime receives the small graph and the untouched file as `externalData`, and copies each weight once, straight into its tensor. Nothing in the pack changes: same files, same hashes, no conversion step. On the 18 pack fixtures both models produced byte-identical token predictions and scores (4 462 tokens) with and without the rewrite.
- **Buffers freed when done.** Each range chunk and, once the session exists, the file bytes are released with `ArrayBuffer.prototype.transfer(0)` where the engine supports it. After each WASM load the worker allocates and drops a short burst of small objects, so WebKit collects what the load left. This costs about 100 ms per model.
- **Largest model first.** Models load in descending graph size, while the page holds nothing else. Detection still runs them in pack order.
- **The model gate exercises the same path.** `pnpm test:models` (Node, CPU runtime) now loads through the rewritten graph too. It had also been failing since [0121](0121-windows-pack-path-and-window-order.md): Node reads files itself and could not find the `offlinemask-pack:/` alias. Node now gets the real directory.
- **Reload in place stays.** Releasing models still disposes the sessions inside the same worker ([0045](0045-release-model-sessions-before-reload.md)). With external data a reload reuses the 1.2 GB heap that is already there.

## Measurements in the app

Owner's M1 Pro (16 GB), `pnpm desktop:dev` (WASM), with the main window visible. Each run reloaded the page, waited for the pack load (about 1 140 asset requests) and sampled `footprint` every second. The workload is 12 consecutive ⌘⇧M runs on 1 to 16 paragraphs of invented contract text in TextEdit. OfflineMask came to the front after every third run, so warm-up ran too. Every completed run masked every name.

| | Before | After |
| --- | --- | --- |
| Loading the pack | 6.7 GB peak; killed (`ExceededMemoryLimit`) 30 s in | 3.7–3.9 GB for a few seconds (5 loads) |
| Settled after loading | 4.3 GB (owner's log, 13:01–13:09); killed at the next check | 2.4–2.6 GB |
| ⌘⇧M workload | 4.9 GB after loading, rising to 8.0 GB; killed at run 11 | Peaks of 3.8 and 4.2 GB in two workloads; back to 2.5–2.7 GB between runs; never killed |

WebKit checks the footprint every 30 seconds. When it is over 4 GB, WebKit first tries to shrink the process and kills it only if it stays over. Before this change the heap alone was 2.9 GB, so it could not shrink below the limit. Now the live part is about 2.5 GB, and the brief peaks are mostly buffers that a shrink collects. These are single-machine numbers. An Intel Mac with less memory has not been measured.

## Not decided here

- **Native recognition on Intel Macs** would remove the WASM heap from the page entirely, as on Apple silicon. It needs a macOS x64 ONNX Runtime: the pinned `onnxruntime-node` 1.24.3 ships no `darwin/x64` library (`scripts/native-runtimes.json`), and `release.yml` builds Intel on `macos-15-intel` with WASM. This is proposed for the owner, not switched.
- **Loading stalls while the main window is hidden.** During this work a pack load sat half-read for minutes until the window came to the front. That delays the first circle after launch. It is a separate problem.

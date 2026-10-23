# 0128 — WebKit kills the WASM page past 4 GB; the circle no longer waits for it

Date: 23 October 2026. Status: found on the owner's Mac (16 GB, `pnpm desktop:dev`, WASM recognition): after a while of Ẩn nhanh use the circle span for 20–30 s or never finished.

## Finding

The app's log (`/usr/bin/log show --predicate 'process == "OfflineMask"'`) showed WebKit killing the main window's web process about ten times in 25 minutes:

> Unable to shrink memory footprint of process (4–5.7 GB) below the kill thresold (4096 MB). Killed

On the WASM backend both recognition models live in that process. Its footprint started near 3.7 GB and grew with use; most of it was swapped out (375 MB resident of 4.3 GB), so each detection paged the weights back in. Past 4 GB WebKit killed the process and reloaded the page, which loaded the models again. A click in progress never got its answer, and the circle, drawn by the separate panel window, kept spinning.

Native recognition keeps the models in the helper process ([0046](0046-selected-pair-native-runtime.md)–[0048](0048-isolate-native-recognition.md)), so the web process stays small: macOS on Apple silicon and Windows ship it. **macOS Intel ships WASM in the same WebKit view** and can hit this limit; Linux (WebKitGTK) may too.

## Decision

When the main page starts, it dismisses the panel. After a kill and reload, a circle left spinning goes away instead of waiting forever; the user can select again.

## Not decided here

Keeping the WASM process under 4 GB (releasing the worker's memory, a smaller footprint, or native recognition on Intel Macs) needs measurements on a WASM build and is left to its own change. For development, `pnpm desktop:dev:native` runs at release speed and memory.

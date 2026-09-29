# 0043 — Retain loaded recognition models after bounded cancellation

Date: 21 September 2026. Status: implemented; runtime qualification remains incomplete.

The selected Underthesea INT8 + mSuperClinical INT8 pair is unchanged. A packaged Mac benchmark measured 12.674 seconds for a short first request, about 0.65 seconds for warm requests, and 11.680 seconds after terminating and recreating the worker. Throwing away both model sessions on every cancellation imposed another cold load.

The explicit text Cancel action now requests cooperative cancellation once processing has begun. It rejects the UI request immediately, drops cancelled predictions, stops between chunks, and waits for a worker acknowledgement before starting an immediate retry. Monotonically increasing request IDs isolate progress, results and native tokenizer replies. Loaded models are reusable; cancelled document chunks and predictions are not cached. No telemetry, user-input persistence or automatic Internet check is added.

Cancellation during loading, navigation during active processing, unmount, runtime errors, and a five-second cancellation timeout still terminate the worker. This bounds unresponsive work without relying on cancellation support inside the ONNX graph. The already-running chunk can complete before the cancellation is observed.

The changed adapter preserves every prediction in the 398-record CPU regression replay, with zero fetch attempts. This does not improve the existing detection quality scores or create a new holdout. Adapter tests cover late results, cancelled queued retries, runtime failure and timeout fallback; runner tests verify that abort stops further inference and the provider remains reusable.

The completed focused packaged run measured **1.721 seconds** for the short retry immediately after cancelling a 2,000-character request, including the drain. Warm requests took 0.643–0.676 seconds. This is one local trial; no percentile or arbitrary-document claim is made.

A forced-reset run caused the WebKit view to reload while loading the models again. The cause is unproven and the failed run is preserved. Cooperative cancellation is measured separately from this forced-reset scenario. Cold startup, repeated hard-reset/load reliability, large-document timings, and Windows/Linux qualification remain open; do not call the whole text feature release-ready from these results.

Evidence and reproduction: [recognition runtime measurements](../evaluations/recognition-performance-v1/README.md).

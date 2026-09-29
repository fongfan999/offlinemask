# 0044 — Prepare the installed recognition pack in the background

Date: 21 September 2026.

The owner requested loading models as soon as the app opens, allowing time spent typing or navigating to overlap startup. Once native pack verification reports ready, the app sends one preparation request to the existing detection worker. It also does this after a manually initiated pack installation completes. Missing packs do not start a worker or trigger downloads.

Preparation loads the same pinned Underthesea + mSuperClinical weights from the verified local root. It does not receive document text or run inference. The engine shares one loading promise between preparation and masking, including a click before preparation finishes. There is no second model instance, remote lookup, telemetry, background update check, or additional persisted data. Ready weights stay in worker memory for reuse, so memory is allocated earlier in the app session.

The UI remains usable, with no additional controls or startup modal. Masking still performs inference: if loading takes ten seconds and masking starts eight seconds into that load, the wait is approximately two seconds **plus inference**, not a promise of a two-second total. Timings begin after local pack verification, not process launch.

Background failure is quiet and does not loop on the one-second local status poll. An explicit masking request can retry a rejected model load; a fatal worker error releases the worker. Shutdown terminates background work. Existing cancellation rules from Decision 0043 remain unchanged. This does not resolve the previously observed forced-reset/reload interruption.

Validation covers a click during loading, multiple preparation calls, inference only after user request, local-only detection without awaiting models, explicit retry after preparation failure, cancellation, and worker reuse/disposal. See [packaged preload test](../evaluations/recognition-preload-v1/README.md).

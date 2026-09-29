# 0039 — Smaller GLiNER2 candidate evaluated, not release-selected

Date: 20 September 2026. Status: local evaluation complete; sole-detector adoption rejected for the tested configuration.

Following the owner's request to continue testing GLiNER2 and conditional agreement to defer organizations, evaluate the published PII Engineer Multi NER v2.1 INT8 build (~670 MB) with its unmodified Rust model implementation and OfflineMask's unchanged shared policy. Keep names, addresses/locations and retained structured fields required. Preserve all prior annotations and report organization coverage separately.

The successful network-denied run executes 398 cases, with 386 ranked and the overlapping owner12 set separate. Under the retained scope, 463/487 complete values are hidden under their correct options: 142/150 names, 112/128 addresses/locations, and 209/209 structured values handled by existing rules. The candidate adds 213 ordinary lexical positions and changes 7/92 negative cases. Its owner-approved batch reaches 25/26 retained values but still fails name and unnecessary-masking requirements. It does not pass the existing gates even without organizations.

The initial ONNX Runtime 1.22.1 process produced all predictions but aborted on shutdown. Repeating with 1.20.1, matching the publisher's `ort` rc.9 version family, exits cleanly with identical scored results. Preserve both runs; do not portray the failed process as a clean runtime test or claim that the root cause has been exhaustively established.

Do not replace the installed pack with this tested configuration. The smaller asset size, approximately 111 ms median non-long inference and fewer false positives are useful, but unaccented names and standalone locations remain required gaps. This is not a rejection of every GLiNER2 checkpoint or proof of real-world accuracy for an alternative ensemble. No custom training, app dependency changes, telemetry or production model switch occurred.

The [evaluation report](../evaluations/gliner2-compact-v1/README.md) records provenance, exact scope, comparisons, runtime limits and reproduction. The first-release organization deferral remains conditional under Decision 0038; the smaller candidate has not yet met that condition.

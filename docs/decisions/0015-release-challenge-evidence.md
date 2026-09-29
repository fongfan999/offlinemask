# 0015 — Freeze a broader challenge before release model selection

Date: 2026-09-15. Status: evaluation completed; all current configurations rejected under the frozen challenge; production unchanged.

## Context and decision

The owner asked us to prioritize the strongest release possible without telemetry. Existing development fixtures alone cannot justify selecting the shared detection core. Add a newly authored, frozen synthetic challenge with explicit private subtypes, selected-category checks, critical-value gates and ordinary-text preservation. Keep variants of one underlying record in one partition. State that the developer is the sole author/reviewer and that synthetic scenarios are not a measured banking-document distribution.

The experiment runs the five already available configurations twice, with no weight downloads, detector tuning or production edits. The 100 cases represent 48 families and 142 annotated occurrences. Every run completes, outputs repeat exactly, but none meets the original overall coverage floor or the full challenge. BigMed leads the new aggregate result but loses seven complete values against the pair, including five names. The ranking reversal compared with the old corpus prevents claiming that the earlier observed ranking establishes a general best model.

## Scope and implementation consequences

The frozen broader banking target includes passport/tax identification and card placement that differ from the documented lightweight UI scope. Preserve and disclose that discrepancy rather than treating a policy mismatch as a model error or retroactively changing the benchmark. Card results under the existing “other” category and a separate actual no-pack engine audit distinguish current behavior from future desired capability. The currently advertised banking types cover 25/25 occurrences in the local-path diagnostic; broader targets still fail.

Next development should establish the supported type/category contract, strengthen bounded field semantics and complete opaque values, then re-evaluate contextual names/addresses. This decision does not authorize an automatic product-scope expansion, a new ensemble, model training, collection of customer data, or release of the current pair. Any development informed by these results makes this set regression material; separately authored/reviewed final validation remains necessary.

## Validation and boundaries

All 92 unit tests pass. Frozen source/fixture/model hashes are checked, scores recomputed from per-case outputs and repeatability compared exactly. The original shared/core and native-provider protocols remain valid. Ten candidate processes complete with no request errors; the local-only audit repeats without a model root or loading progress. No production build or packaged-device qualification is newly claimed.

See the [report](../evaluations/release-challenge-v1.md), [specification](../evaluations/release-challenge-v1-spec.md), [protocol](../evaluations/release-challenge-v1-protocol.json) and [results](../evaluations/release-challenge-v1-results.json). These artifacts document developer-local synthetic evaluation. No automatic network checks, telemetry, private-input logging, uploads or correction collection are introduced.

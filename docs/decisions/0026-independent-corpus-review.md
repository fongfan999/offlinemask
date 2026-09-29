# 0026 — Expand authored data and require evidence-bound independent review

Date: 18 September 2026. Status: first corpus expansion prepared; training held for data quotas and review.

After the runtime component probe, continue single-detector preparation with explicitly authored synthetic data. Add 60 scenarios, split into 30 training and 30 development families, plus two Unicode variants kept within their original families. Together with the historical seed there are 91 records, 88 families and all 19 private types in both partitions. Preserve the 30% ordinary-negative requirement, complete credential spans and existing user categories.

Keep the old preparation evidence immutable. Introduce a versioned audit that requires a separate independent review ledger: annotation approvals bind to the full source record and capability contract; a corpus approval binds to split semantics. Inline author/independent-review flags alone cannot pass the gate. Review entries are declarations, not authenticated proof; do not simulate a human reviewer or claim the author reviewed their own work independently. All records remain pending.

Reject normalized observed-regression templates, cross-partition scenario/value reuse and stale approvals in addition to the original structural checks. These checks complement human semantic review, not establish it. Keep final validation data out of this author-visible preparation. Do not pad quotas with repeated values or Unicode variants and do not collect real inputs to fill coverage gaps.

The unchanged pilot quotas still fail: 30/200 training families and 58/80 development families, with every type below 20 families per partition. Continue purposeful expansion and genuine review; no training run is justified by this batch alone. No model, installed pack, runtime, UI or networking behavior changes.

See the [preparation report](../evaluations/detector-corpus-v1.md) and [frozen results](../evaluations/detector-corpus-v1/results.json). This is reviewable development material, not detection-accuracy evidence or final model selection.

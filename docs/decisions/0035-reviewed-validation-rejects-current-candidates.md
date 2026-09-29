# 0035 — Reviewed-before-inference validation retains both release rejections

Date: 19 September 2026. Status: all 24 proposed examples approved and executed; neither checkpoint selected.

The owner approved all four groups (1–6, 7–12, 13–18, 19–24) before any model execution on the new batch. Verify each receipt against exact source and annotation hashes, freeze execution code, then run both existing pinned single-model candidates with canonical normalization and unchanged policy. Preserve all earlier results and the earlier scope correction requiring organization masking.

The 48 case executions complete without errors. Underthesea fully covers 26/30 values under their own selected categories, including 5/8 person occurrences, while adding 99 ordinary lexical positions of masking. BigMed covers 22/30, including only 1/8 person occurrences, while adding eight ordinary lexical positions. Both fail the existing screening criteria. BigMed also masks ordinary symbols/emoji excluded from that lexical metric; retain actual output previews rather than hiding the limitation in aggregate scores.

This reviewed synthetic batch confirms the unresolved tradeoff: Underthesea overmasks ordinary text; BigMed misses many complete names. Do not select BigMed from its earlier favorable twelve-case review or Underthesea from its resource profile. Keep release rejection for these unchanged checkpoints and the current scope. No production, model, dependency or pack mutation occurs.

The [results](../evaluations/review-first-validation-v1-results.md) preserve per-type and per-case findings separately from historical evidence. The owner reviewed proposed annotations before model output, but examples were assistant-authored after earlier failures were known. This is targeted reviewed validation, not an independently sourced final holdout or banking accuracy. After execution the batch becomes observed regression evidence, not fresh evidence for tuned reruns.

No additional scope clarification or review is required for these 24 examples. Custom training remains deferred. New release selection work would need a materially different qualifying candidate or explicitly revised requirements, not repetition of the same checkpoints or case-specific rules. The current pair remains a development control, not an implicitly approved fallback.

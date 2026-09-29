# 0038 — Allow organization detection to be deferred for a smaller v1 pack

Date: 20 September 2026. Status: conditional scope change accepted; replacement model not qualified.

The owner said, “if it works well, I think we will sacrifice the organizations,” in response to evaluating the smaller GLiNER2-based PII Engineer candidate. Organization detection is therefore no longer a mandatory admission requirement for that candidate. It may be deferred from the first release if the smaller pack demonstrates adequate detection of the remaining required fields. Automatic Vietnamese name and address detection, structured identifiers (including customer codes), and other retained capabilities remain required; manual correction does not substitute for their automatic detection.

This condition supersedes the mandatory-organization requirement in Decision 0037 and the 19 September product direction. It does not select PII Engineer, establish its accuracy, or approve a weaker quality floor for the retained categories. The coverage-first ensemble remains historical comparison evidence, not a requirement to ship its 2.01 GB assets.

## Evaluation and shipping consequences

- Evaluate the actual smaller inference build locally with the same shared processing policy. Check complete names and addresses, retained structured fields, unnecessary masking, source offsets, desktop resources, and offline execution.
- Preserve existing annotations, approvals, protocols and measured results. In a new versioned evaluation, report retained-scope metrics separately from organization coverage and the original full-scope comparison. Apply the existing quality thresholds to the retained scope; do not count organizations as successfully masked because they were excluded or compare aggregates with different denominators as if equivalent.
- Keep organization cases as diagnostic regressions. Organization misses alone no longer disqualify the smaller candidate, but organization detections must not leak into another selected category or conceal false positives. Existing bounded organization rules need not be removed merely because general organization recognition is deferred.
- If this candidate is selected, user-facing capability descriptions must state the supported scope without promising organization recognition through a vague “other private information” claim. Preserve supported non-organization fields within that option. Keep manual selection available for any text, including an organization name.
- Keep one optional Vietnamese recognition pack, a small default installer, explicit downloads, manual-only update checks, and no telemetry or customer-data collection.

No production model, UI, evaluation result, or release status changes with this scope decision. The next candidate evaluation must determine whether the condition “works well” is met; no new inference was run for this decision.

# Review-first validation preparation — 19 September 2026

A new 24-case synthetic batch is prepared and frozen **before model execution**. All annotations remain proposed and all 24 owner-review entries are pending. No detection results, accuracy claims or release decisions have been produced for this batch.

The [review page](review-first-validation-v1/review.md) presents six examples at a time, with the input and assistant-proposed full spans/types to hide. It explicitly distinguishes proposed annotations from model output. The owner may accept a numbered range or correct individual cases. Organizations are in scope, including legal prefixes; customer identifiers remain sensitive. Unlisted ordinary content is proposed to stay visible.

## Composition and limits

There are 19 sensitive examples and five ordinary-text contrasts, with 30 annotated values: eight people, four addresses, four banking identifiers, one email, one phone and twelve values in “other,” including organizations, payment/security values, credentials, a birthday and an IP. A repeated-person example contains two separately located occurrences; it is one scenario, not two independent examples. Two records retain decomposed Unicode source text. Names, addresses and identifiers are authored synthetic values; coincidental real-world matches are possible and no correspondence with real people or accounts was sought.

The batch covers lowercase/unaccented/uppercase names, apostrophe names, Unicode, address structure, legal organization prefixes, mixed person/organization context, explicit structured fields, and ordinary headings/numbers/roles/symbols. It is deliberately targeted using knowledge of prior failures. New wording and a later human review do not turn it into a blind independently sourced holdout, an exhaustive capability test or a representative banking sample. Small category denominators prevent credible accuracy estimates.

The [protocol](review-first-validation-v1/protocol.json) freezes the source specification, authoring script, parsed cases and the scanned prior-evidence inventory. The NFC/case-insensitive scan found no exact reused full input or principal person/organization value in that inventory. It reports two short substring collisions (`706` and `5938`); matches inside metadata can be incidental. It is not semantic deduplication or proof of independence. No model was used for this scan.

## Evidence and next execution boundary

- [Specification](review-first-validation-v1/spec.md): scope, review-first rule and comparison limits.
- [Authored source](review-first-validation-v1/source.json) and [parsed cases](review-first-validation-v1/cases.json): full input, exact source UTF-16 offsets and type/category mapping.
- [Review ledger](review-first-validation-v1/review-ledger.json): all 24 pending, bound to text and annotation digests.
- [Verification](review-first-validation-v1/verification.json): source, offsets, category counts, output hashes and unchanged production/historical evidence.

No Underthesea, BigMed or shared-detector inference has been run on the new cases. Do not run models until all proposed expectations have been explicitly reviewed. Record future answers separately; corrections require a versioned amendment and fresh bindings, not mutation of frozen source or inferred acceptance. Once review is complete, use the pinned candidates, corrected shared policy and canonical source mapping without tuning on the new results. Preserve the previous release failures alongside any new outcomes.

This task changes only development evaluation artifacts/documentation. No production/UI/dependency/pack changes, model downloads, training, background requests or real-input collection occurred. Preparation and verification scripts passed; application tests were not rerun for this data-only preparation.

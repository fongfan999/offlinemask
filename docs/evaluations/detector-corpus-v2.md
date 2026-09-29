# Focused corpus expansion, batch 2

Added **70 explicitly authored scenario families**, concentrating on six thinly covered types: birth dates, identity numbers, passports, CVV/CVC/CID, PINs and API keys. Each partition gains four families per target type and eleven ordinary-only families. No private user input, existing evaluation text or model predictions are used as training labels.

The combined corpus now has **161 records across 158 families**. The development family minimum is met, but every per-type quota and the training family minimum still fail. All 161 records remain pending independent human review. **Training readiness remains false.**

| Partition | Families | Required minimum | Ordinary-only families |
| --- | ---: | ---: | ---: |
| Training | 65 | 200 | 21 (32.3%) |
| Development | 93 | 80 | 30 (32.3%) |
| Final holdout | 0 | Separately authored later | 0 |

## What the examples add

Cases include partial/written birth dates, conflicting old/new identifiers, expired or unverified passports, spaces and line breaks inside labelled fields, leading-zero secrets, multiple credential occurrences, quoted strings, JSON/configuration values and API keys embedded in a URL. Labels preserve full opaque values and meaningful suffix punctuation. Uncertainty about an identifier's correctness does not make the supplied value ordinary.

Ordinary examples deliberately include nearby numbers and sensitive-field vocabulary: fees, attempt counts, timeouts, document dates, page numbers, field widths, format instructions, redacted placeholders and missing-value descriptions. These are proposed annotations for review, not evidence that a model handles the cases correctly. Simulated extracted text does not establish file-format support.

Examples are explicitly partitioned before model use. The new batch has no representation variants; historical NFD/emoji variants retain their original family counts. Split IDs and exact/template/value checks are structural protections, not proof that similar semantic situations are independently represented. Human review must check that distinction.

## Preventing inflated coverage

The versioned wrapper reuses the frozen batch-one review audit and additionally rejects duplicate normalized text, entity-masked templates or scenario IDs counted as different families **within the same partition**. Renaming a family or substituting another numeric value can no longer inflate its quota. Multiple representations remain valid when grouped under the same family.

The audit now emits per-partition family and per-type deficits. Family and type deficits overlap and must not be summed into a record target. Additional positive examples require ordinary examples to maintain balance. Reaching the overall family minimum alone does not qualify a partition.

Existing requirements remain: exact annotation/source/contract digests for review, a corpus-wide semantic split review, no exposed final holdout, and no approval inferred from an author's inline metadata. No independent reviewer identity or approval has been fabricated. The historical seed, batch-one sources/results and production fingerprint are verified unchanged.

## Validation and review handoff

The combined corpus passes the structural checks and comparisons against all 362 observed regression/challenge cases. **134 tests pass**, including renamed-template quota inflation, scenario reuse, numeric ordinary-text duplication, family counts and honest deficit reporting. These checks do not validate annotation semantics or detector accuracy.

Generated local artifacts are under `artifacts/detector-corpus-v2/`:

- `review.md`: every annotated record, rationale, exact UTF-16 spans and category mapping.
- `review-ledger.json`: pending per-record and split reviews, bound to exact digests.
- `audit.json`: coverage deficits, pending reviews and readiness status.
- `corpus.json`: the combined authored records.

The [frozen results](detector-corpus-v2/results.json) preserve source/output hashes, counts, test evidence and blockers. A reviewer should record boundary/category/ordinary-text issues, correct source in a new version and regenerate the review pack. An approval for the previous corpus does not approve this expanded corpus; unchanged per-record approvals may be carried forward only if their digests match, while the corpus-wide split review must be renewed.

```sh
# Use a destination that does not exist.
mise exec -- node scripts/detector-corpus-v2/prepare.mjs artifacts/corpus-v2-review-new

# Validate a real review ledger in another new directory.
mise exec -- node scripts/detector-corpus-v2/prepare.mjs artifacts/corpus-v2-reviewed /absolute/path/to/review-ledger.json

mise exec -- pnpm test
```

No runtime, application UI, dependency, installed pack, model weight, network behavior or telemetry change. There is no training run or accuracy claim.

Remaining work: at least 135 more training families to reach the family minimum, further examples for every private type in both partitions, preservation of ordinary-text balance, and genuine independent annotation/split review. The reviewer is not yet assigned. Hardware diagnostics remain separate evidence; they do not override the data gates.

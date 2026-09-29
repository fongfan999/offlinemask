# Single-detector corpus preparation, batch 1

This batch adds **60 authored synthetic scenarios** and two Unicode variants to the previous 29-record seed. It introduces the first training partition and a review pack with exact UTF-16 spans. **Training readiness remains false.** Neither corpus quotas nor independent annotation/split review are complete; no training or model inference was run.

## Composition

| Partition | Records | Distinct families | Ordinary-only families | Required families |
| --- | ---: | ---: | ---: | ---: |
| Training | 31 | 30 | 10 (33.3%) | 200 |
| Development, including original seed | 60 | 58 | 19 (32.8%) | 80 |
| Final holdout | 0 | 0 | 0 | Separately authored later |

All 19 target private types appear in both training and development. Coverage remains sparse: training has 1–7 families per type, development 2–7, against the unchanged minimum of 20 per type in each partition. Two NFD/emoji variants retain their original families and do not inflate scenario counts. The corpus contains 91 records across 88 families, not 91 independent scenarios.

Examples cover beneficiary amendments, courier addresses, supplier reconciliation, identity reissue, refund tracing, compromised credentials, IPv4/IPv6, trustees and property inspection. Ordinary examples cover missing fields, placeholders, operational dates, fees, rates, counts, schema names, versions and unlabeled numeric cells. Complete opaque passwords override embedded email/phone shapes. Card/CVV/PIN remain under the existing “other” category; identifiers retain field-specific types. Labelled card numbers are treated as sensitive without requiring a valid checksum.

The scenarios and values were explicitly authored for this batch. No user records, public dataset rows, model-generated predictions or old evaluation text were imported as training labels. Invented names/identifiers may coincidentally match real values; no claim is made that every invented numeric value is unassigned. These are development assumptions about possible workflows, not observed banking usage. Table-like and simulated extraction text does not qualify Excel, OCR or PDF import.

## Stronger readiness and review

The original auditor allowed author-reviewed records to satisfy its review prerequisite. The new version keeps the historical tool/results unchanged and requires a separate, matching review ledger before counting any record as independently reviewed. The original seed's author review is retained in its source but does not satisfy this stronger gate.

Each approval is bound to a digest of the entire source record and capability contract, including annotations, rationale, partition and provenance. Changes invalidate the approval. Review checks cover provenance, complete values, boundaries, types/categories and unmarked ordinary text. A separate corpus-wide approval covers semantic scenario, template, value and regression separation. A changed corpus invalidates that split approval.

Unknown/duplicate entries, stale approvals, same-author approvals, non-human reviewer declarations and incomplete approval checks are rejected. Rejected and pending records cannot qualify. A reviewer declaration is **not identity authentication or proof of actual review**; the project must arrange genuine independent review. No reviewer was contacted and no independent review is claimed. All **91 records remain pending**.

The generated `review.md` provides annotated source, rationale, exact offsets and category mapping. The accompanying `review-ledger.json` starts pending, with blank reviewer/date/note fields. A reviewer should record problems before approval. Correct source annotations and generate a new versioned review pack rather than editing generated text or carrying approvals across changed hashes. Do not put real private text in the review workflow.

## Separation and verification

The preparation validates against all **362 observed regression/challenge cases**, rejecting normalized text reuse and entity-masked template reuse. It also rejects cross-partition family, template, normalized text, masked template, scenario ID and normalized entity-value reuse. Value checks retain digits but ignore case, accents and separators, including values reused under another type.

These are conservative syntactic checks. They do not find every paraphrase, prove scenario independence, canonicalize every possible IP spelling or certify correct annotations. Related workflows across partitions still require semantic review. No final holdout is generated or exposed; the preparation tool rejects a final partition. The historical 29-record seed and previous evidence remain unchanged.

**131 tests pass**, including nine new tests for review invalidation, author-review bypasses, rejection, split approval, value/template leakage, family counts and Unicode boundaries. A tiny test-only contract exercises readiness success; the real quotas are never reduced. The preparation verifies the frozen production and original data-preparation hashes. No runtime, dependencies, UI, installed pack, telemetry, downloads or automatic Internet checks change.

## Reproduction

```sh
# Destination must not exist; each run gets a separate directory.
mise exec -- node scripts/detector-corpus-v1/prepare.mjs artifacts/corpus-review-new

# After a real reviewer completes a matching ledger, validate it in another directory.
mise exec -- node scripts/detector-corpus-v1/prepare.mjs artifacts/corpus-review-approved /absolute/path/to/review-ledger.json

mise exec -- pnpm test
```

No model assets, Python or network access are needed. The create-only [frozen results](detector-corpus-v1/results.json) preserve source/output hashes, exact composition, pending reviews and all remaining blockers. The checked-in authored source is `scripts/detector-corpus-v1/records.mjs`; generated review artifacts live under ignored `artifacts/detector-corpus-v1-final/` and can be recreated from that source. Extend future data in a new batch rather than editing this frozen evidence.

Next data work: the family minima alone require at least 170 more training families and 22 more development families. Per-type coverage and the ordinary-negative balance will require further planning and potentially more families; do not combine implausible numbers of private fields just to meet quotas. Independently review all annotations and split semantics before training. Runtime follow-ups and complete trained-pipeline qualification remain separate requirements; this batch does not make the model or text feature release-ready.

# Complete values and field meaning: measured improvement

15 September 2026. **Implemented in the shared production policy.** The existing model pair and dependency versions remain unchanged. The work improves explicit identifiers, credentials and address boundaries without adding a download or another model. It does not select the release model.

## What users get

- Labelled passport and tax identifiers work under the existing banking/identity choice, including without a recognition pack. The category tooltip now includes them. A tax ID is no longer treated as a phone when its explicit field label identifies it.
- Bounded credentials in prose retain their full value and punctuation, and are assigned to “other” even when the model mistakes a piece for email or a name. Ordinary password instructions and missing-value descriptions are kept.
- A house number before `đường`, `phố` or `đại lộ` stays with its street. One supported wrapped address component can be joined without crossing blank paragraphs or taking a quantity from another field. Existing textual address evidence is still required.

The six choices, card placement under “other,” optional pack, manual download/update policy, session lifecycle and review controls remain intact. This adds no tracking, upload, private-input logging, correction collection or new dependency. [Decision 0016](../decisions/0016-complete-values-and-field-meaning.md) defines supported syntax and limits.

## Before and after

The same pinned pair ran twice in separate Node CPU processes over 262 existing regression cases and the already observed 100-case challenge. Both final runs completed all 362 cases with no errors and identical outputs. Model-derived preview predictions were identical to the pre-change evidence for every case: the gains come from shared policy, not a changed checkpoint or inference configuration.

Only the incumbent pair was rerun for this policy change. Do not compare its new score with another candidate's old-policy score as a new model ranking. A subsequent fair candidate comparison must apply the updated policy to every candidate; this iteration does not justify the pair as the final architecture.

| Measure | Before | After |
| --- | ---: | ---: |
| Regression complete values | 315/328 | 316/328 |
| Regression banking-only values | 32/33 | 33/33 |
| Regression other-only values | 35/41 | 37/41 |
| Challenge complete values | 113/142 | 131/142 |
| Challenge name-only values | 39/39 | 39/39 |
| Challenge address-only values | 6/13 | 13/13 |
| Challenge username-only values | 2/6 | 6/6 |
| Challenge password-only values | 2/6 | 6/6 |
| Challenge API-key-only values | 1/3 | 3/3 |
| Regression short ordinary characters masked | 192/7,678 | 192/7,678 |
| Challenge short ordinary characters masked | 47/5,426 | 47/5,426 |
| Affected ordinary negative cases: regression / challenge | 23/63 / 5/24 | 23/63 / 5/24 |

There is one additional complete value in the regression corpus and 18 in the challenge, with zero complete-value losses, zero selected-category completeness losses, zero reductions in all-options partial coverage, and no newly masked ordinary lexical positions. Selected-category completeness gains are three and 23 respectively. The unchanged false-positive totals are not zero false positives; existing unwanted masking remains a release issue.

The challenge now has 131 complete and 11 partial values, with none wholly missed. The remaining incomplete annotated values are three IPv6 occurrences, three written-out birth-date expressions and five organization-name occurrences. These are repeated representations of a smaller number of records; they are not independent customers. The regression corpus still has 12 partially covered values and fails the existing excess-masking/negative-case limits. The challenge still falls below the 95% overall floor and fails other-type/negative-case gates.

## Actual no-pack behavior and category scope

Actual `createDetectionEngine` calls were also repeated without a model root for email, phone, banking and all three together. All completed without loading/progress events or request failures. There are no ordinary or unchecked-category lexical characters masked by these local-scope checks after the change.

| No-pack selection on the challenge | Before | After |
| --- | ---: | ---: |
| Email | 10/10 | 10/10 |
| Phone | 12/12, plus a tax-ID false positive in three variants | 12/12, tax value preserved |
| Banking against the frozen broad challenge | 25/34 | 31/34 |
| All three against the frozen broad challenge | 50/56 | 53/56 |

The remaining three banking-target occurrences are cards. The frozen challenge assigns them to banking, whereas the product still explicitly puts card information under “other.” They remain covered when that current category is selected with the pack. We preserve the historical annotation and disclose the mismatch; we do not silently move the checkbox meaning or call it a model failure. Against the now-documented local account, identity, passport, tax, transaction and customer-code scope, all 31 annotated banking occurrences are complete here. This is evidence for those examples, not universal identifier coverage.

## Verification and experiment history

- 100 unit tests pass, including eight new tests for full credentials, ordinary prose, Unicode offsets, category precedence, bounded identifiers and guarded address continuation.
- The production build and type checks pass. The existing OpenMed browser `crypto` externalization warning remains; no new browser API or package was introduced.
- All 14 real-model regression checks pass with fetch blocked, including original-preservation checks and the long-tail case. These checks run on Node CPU.
- Both final 362-case candidate runs match exactly and preserve model-derived outputs. Raw runs and logs are under ignored `artifacts/policy-hardening-v2/`; the [final JSON](policy-hardening-v2-results.json) retains hashes, full per-case predictions and gains/losses.
- A separate original-policy replay checks all 2,172 category selections across 362 cases and finds no loss of partial own-category coverage on the 470 annotated occurrences; see the [selection audit](policy-hardening-selected-audit.json) and its [protocol](policy-hardening-selected-audit-protocol.json). It reconstructs the old core from verified sources and compares both policies on the same real model-derived detections, rather than trying to recover lost model alternatives from a masked preview.

The initial [v1 experiment](policy-hardening-v1-results.json) improved the challenge to 127/142. Its remaining observed wrapped-address failures motivated a bounded repair, new unit tests, and a separate [v2 protocol](policy-hardening-v2-protocol.json). The final improvement to 131/142 is therefore development evidence on observed cases, not a fresh validation score. Both protocols preserve the original policy source. [V1 source snapshots](policy-hardening-v1-sources.json) preserve the two files later changed by the wrapped-address repair; the historical scripts and evidence are retained.

No original challenge annotation, older evaluation result, checkpoint, tokenizer, model window or dependency version was changed. Names and cards retain their categories; the intentional product-scope change is bounded labelled passport/tax support within the existing banking choice.

## Reproduction and limits

Use the already available pinned development model files; the evaluation downloads nothing. In an evidence workspace without existing output files:

```sh
mise exec -- node scripts/policy-hardening-v2/evaluate.mjs 1
mise exec -- node scripts/policy-hardening-v2/evaluate.mjs 2
mise exec -- node scripts/policy-hardening-v2/report.mjs
mise exec -- node scripts/policy-hardening-selected-audit.mjs
mise exec -- pnpm test
mise exec -- pnpm build
mise exec -- pnpm test:models
```

Writers refuse to overwrite frozen evidence. Historical protocols intentionally reject changed production sources; reproduce them using the corresponding source snapshots in an isolated working copy. The v2 protocol verifies unchanged dependencies, old baselines and challenge sources as well as the changed production files.

All fixtures are synthetic and developer-authored; independent annotation review, a separate final validation set, representative banking workflows and performance budgets remain outstanding. These CPU runs are not a new packaged-WebKit/native-runtime or disconnected-install qualification. Address line simulation is not OCR, PDF localization or Excel support. No new desktop installer or release was produced.

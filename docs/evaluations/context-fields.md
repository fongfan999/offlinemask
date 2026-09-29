# Contextual fields: measured improvement

17 September 2026. **Implemented in the shared production policy.** This closes the targeted IPv6, written birth-date and organization-boundary gaps on the observed challenge, with fewer ordinary characters masked. It does not select a release model or establish real-world coverage.

## Changes

The shared policy now uses the small MIT-licensed `ipaddr.js` parser for IPv6 validation, calendar validation after explicit birth-date labels, and bounded organization-name completion supported by a label or model evidence. Explicit operational date, version, HTTP-code and count fields can suppress conflicting guesses. Complete opaque credentials retain precedence. [Decision 0017](../decisions/0017-contextual-fields.md) documents the syntax bounds and dependency provenance.

The production category mapping, model assets, optional-pack requirements and actual no-pack detection path are unchanged. No UI, telemetry, private-input storage, network call, download or automatic update behavior was added.

## Before and after

Two separate Node CPU runs use the same pinned model pair on 262 regression cases and the already observed 100-case challenge. All 362 cases complete without errors, with identical repeat outputs. Model-derived predictions are identical to the previous [policy-hardening-v2 results](policy-hardening-v2-results.json).

| Measure | Before | After |
| --- | ---: | ---: |
| Regression complete values | 316/328 | 317/328 |
| Regression other-only values | 37/41 | 38/41 |
| Challenge complete values | 131/142 | 142/142 |
| Challenge other-only values | 23/34 | 34/34 |
| Regression short ordinary characters masked | 192/7,678 | 192/7,678 |
| Challenge short ordinary characters masked | 47/5,426 | 24/5,426 |
| Regression negative cases with unwanted masking | 23/63 | 23/63 |
| Challenge negative cases with unwanted masking | 5/24 | 4/24 |

The 11 completed challenge occurrences are three IPv6 values, three written birth-date expressions and five organization names. These include multiple representations of the same records, not independent customers. Completion can mean recovering a missing boundary word or prefix, not discovering an entirely missed value.

There are zero full-value losses, zero selected-category completeness losses, zero partial-coverage reductions and zero newly masked ordinary lexical positions. Comparing exact covered positions for every annotated occurrence also finds no lost private character under all options or its own category; this is stronger than comparing aggregate totals alone. Actual no-pack email/phone/banking runs match both each other and the previous results exactly.

The frozen challenge still labels three card occurrences as banking, while the product assigns cards to “other.” They are complete with all options or the current “other” option, but not banking alone. Historical annotations and checkbox meanings are preserved, and the mismatch remains disclosed.

## Remaining release issues

**Neither corpus passes the existing full screening gate.** The regression corpus still has 11 incomplete private values, an additional address with incomplete own-category coverage, and substantial ordinary-text masking. Examples include lowercase/unaccented names, complex alley addresses, IPv4 boundaries and a birth-date phrasing outside the new explicit-label rule. Four ordinary negative challenge cases still contain unwanted masking; more unwanted characters also occur in mixed private/ordinary records.

All material is developer-authored synthetic data that has already been inspected. The 142/142 result is a development regression result, not 100% real-world coverage, independent validation or evidence of banking readiness. Only the incumbent pair was rerun: do not rank it against other candidates using their old-policy scores. Fair candidate comparison, independent annotation and final validation, and packaged desktop/offline/resource qualification remain outstanding.

## Verification and reproduction

- All 108 unit tests pass, including eight new cases covering malformed IPv6, NFD source offsets, invalid dates, ordinary facts, organization bounds, credential precedence and model requirements.
- Type checks and the production build pass. The existing OpenMed browser `crypto` externalization warning remains.
- All 14 real-model regression checks pass with fetch blocked, including original preservation and long input.
- The [protocol](context-fields-v1-protocol.json) fingerprints source, dependencies, fixtures, baseline evidence and evaluation scripts, and preserves the changed pre-experiment files. The [results](context-fields-v1-results.json) retain per-case predictions, category selections and comparisons; raw-run hashes identify ignored artifacts under `artifacts/context-fields/`.

With the pinned models already available locally, run in an evidence workspace without existing output files:

```sh
mise exec -- node scripts/context-fields/evaluate.mjs 1
mise exec -- node scripts/context-fields/evaluate.mjs 2
mise exec -- node scripts/context-fields/report.mjs
mise exec -- pnpm test
mise exec -- pnpm build
mise exec -- pnpm test:models
```

Evaluations forbid fetch and download nothing. Writers refuse to overwrite frozen evidence. Old protocols intentionally reject the current changed files; reproduce historical runs in isolated copies using their source snapshots. No new installer, native runtime migration or file-format adapter was produced.

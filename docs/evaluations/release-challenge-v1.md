# Release challenge v1: results and decision

15 September 2026. **No configuration qualifies under the frozen challenge. Keep the installed pack and production detector unchanged.** The new evidence identifies specific contextual, boundary and scope problems; it does not support choosing a model by aggregate score.

## What was tested

The [specification](release-challenge-v1-spec.md), [fixtures](../../tests/fixtures/release-challenge-v1.json), scripts and dependency/core fingerprints were frozen before inference. Five existing configurations each ran twice in separate sequential Node CPU processes. All ten runs completed all 100 cases without request failures; each configuration produced identical outputs across its two runs. All 92 unit tests passed, including five new annotation/scoring tests.

The corpus has 142 annotated private-value occurrences across 17 types, 65 designated critical occurrences, and 24 ordinary negative cases. It contains 24 positive record families in prose, labelled text and simulated extraction, plus four long variants, and 24 negative families: **48 families, not 100 independent records**. All were authored by the developer. No independent reviewer or banking practitioner validated the annotations. It is now an observed challenge set, not available for future fresh-validation claims.

No old full text was duplicated. One standard synthetic test card value was already present in regression material, as disclosed by the freeze. Long-case boilerplate uses the existing fixture helper. Related representations stay together; the earlier 262 cases remain a separate observed regression corpus.

## Complete-engine comparison

The table uses the frozen financial challenge policy. Its scope is deliberately broader than the current lightweight UI promise; read the scope differences below before interpreting category failures. “Critical failures” includes incorrect selected-category coverage, even when all-options masking hides the whole value.

| Configuration | Complete values | Name-only | Address-only | Critical failures / 65 | Short ordinary characters masked | Negative cases affected / 24 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| SuperClinical | 106/142 | 33/39 | 6/13 | 15 | 25/5,426 (0.46%) | 2 |
| mSuperClinical | 101/142 | 37/39 | 5/13 | 15 | 26/5,426 (0.48%) | 3 |
| Existing pair | 113/142 | 39/39 | 6/13 | 15 | 47/5,426 (0.87%) | 5 |
| BigMed (native) | 122/142 | 34/39 | 12/13 | 11 | 40/5,426 (0.74%) | 1 |
| Underthesea INT8 | 103/142 | 36/39 | 6/13 | 15 | 0/5,426 (0.00%) | 0 |

The pair covers 113/142 values completely, with 29 partial values and none wholly missed. “Something detected in every private value” therefore conceals substantial remaining exposure. BigMed covers 122/142, with 13 partial values and seven wholly missed. Compared with the pair, BigMed gains 16 complete values and loses seven; five losses are names, one is a passport value and one is an API-key value. It also has five critical all-options or selected-category partial-coverage regressions.

The ranking changes with the corpus: BigMed was below the pair on the [previous observed comparison](native-preprocessing-comparison.md), but above it on this challenge. This is a reason to preserve per-type evidence and independent final validation, not to average the sets until a preferred checkpoint wins.

The pair catches all 39 name occurrences here, while BigMed catches 34 under the name category. BigMed catches 12/13 address occurrences versus 6/13 for the pair. Underthesea masks no ordinary characters on these cases, but leaves 30 private values wholly missed and is not a broad private-information detector in this configuration. None passes even the original overall 95% floor, irrespective of the additional category-policy differences.

## Selected-category detail

These counts apply the predeclared challenge categories, with the complete detector filtered by each category. They are not a simulation of the application’s no-pack path. Both model-derived and complete-stage outputs, each category’s actual predicted spans, and all per-case outcomes are retained in the [results JSON](release-challenge-v1-results.json).

| Type | SuperClinical | mSuperClinical | Pair | BigMed | Underthesea |
| --- | ---: | ---: | ---: | ---: | ---: |
| person | 33/39 | 37/39 | 39/39 | 34/39 | 36/39 |
| address | 6/13 | 5/13 | 6/13 | 12/13 | 6/13 |
| email | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 |
| phone | 12/12 | 12/12 | 12/12 | 12/12 | 12/12 |
| account | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 |
| identity | 9/9 | 9/9 | 9/9 | 9/9 | 9/9 |
| passport | 0/3 | 0/3 | 0/3 | 0/3 | 0/3 |
| transaction | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| tax | 0/3 | 0/3 | 0/3 | 0/3 | 0/3 |
| card | 0/3 | 0/3 | 0/3 | 0/3 | 0/3 |
| customer | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| birthdate | 2/6 | 0/6 | 3/6 | 3/6 | 0/6 |
| organization | 2/7 | 0/7 | 2/7 | 4/7 | 6/7 |
| username | 2/6 | 2/6 | 2/6 | 6/6 | 2/6 |
| password | 2/6 | 2/6 | 2/6 | 6/6 | 2/6 |
| apikey | 1/3 | 1/3 | 1/3 | 1/3 | 1/3 |
| ip | 3/6 | 0/6 | 3/6 | 3/6 | 0/6 |

## Scope differences and the actual lightweight path

The challenge asks for labelled passport/tax identifiers and treats card numbers as banking information. The current [option definitions](../../src/core/detection/options.ts) promise only labelled accounts, CCCD/CMND, transaction and customer codes without a pack; they explicitly place card information under “other.” Consequently, the frozen card banking-category failure is a **challenge/UI policy mismatch**, not a claim that the current card behavior violates its documented category. Passport and tax identification are capability gaps against the broader challenge, not broken promises of the current lightweight description. No annotations or gates were changed after observing this mismatch.

All four OpenMed configurations cover all three card occurrences when the currently documented “other” category is selected; Underthesea covers none. These are diagnostics from saved predictions, not a revised passing benchmark. The mismatch must be resolved in the supported-capability specification before release ranking.

A separately [frozen audit](release-challenge-local-scope-protocol.json) runs the actual `createDetectionEngine` with no model root, for each of the three local categories and all three together. Fetch is blocked and any loading/progress event fails. Two passes over the same cases produce identical outputs with no request errors. These are repeated observations of the same families, not new validation data.

| Actual no-pack selection | Complete target values | Interpretation |
| --- | ---: | --- |
| Email | 10/10 | All annotated emails covered; no excess lexical masking |
| Phone | 12/12 | Also masks the labelled synthetic tax ID in three representations |
| Banking, broad challenge | 25/34 | Misses three passport, three tax and three card occurrences outside the narrower current no-pack promise |
| All three local categories, broad challenge | 50/56 | Tax value gets masked as a phone; passport and card values remain |

Restricting the banking diagnostic to the actually advertised account/CCCD-CMND/transaction/customer types gives **25/25 complete occurrences** on this set. This scoped diagnostic does not establish coverage of other identifier types. The phone recognizer’s handling of `Mã số thuế: 0318472956` shows why explicit field meaning and selected-category preservation matter: numeric shape alone assigns the wrong meaning. The phone audit remains within the frozen aggregate excess-masking allowance (30/7,334 lexical characters), but that does not make this individual false positive correct. Full evidence: [local-scope results](release-challenge-local-scope-results.json).

## Concrete development priorities

1. Freeze the product capability map before the next model-ranking experiment. Preserve the documented current scope until changes are explicitly implemented; decide card placement and additional banking identifiers consistently across labels, local recognition and contextual providers. A broader financial release target must not be implied by a generic category title.
2. Strengthen field semantics and whole-value handling. The shared path does not recognize passport/tax labels, a tax value can be classified as a phone, and passwords/API keys in prose lose punctuation or get split across incompatible categories. The current structured credential reader requires `:` or `=`; prose without those separators relies on the model. Develop explicit bounded recognition/reconciliation against new development cases, with ordinary-text negatives and no hard-coded fixture values.
3. Keep model-driven names and addresses as a separate selection problem. BigMed’s address gains do not erase name losses; the pair’s name gains do not solve critical values or address boundaries. Test a reproducible candidate or a justified targeted development path, rather than adding another ensemble by default.
4. After development changes, use this set as regressions and require separately authored/reviewed final validation. Qualify the actual exported runtime, offline packaged app, resource costs and file adapters separately.

These are next development priorities, not changes shipped by this experiment. No model is selected, category is silently moved, capability is expanded, or current failing configuration labelled release-ready.

## Reproduction and evidence

Use the already installed local native-tokenizer environment and already verified model artifacts; this task downloads neither. For each candidate `small`, `large`, `combined`, `bigmed-native`, `underthesea`, run rounds `1` and `2`:

```sh
OFFLINEMASK_EVAL_PYTHON=/absolute/path/to/evaluation/bin/python mise exec -- node scripts/challenge-core/evaluate.mjs combined 1
OFFLINEMASK_EVAL_PYTHON=/absolute/path/to/evaluation/bin/python mise exec -- node scripts/challenge-core/evaluate.mjs combined 2
mise exec -- node scripts/challenge-core/report.mjs
mise exec -- node scripts/challenge-local-scope.mjs --run
```

Raw runs/logs live in ignored `artifacts/release-challenge-v1/`; the results JSON retains the source protocol, raw-file hashes, both stages and every case. Writes refuse to overwrite existing evidence. Reproduction requires a fresh evidence workspace or preserving existing outputs before a separately documented replay. The unused preliminary freeze is retained as [preflight evidence](release-challenge-v1-preflight-protocol.json): a reporter syntax error was fixed before any inference, then sources were frozen again. No scored source or annotation was changed.

Production core, app UI, native configuration, model assets and dependency versions remain unchanged from the parent protocols. The work adds developer evaluation files and documentation only. Fetch blocking is a harness control, not an OS-level proof of no attempted network connections by a packaged application. No build, packaged-runtime, new hardware-performance, real OCR, Excel or PDF qualification is claimed. No telemetry, private-input logging, uploads, correction collection or automatic update check was added.

# Structured-value repair — 19 September 2026

The shared detector closes the targeted structured gaps without training, replacing weights, downloading assets, changing checkbox scope or adding UI. The production pair and compact Underthesea candidate both pass before/after regression checks on the same 362 observed cases. The fixes are shared by current text processing; they do not qualify future Excel, image or PDF extraction.

## Changes

- Explicitly labelled cards (13–19 digits), CVV/CVC (3–4) and PIN (4–6), with exact full-value spans and ordinary-number/malformed-value contrasts.
- Canonical labelled IPv4 through the existing ipaddr.js parser; no address guessing from ordinary versions.
- Valid written/numeric birthdays after a bounded named-person bridge, keeping intervening name predictions.
- Account cells beneath explicit TSV headers, without consuming amounts or neighbouring columns.
- Existing opaque-credential precedence and NFC/NFD source positions remain intact. Cards/security codes, IP and birthdays remain “other,” which still requires a pack. Only the account-column fix expands the actual no-pack banking route.

## Method and evidence

The [specification](structured-gaps-v1/spec.md) was written before implementation. The [protocol](structured-gaps-v1/protocol.json) froze final tested source, prior source snapshots, fixtures, runtime and baseline output hashes before model inference. The [results](structured-gaps-v1/results.json) preserve summaries, exact coverage gains/losses and raw run hashes. Prior protocols/results were not changed. Both candidates ran sequentially, using pinned local assets with fetch forbidden; no optimizer, download or telemetry was used.

For each case, real model-derived Detection arrays passed through reconstructed, hash-verified before-policy source and current policy. Before outputs had to exactly reproduce saved all-options and each of six individual-category previews on four routes: unrestricted model, contextual predictions only, empty-model rules, and raw local helper. This is not a reconstruction from masked output spans. There were 724 actual case executions and 2,896 route comparisons. Contextual-only and rule-only remain diagnostic configurations.

Tests: **146 passed**, including seven new tests with multiple positive/negative cases. `pnpm typecheck` passed. Checks cover decomposed Unicode/emoji offsets, explicit label boundaries, malformed whole values, ordinary numeric instructions, table termination, credential precedence and no-pack routing. No new packaged desktop resource or UI qualification was performed.

## Coverage

These totals count fully covered annotated values with all options selected. The additional column requires coverage under each value's own selected category. Denominators and failed screening thresholds are unchanged.

| Configuration | Corpus | Before full | After full | After own category |
| --- | --- | ---: | ---: | ---: |
| Current pair | Regression | 317/328 | 320/328 | 319/328 |
| Current pair | Challenge | 142/142 | 142/142 | 142/142 |
| Underthesea INT8 | Regression | 310/328 | 320/328 | 318/328 |
| Underthesea INT8 | Challenge | 132/142 | 138/142 | 138/142 |

Across all four evaluated routes and both candidates: **zero complete-coverage losses, zero own-category losses, zero lost non-whitespace sensitive positions, and zero newly masked ordinary positions**. This means no additional overmasking from these changes on the evaluated examples; existing overmasking is not zero. The unrestricted pair still masks 192 ordinary lexical positions in regression and 24 in challenge; Underthesea has 267 and zero respectively. Both still fail the existing screening gates.

With model predictions restricted to names, addresses and organizations, the pair increases from 310 to 320 regression values and 136 to 142 challenge values. Underthesea's narrowed and unrestricted outputs are identical. Rules alone increase from 184 to 194 and 91 to 97. The rules close specified syntax gaps; they cannot replace contextual name/address recognition.

A separate [actual-engine check](structured-gaps-v1/local-engine.json) executes the three supported no-pack options rather than reporting unfiltered local helper totals. Coverage is **73/73 regression** and **53/53 challenge**, with zero ordinary lexical positions masked and no model loading or fetch. Its source hash is recorded in that result. These selected-scope denominators exclude name/address/other values; the report also preserves full-scope scoring.

## Remaining decision

No candidate is selected for release. Underthesea still misses or misclassifies lowercase/unaccented/ethnic/uppercase and NFD names, some address boundaries, and one unaccented organization challenge value. Equal aggregate full coverage does not establish equivalent category accuracy. Investigate the compact candidate's Unicode/tokenizer mapping and boundary failures under unchanged weights next; distinguish recoverable integration errors from classifier limitations. Custom MiniLM training remains deferred.

All fixtures and added unit cases are developer-authored synthetic material. The 362 evaluation cases were already observed. These results establish regressions and specific repairs, not independent validation, 100% coverage or financial-industry readiness. No user content or corrections were collected.

## Reproduction

Use the pinned local assets and existing tokenizer evaluation environment. Preserve `artifacts/pretrained-scope/{combined,underthesea}.json`, whose hashes are frozen here, or restore those exact historical artifacts. The old before-source capsule is retained inside the checked-in protocol. Commands refuse to overwrite existing run/report files; use a separate checkout/output arrangement when reproducing published artifacts. Do not refreeze or edit historical protocols to accommodate changed source.

```sh
OFFLINEMASK_EVAL_PYTHON="$PWD/artifacts/tokenizer-evaluation-env/bin/python" mise exec -- node scripts/structured-gaps-v1/evaluate.mjs combined
OFFLINEMASK_EVAL_PYTHON="$PWD/artifacts/tokenizer-evaluation-env/bin/python" mise exec -- node scripts/structured-gaps-v1/evaluate.mjs underthesea
mise exec -- node scripts/structured-gaps-v1/report.mjs
mise exec -- node scripts/structured-gaps-v1/local-engine.mjs
mise exec -- pnpm test
mise exec -- pnpm typecheck
```

# Address completion evaluation — 10 September 2026

The completion policy improves full addresses while keeping the existing pack. It does not establish production accuracy. The final unseen set is small and synthetic; earlier sets were used to identify and repair defects.

## Current pair: before → after

Both scores use the same predictions. The baseline excludes completion additions; the candidate applies `completeAddressBoundaries` before category filtering and span transformation. Every non-whitespace character of each annotated address must be covered. Ordinary-character counts measure unnecessary masking of letters, numbers and combining marks.

| Set | Cases | Complete addresses | Address-only complete | Additional ordinary characters masked |
| --- | ---: | ---: | ---: | ---: |
| Earlier model comparison | 66 | 10/17 → 16/17 | 10/17 → 16/17 | 0 |
| Earlier reliability cases | 12 | 0/2 → 2/2 | 0/2 → 2/2 | 0 |
| First new set | 24 | 9/19 → 18/19 | 9/19 → 18/19 | 0 |
| Second new set | 16 | 7/14 → 12/14 | 7/14 → 11/14 | 0 |
| Final unseen check | 12 | 4/9 → 9/9 | 4/9 → 9/9 | 0 |

All 130 current-pair requests completed. No additional ordinary characters were masked by the final policy in these sets; existing model false positives remain. Names, emails, phones and banking identifiers were scored separately, not counted as correct merely because a different category masked them.

## Evaluation sequence

1. Inspect the known 66-case and 12-case diagnostic sets. Write `address-holdout.json` before scoring the initial policy.
2. The first new set exposes an extra `Tại` prefix before a city. Fix the general rule: a bare locality must begin at model evidence. This set is now development data.
3. Write `address-validation.json` before scoring that revision. It exposes unnecessary expansion of a model-labelled floor number from `4` to `tầng 4` in ordinary building prose. Require textual address evidence in the connected chain, not a bare number alone. This set is also now development data.
4. Write `address-final-check.json` before evaluating the final revision. All 9 annotated addresses are fully covered, without additional ordinary-character masking. No further policy tuning follows those results.

The final JSON records the policy hash, fixture hashes and before/after cases. These data are now observed; further tuning requires another independent check, ideally reviewed examples from real workflows rather than more synthetic text alone.

## Remaining misses

- An entirely undetected lowercase address cannot be repaired by a policy that requires address evidence.
- A numbered-lane case and a `số 5B` component remain incomplete.
- An NBSP-separated address remains incomplete despite correct tokenizer offset mapping.
- In one case, `Huế` is hidden with all options because of a name prediction; selecting only addresses does not cover it. The category-specific score exposes this difference.
- Existing model false positives, such as ordinary uppercase prose, remain. The policy is not a claim of anonymity or permission to share a result.

## Smaller-pack check

On the same 66-case comparison after applying the final completion policy:

| Configuration | Download assets | Complete entities | Complete names, all / name-only | Complete addresses |
| --- | ---: | ---: | ---: | ---: |
| Current pair | 1,407.7 MB | 87/97 | 35/39 · 35/39 | 16/17 |
| Small only | 475.3 MB | 78/97 | 26/39 · 20/39 | 16/17 |
| Large only | 932.4 MB | 77/97 | 35/39 · 35/39 | 11/17 |
| BigMed INT8 | 872.6 MB | 85/97 | 30/39 · 29/39 | 15/17 |

BigMed also fails to align `fresh-negative-unicode` in its developer-only adapter; this is recorded as an error, not dropped from evaluation. The production pair uses its separately verified sequential tokenizer alignment. Underthesea was not re-promoted for testing because its previously established broad-PII and integration gaps remain unresolved. No new weights were downloaded.

**Decision:** keep the current pack. Smaller downloads still sacrifice name coverage or broad detection reliability. Better addresses alone do not justify that tradeoff.

## Reproduction

With verified local development weights and the already downloaded BigMed candidate available:

```sh
mise exec -- pnpm test
mise exec -- pnpm typecheck
mise exec -- pnpm test:models
mise exec -- node scripts/check-tokenizer-offsets.mjs
mise exec -- node scripts/evaluate-address-policy.mjs combined
mise exec -- node scripts/evaluate-address-policy.mjs small
mise exec -- node scripts/evaluate-address-policy.mjs large
mise exec -- node scripts/evaluate-address-policy.mjs bigmed
```

All model checks disable network fetch. Reports are written to ignored `artifacts/address-policy/`. These comparisons use CPU inference and are not the desktop WASM performance results. [Decision 0008](../decisions/0008-address-boundary-completion.md) describes the production policy and the separate desktop benchmark.

## Desktop runtime measurement status

A separate native benchmark bundle was built with the final policy and the production worker/WASM runtime. Its inputs cover cold and warm short text, 2,000 characters, 10,000 characters, and the 50,000-character limit. Type-checking the benchmark entry point passed. The developer-only model directory uses hard links to verified existing weights under a separate app identifier.

The first unlocked run exposed a WebContent memory-limit termination during the 10,000-character case. Short timings alone do not establish reliability. After cleanup and yielding tokenizer preparation, the full 50,000-character desktop sequence completed. Peak footprint was 7.20 GiB and the longest request took 400.708 seconds, so runtime performance remains a release concern. See the [runtime investigation](2026-09-10-desktop-runtime.md) for captured timings, macOS memory evidence, and current status. CPU comparison/regression results above do not substitute for this measurement.

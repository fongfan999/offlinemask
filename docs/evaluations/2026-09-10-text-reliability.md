# Text positioning and review reliability — 10 September 2026

The existing pack now uses stricter source positioning, and missed text can be manually hidden in the preview. These changes improve transformation/review reliability; they do not establish production detection accuracy or justify changing the pack.

## Checks

- 47 fast tests pass, including manual source mapping across aliases and CRLF, grapheme selection, overlap expansion, keep choices, alias non-reuse after undo, RAM-only serialization, and complete-grapheme model windows.
- 120 real-tokenizer source mappings pass with network fetch forbidden: two pinned tokenizers × 12 synthetic inputs × five representations (original, NFD, nonbreaking spaces, literal special-token wrappers, and emoji plus repeated CRLF text). Every non-whitespace source unit must be covered. This caught and repaired single-NBSP handling before completion.
- The existing 12 real-model regressions pass with network fetch forbidden.
- A rerun of the 66-case comparison for the current pair completes with zero request failures. Full coverage remains 81/97 entities, including 35/39 names and 10/17 addresses; ordinary-character masking and negative-case errors are unchanged. This is one regression run, not a new performance benchmark.
- TypeScript checks pass. Desktop build and interactive verification are recorded in the review notes.

## Fresh diagnostic cases

Twelve new synthetic cases were written before observing their model outputs and checked with the current pair. Source: `tests/fixtures/model-reliability.json`. The policy was not tuned to these results. The fixture hash and per-case outcomes are in the [JSON result](2026-09-10-text-reliability.json).

| Category | Fully covered / annotated |
| --- | ---: |
| Names | 11 / 11 |
| Addresses | 0 / 2 |
| Emails | 2 / 2 |
| Phones | 2 / 2 |
| Banking identifiers | 3 / 3 |
| Total | 18 / 20 |

All 12 requests completed and the all-keep output exactly matched each original. Both long addresses were partly covered rather than fully covered, under the strict full-span annotation rule. Seventeen ordinary letters/numbers/marks were unnecessarily masked; two of three negative cases had false positives. Literal special tokens and uppercase prose can be misclassified even when their source positions are correct. This small synthetic set must not be presented as an accuracy estimate for real users.

The previously observed 66-case corpus and this set are now diagnostic/regression data. Future address-policy or model changes need fresh held-out evaluation. Manual correction is available to repair misses; it does not excuse or automatically discover them.

## Reproduce

With the already verified development model files present:

```sh
mise exec -- pnpm test
mise exec -- pnpm typecheck
mise exec -- pnpm test:models
mise exec -- node scripts/check-tokenizer-offsets.mjs
mise exec -- node scripts/check-text-reliability.mjs
mise exec -- node scripts/compare-models.mjs --worker combined
```

The last three commands disable network fetch and do not install anything into the user-managed model directory. Fresh-case output goes to ignored `artifacts/reliability/`. Model inference checks use the local CPU backend on the development Mac, not a desktop WASM speed or memory benchmark. See [Decision 0007](../decisions/0007-text-positioning-and-manual-review.md) for runtime and review behavior.

# Vietnamese recognition pack comparison

Date: 10 September 2026. This is an engineering diagnostic, not a production accuracy claim.

## Question and fixed scope

Does either existing pinned checkpoint alone provide sufficient coverage to remove the other from the optional pack? Compare Small alone, Large alone, and both, with exactly the current contact libraries, banking rules, thresholds, boundary repairs, overlap resolution, and repeated-value policy. Do not tune the detector on these results during the comparison. The production manifest and installed user files remain unchanged.

The corpus in `tests/fixtures/model-comparison.json` was authored before inspecting comparison outputs. All examples are synthetic. Inline `[[category|value]]` annotations identify every intended sensitive occurrence, including repeats. All other letters and numbers are expected to remain readable. It covers accented/unaccented and lowercase/uppercase names, short names, line breaks, street/rural/apartment/abbreviated addresses, banking narratives, contacts, identifiers, credentials, dates of birth, negative examples, and a long-document tail. It is authored by the same implementation agent, not an independent or representative banking dataset. Ambiguous examples and annotation errors must be documented, not silently removed after seeing failures.

## Measurements

- **Full entity coverage:** every non-whitespace character of an annotated entity must be masked by the final transformation. Partial names/addresses count as failures. This ignores predicted category and therefore measures whether the all-options preview actually hides the full value.
- **Selected-category coverage:** rerun filtering and final transformation with only the entity's intended category selected. This catches misclassification hidden by an all-options score.
- **Excess masking:** unannotated letters/numbers/combining marks masked, divided by all such ordinary characters. Whitespace and punctuation are excluded; this is a character-level metric, not entity precision. Report short cases separately from the long-tail fixture so repeated boilerplate cannot dilute the result.
- **Character precision:** sensitive lexical characters masked divided by all lexical characters masked. Pair this with full-entity coverage; it cannot excuse partial leaks.
- **Negative cases:** number of entirely non-sensitive cases where any ordinary letters/numbers are masked.
- **Request failures:** record thrown detector errors per case and keep the case in coverage denominators with zero entities covered. The app fails closed without a preview; this is an availability failure, not observed text leakage. Failed cases are excluded from successful-inference latency percentiles and reported separately. Any request failure blocks promotion.
- **Runtime:** local model loading, first inference, warm short-case p50/p95, and the long case. Two fresh-process rounds in opposite orders reduce order bias. Each round scores identical inputs; assert identical quality outputs.
- **Memory:** peak RSS of each isolated process, including Node, libraries, and model runtime; not just weights or JavaScript heap. Node `process.resourceUsage().maxRSS` is in KiB, converted to bytes, per the official Node 24 documentation consulted through Context7. Loading is process-cold, not guaranteed filesystem-cache-cold.

Runs use the installed Node CPU backend, not the desktop WebView's single-thread WASM backend. Their timings/RSS compare these configurations on this Mac and are not advertised desktop performance. Checkpoints are checksum-verified before the run. Remote model loading is disabled and evaluation replaces `fetch` with a throwing function; this is not an OS network audit. No new model downloads occur.

## Provisional screening floor

Before examining results, use these engineering screening criteria: at least 95% full coverage overall and for each name/address category, at least 95% name/address coverage when only that category is selected, 99% full coverage for contact and banking entities, at most 1% excess masking on short cases, and at most one false-positive negative case. The existing 11 regression cases must also pass. These are provisional comparison gates, not owner-approved release criteria or a guarantee of safe anonymization.

Among configurations that pass, prefer the smaller pack only if it introduces no new missed entities relative to the pair on this corpus and passes existing regressions. If none passes, keep the shipping pack unchanged and document blockers; do not equate the least-bad score with acceptable quality. Any later detector improvement needs a separate untouched validation set, real desktop runtime measurements, and broader independently reviewed data before release claims.

## Reproduction

Run `mise exec -- pnpm compare:models`. It verifies existing local assets, runs the six isolated evaluations sequentially, and writes raw per-case results plus a combined report to ignored `artifacts/model-comparison/`. It never invokes the downloader. `mise exec -- pnpm test` includes metric correctness and annotation validation tests; `mise exec -- pnpm test:models` retains the original regression gate. Only reviewed results from synthetic fixtures belong in versioned evaluation notes.

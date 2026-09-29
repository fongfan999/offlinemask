# Recognition pack decision — 10 September 2026

**Keep the existing optional pack unchanged for now. Do not promote either single model or call the pair production-ready.**

The [comparison report](2026-09-10-model-comparison.md) and [raw synthetic outcomes](2026-09-10-model-comparison.json) show that neither checkpoint replaces the other without losses. Adding Large to Small completes nine more annotated values, mainly names, at an additional 932 MB. Adding Small to Large completes thirteen more values, including addresses. Small's name coverage when only names are selected is substantially weaker than its all-options masking score (20/39 versus 26/39). The pair reaches 35/39 names but only 10/17 complete address spans.

These are strict full-span counts. Some incomplete spans retain only generic address labels or an apostrophe; those cases are not equivalent to exposed identity content. Other misses are substantive: name components, building numbers, parts of street/city names, password suffixes, passport digits and the final IP octet remain visible. False positives include ordinary prose, a table amount fragment, and digits in transaction dates. None meets the [provisional engineering gates](model-comparison-protocol.md).

The new corpus also found a request-level token alignment failure on `negative-upper`, an all-uppercase ordinary support heading. It affects Small and the pair, in both repeats. The app fails closed and offers no preview; the benchmark records this as a failure rather than presenting a successful empty detection. Detector policy was deliberately frozen during this comparison so model differences remain interpretable.

## Next engineering work

1. Fix token/source alignment reliability with a minimal isolated reproduction. Preserve exact source offsets and fail-closed behavior; do not silently skip unalignable tokens or drop a failed checkpoint.
2. Investigate complete name/address boundaries and category errors. Separately improve well-defined identifier/credential recognition where an appropriate local library or rule can preserve complete values. Do not add fixture-specific name/address heuristics to chase this corpus.
3. Prepare a separate untouched validation set and independently review annotations. Re-run the original regressions, this diagnostic set, and that new set after fixes. A passing diagnostic score alone is insufficient.
4. Only then consider replacing or consolidating checkpoints. A candidate needs a clear redistribution license, verified local assets, no lost coverage, and actual desktop WASM timing/memory checks before changing the pack offered to users.

Keep one user-facing Vietnamese recognition pack and manually initiated updates. No model catalog, extra quality selector, automatic checks, new downloads, or changes to installed user files are introduced by this evaluation. CPU measurements compare the current checkpoints on this Mac; they do not establish desktop performance or device requirements.

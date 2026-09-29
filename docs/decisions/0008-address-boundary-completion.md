# 0008 — Complete model-supported address boundaries

Date: 10 September 2026

## Decision

Add a bounded address-completion policy after merging model evidence from the full source text. Keep the current two-checkpoint pack and category UI. The owner requested complete address detection, fresh evaluation, desktop speed/memory measurements, and reconsideration of a smaller pack only if quality holds.

Observed failures often omitted labels such as `căn`, `tòa`, `thôn`, and `phường`, or separated building/street/locality components. `address-boundaries.ts` recognizes those component shapes around existing address evidence. It is not a gazetteer, a replacement model, or a standalone address detector. Missing model evidence still means no completion.

## Bounds

- Candidate components stop at commas, line breaks, field separators, or sentence endings. Administrative abbreviations such as P., Q., and TP. retain their dots.
- Component parsing is limited to 180 UTF-16 units and at most ten proper-name/numeric tokens. Typed address labels, bounded house numbers, and model-supported locality components are eligible; ordinary transaction/contact phrases are excluded.
- A bare locality must begin at existing address evidence. Title-cased prepositions and headings do not become address prefixes.
- A connected chain needs textual model evidence. A model-labelled bare floor/room number alone cannot cause its surrounding building description to be masked.
- Joining crosses only short comma/whitespace or single-newline gaps; prose, semicolons and sentence endings stop it.
- Folded text is used for keyword matching only. Grapheme mappings preserve exact original offsets, including NFD Vietnamese accents.
- Added address spans have priority 51, above model guesses and below validated local identifiers. They include any intersecting original address span in full, preventing a stronger partial repair from discarding previously covered tails. Original detections remain available; local identifier priority is unchanged.

This does not expand arbitrary prose, fill completely undetected addresses, or establish that a detected place identifies a person. It can retain an existing model false positive. Review and manual correction remain necessary.

## Verification and pack decision

See [address evaluation](../evaluations/2026-09-10-address-policy.md). The earlier 66-case corpus improves from 10/17 to 16/17 complete addresses. After two discovered boundary mistakes were fixed, the final unseen 12-case set covers all 9 annotated addresses with no additional ordinary characters masked. Harder prior examples still expose lowercase, numbered-lane and NBSP gaps, and one locality is detected under the wrong category.

The current pair, each constituent checkpoint, and the existing BigMed candidate were compared with the same completion policy. Small alone and BigMed still miss names covered by the pair. The BigMed evaluation adapter also fails on a Unicode fixture. No alternative is promoted, no model manifest changes, and no user download occurs.

The policy adds no dependency or UI. Desktop benchmarking uses a separate developer-only entry point and app identifier, with hard links to already verified local development weights. It cannot alter the production pack; the normal build excludes the benchmark entry point. Context7 documentation for [Tauri configuration overlays](https://v2.tauri.app/develop/configuration-files/) and [Vite's build API](https://vite.dev/guide/api-javascript.html#build) informed that harness. Native code and the production offline policy are unchanged.


## Desktop runtime follow-up

The actual WebKit run exposed memory-limit termination on longer requests. Inference tensors now have explicit cleanup, tokenizer preparation and inference yield between windows, and large-text grapheme processing uses bounded windows with exact cross-window cluster handling. The final synthetic sequence completed through 50,000 characters; 59 fast tests and 14 model regressions passed. Its 7.20 GiB peak footprint and 400.708-second maximum-length latency still require improvement. A faster native CPU reference also differed by one finding and is not an approved runtime replacement. See the [runtime investigation](../evaluations/2026-09-10-desktop-runtime.md) for failed attempts, final evidence, and limitations.

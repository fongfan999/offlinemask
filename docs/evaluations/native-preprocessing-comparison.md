# BigMed with consistent native preprocessing

15 September 2026. **The tokenizer mismatch is resolved in developer evaluation. BigMed still fails the quality screen and is not selected as the shared core.** Production code and the installed recognition pack are unchanged.

## What changed

Previously, native offsets were attached only when native and JavaScript token IDs agreed. Seven BigMed cases failed that check. The new provider uses the native tokenizer for every token-count query, the IDs actually sent to ONNX inference, and original source offsets. It never attaches one tokenizer's positions to another tokenizer's predictions.

The existing synchronous window planner is reused without modification. During synthetic fixture preparation, missing count queries are supplied by a persistent local native tokenizer process; planning restarts using the accumulated answers. The final runner then uses that prepared count/encoding cache. Across this corpus there are 268 unique native queries. Binary-search probes that cut a surrogate pair use replacement characters only for that intermediate count probe; final inference chunks are checked for well-formed Unicode and preserve the planner's grapheme boundaries. This preparation mechanism is developer tooling for known fixtures, not a shipping IPC design.

Native encoding validates content IDs against the full sequence, special-token placement, attention/type masks and UTF-16 bounds. ONNX receives those exact IDs with no additional JavaScript tokenization. Model logits are decoded using the existing helper and shared detection policy. Input/output tensors are released on success and failure; the native tokenizer process is stopped after preparation and the model session is released after evaluation.

## Frozen comparison

Two fresh, sequential Node CPU runs process the same 262 observed synthetic cases and 328 annotated private-value occurrences. Both complete every request and produce identical per-case outputs. The seven previously blocked cases now have results. All other 255 BigMed cases retain identical final predictions to the stricter previous adapter, providing a check that the new inference wrapper did not alter unrelated outcomes.

| Measure | Existing pair | BigMed, native preprocessing |
| --- | ---: | ---: |
| All-options complete private values | 315/328 | 308/328 |
| Name-only complete values | 99/103 | 87/103 |
| Address-only complete values | 106/111 | 107/111 |
| Other-only complete values | 35/41 | 40/41 |
| Email-only | 20/20 | 20/20 |
| Phone-only | 20/20 | 20/20 |
| Banking-only | 32/33 | 32/33 |
| Ordinary characters masked, short cases | 192/7,678 (2.50%) | 83/7,678 (1.08%) |
| Negative cases affected | 23/63 | 10/63 |
| Failed requests | 0/262 | 0/262 |

The current pair is a verified reused control from the [shared-core comparison](shared-core-comparison.md), not a newly executed third run. Its core, policy, fixture and dependency fingerprints remain unchanged. BigMed uses the same installed Node ONNX Runtime 1.24.3 CPU backend directly rather than the Transformers pipeline wrapper. Native tokenizer 0.22.2 supplies all preprocessing. No new latency or memory comparison is claimed.

BigMed gains six complete values over the pair and loses thirteen: twelve names and one unaccented address. Under their respective selected categories, it gains eight and loses fourteen. For example, the pair completely covers `Vo Thi Thanh Truc` and `Đinh Thị Thu`, while BigMed does not. BigMed improves some IP/birth-date/address detections, but those improvements cannot compensate for the observed name losses in a general shared detector.

BigMed has 308 complete, 14 partial and six wholly missed values. Its model-derived stage covers 255/328 values before the local field/contact/identifier and address-completion rules; the full engine covers 308/328. “Model-derived” retains the common label mapping, subword repair and merging, so it is not raw-checkpoint accuracy.

The unchanged screen fails overall complete coverage, name-only coverage, banking coverage, ordinary-text masking and negative-case errors. Complete coverage remains below 95%; name-only coverage is about 84.5%; short-case excess masking is above 1%. The broad “other” result is encouraging on these fixtures, but its small, observed denominator is not evidence of general privacy coverage.

## Evidence and reproducibility

- [Frozen protocol](native-preprocessing-protocol.json): new source/test hashes, previous protocol/report hashes, versions, method and criteria.
- [Full results](native-preprocessing-comparison.json): both-stage outcomes, repeatability, every case, and gains/losses against the pair, previous BigMed adapter and Underthesea.
- [Decision 0014](../decisions/0014-native-preprocessing-evaluation.md): implementation and shipping boundary.

Use the existing verified BigMed export and an already installed `tokenizers==0.22.2` environment:

```sh
OFFLINEMASK_EVAL_PYTHON=/absolute/path/to/evaluation/bin/python mise exec -- node scripts/native-preprocessing/evaluate.mjs 1
OFFLINEMASK_EVAL_PYTHON=/absolute/path/to/evaluation/bin/python mise exec -- node scripts/native-preprocessing/evaluate.mjs 2
mise exec -- node scripts/native-preprocessing/report.mjs
```

Scripts verify the old shared-core fingerprints and new frozen sources, then verify model file hashes/sizes before inference. Both runs block fetch. Raw runs are stored under ignored `artifacts/native-preprocessing/`. No model weights are downloaded by this task, no private text is used, and no telemetry, correction collection or background update behavior is added.

All 87 unit tests pass, including five new tests for native planning, encoding validation, actual tensor IDs/disposal, source offsets and tokenizer-process failure. The production source hashes remain identical to the previously verified shared-core version. Since this task changes developer tooling only, it does not rerun or claim new packaged-app/build/performance verification.

This remains observed-corpus evidence authored by the developer. It resolves an integration ambiguity and supports rejecting this BigMed configuration as a replacement; it does not establish real-world banking accuracy or qualify Excel/PDF/OCR support. The Vietnamese-specific candidate was also [screened separately](vietnamese-pii-challenger-screen.md), with no weight download or scored run.

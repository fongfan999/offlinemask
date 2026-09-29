# Vietnamese recognition pack decision — 11 September 2026

**Reject all three tested configurations as the final release solution:** SuperClinical alone, mSuperClinical alone, and their combination. No checkpoint is promoted. The two-model pack remains the existing development implementation, not the selected release architecture. See [decision 0010](../decisions/0010-vietnamese-model-selection.md).

The pair provides a real coverage improvement; overlap itself is not the reason for rejection. It still misses private information, misclassifies categories, and masks too much ordinary text. Neither single model is an adequate replacement. Choosing the smaller or faster one now would exchange known coverage for lower cost without meeting the reliability requirement.

## Method fixed before inference

The [frozen protocol](2026-09-11-model-decision-protocol.json) records fixture and implementation hashes, execution order, and acceptance criteria. The [56 new synthetic fixtures](../../tests/fixtures/model-decision.json) contain 72 annotated private values: 26 names, 24 addresses, four emails, three phones, four labelled identifiers, and 11 other private fields. Twelve cases contain no private information. The texts include ordinary banking prose, uppercase and unaccented input, signatures, repeated names, Unicode variants, rural and apartment addresses, and empty field labels.

None of the 56 texts exactly duplicates a text from the six previous evaluation suites. However, the same developer authored the annotations with knowledge of earlier failures, and some scenarios recur. This is a fresh diagnostic set frozen before inference, not independently annotated population validation or a benchmark of all Vietnamese writing. Fictional address strings do not assert current administrative boundaries. No fixtures, model policy, source alignment, or scoring thresholds were tuned after inspecting results.

The unchanged existing screening floor requires zero request failures; at least 95% complete private values overall; at least 95% complete names and addresses both with all options and with their own option selected; at least 99% complete emails, phones, and labelled identifiers; at most 1% of ordinary lexical characters incorrectly hidden; and at most one negative case affected. Length probes must preserve complete selected-category coverage. These are minimum engineering checks, not an anonymity guarantee. A passing pair would additionally need at least a five-percentage-point gain in complete selected-category names/addresses over the better single on each runtime, without additional ordinary characters hidden.

All variants use the current pinned exports and the same contact libraries, banking rules, source offsets, chunk planning, boundary completion, and alias policy. Native runs use the existing Rust prototype with ONNX Runtime 1.24.3 and four threads; WASM uses the production-pinned 1.26.0-dev.20260416-b7804b056c distribution and one thread under Node. The latter checks runtime output, not packaged WebKit performance. All runs block `fetch` and use verified local weights; this does not constitute OS-level network isolation.

Six sequential native processes ran the three configurations in forward and reverse order, followed by three sequential WASM processes. Each processes the same 56 cases. Native additionally checks 2,000, 10,000, and 50,000 UTF-16 units; WASM checks 2,000. This is 525 scored evaluations including repetitions, not 525 independent examples. Native repeats produce identical final predictions and coverage outcomes for all 59 fixture/length entries per configuration. All nine processes complete with zero request errors.

## Quality results

Each category column below measures **complete coverage when that category alone is selected**. This matters because a name mistakenly labelled as an organization can disappear from a name-only preview.

| Runtime | Configuration | All private values fully covered | Name-only | Address-only | Ordinary characters hidden | Negative cases affected |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Native | SuperClinical | 49/72 | 11/26 | 17/24 | 36/1,691 (2.13%) | 5/12 |
| Native | mSuperClinical | 44/72 | 21/26 | 9/24 | 71/1,691 (4.20%) | 7/12 |
| Native | Both | 61/72 | 23/26 | 20/24 | 89/1,691 (5.26%) | 9/12 |
| WASM | SuperClinical | 49/72 | 11/26 | 17/24 | 38/1,691 (2.25%) | 5/12 |
| WASM | mSuperClinical | 46/72 | 22/26 | 9/24 | 63/1,691 (3.73%) | 7/12 |
| WASM | Both | 61/72 | 23/26 | 20/24 | 83/1,691 (4.91%) | 9/12 |

The 11 contact/labelled-identifier values are fully covered by every configuration. That small denominator does not establish general accuracy for those categories. Other private fields are fully covered at 5/11, 2/11, and 7/11 respectively in native; WASM improves mSuperClinical to 3/11. Broad “other private information” is not a solved capability.

Combining the models adds 13 complete selected-category names/addresses over mSuperClinical on native and 12 on WASM: gains of 26 and 24 percentage points across the 50 contextual values. It also adds 18 and 20 incorrectly hidden ordinary characters respectively. Thus the complementary coverage is reproducible, but neither the reliability floor nor the ensemble criterion is satisfied.

The existing strict full-entity metric includes punctuation inside an annotation while ignoring whitespace. For example, masking both halves of a hyphenated name but retaining the hyphen fails strict completeness; that is not equivalent to exposing a surname. As a sensitivity check, counting only letters, combining marks, and numbers raises the pair's all-options coverage to 25/26 names and 21/24 addresses on both runtimes. The address and false-positive failures remain; rejection does not depend on punctuation-only gaps.

## Failures that explain the decision

- **A complete name is missed:** both runtimes and both models leave `LƯƠNG GIA BẢO` visible in `mixed-uppercase`, even though the address and phone are found. This is an ordinary labelled uppercase banking record.
- **Single models miss name material:** native SuperClinical leaves the surname exposed in `Bùi Hải Đăng`, `Đinh Khánh Linh`, and `Tạ Minh Quân`; native mSuperClinical only covers part of `Dang Thi Bao Tram`. The pair repairs several such cases, but that does not eliminate its remaining misses.
- **Address components remain exposed:** the pair misses the house number `17/6` in `address-slash` and misclassifies the street name as a person. In the nonbreaking-space address, it produces name/email guesses while leaving other address material visible. Category-only selection worsens these errors.
- **Ordinary text is incorrectly masked:** the pair affects nine of twelve negative examples, including the words `chưa` in empty field placeholders, `ĐỐI SOÁT` in a heading, room inventory numbers, and ordinary table dates/counts.
- **Length changes category behavior:** at 10,000 units the native pair labels `Đống Đa` as a person inside the synthetic address. With all options selected its letters are hidden, but address-only selection leaves the locality visible. This is distinct from the punctuation-only gap in strict all-options coverage. The pair passes the 2,000-unit WASM probe; that is not a WASM 50,000-unit test.

Native and WASM differ on final spans in 6/56 SuperClinical cases, 14/56 mSuperClinical cases, and 6/56 combined cases. Exact per-case spans, outcomes, runtime differences, and provenance are retained in the [machine-readable report](2026-09-11-model-decision.json). The runtime comparison does not isolate whether the differences arise from runtime version, kernels, or execution configuration.

## Cost on this development machine

Measured on macOS arm64, Apple M1 Pro, 16 GiB RAM. Native numbers below are the ranges of two fresh-process runs, with filesystem caches left intact. Loading includes hash verification. Short-case latency is the median across the 56 texts; it is not a fixed-length document benchmark.

| Configuration | Model files including supporting files | Native short-case median | Native 50,000 units | Peak native host + child footprint |
| --- | ---: | ---: | ---: | ---: |
| SuperClinical | 475.33 MB | 13.7–13.8 ms | 17.18–20.77 s | 1.63–1.71 GiB |
| mSuperClinical | 932.35 MB | 20.8–21.3 ms | 23.63–23.77 s | 2.66–2.99 GiB |
| Both | 1,407.68 MB | 34.4–34.6 ms | 41.32–41.37 s | 3.21–3.53 GiB |

These decimal download sizes exclude any future native runtime packaging. Native initialization takes 2.57–2.77 s, 5.76–6.00 s, and 8.31–8.51 s respectively. The two observations support a cost comparison, not a performance guarantee.

WASM short-case medians are 136, 243, and 387 ms; the 2,000-unit probes take 5.13, 9.20, and 14.33 s respectively. Sampled WASM host footprints peak at 2.41, 4.00, and 5.07 GiB. WASM and native memory maxima cover different length workloads, so they must not be presented as a controlled cross-runtime memory ratio. The monitor samples exact process IDs every 500 ms and uses physical footprint, including compressed memory, rather than RSS alone.

## Reproduce and scope

With the already-built native prototype and verified local development weights:

```sh
mise exec -- pnpm models:check
mise exec -- python3 scripts/run-model-decision.py
mise exec -- node scripts/report-model-decision.mjs
```

The runner requires macOS for its physical-footprint monitor and the existing arm64 native prototype. See [development instructions](../development.md#native-inference-experiment) for its build. The frozen source hashes intentionally reject a changed policy or provider; a future experiment needs its own versioned protocol and fresh validation fixtures. Per-run files and raw memory samples are under ignored `artifacts/model-decision/`; the durable report retains quality, repeatability, timing, and memory summaries.

This task changes evaluation tooling and documentation only. It does not migrate the app to native inference, change the installed pack, add downloads, or implement update checks. The decision closes selection among these unchanged configurations: **none is the final solution**. The next implementation direction is a single primary Vietnamese detector with local rules; a different checkpoint or materially improved integration must earn that role rather than inheriting approval from the existing pair.

Verification: all 59 fast regression tests pass, frozen source/fixture hashes still match after evaluation, report links resolve, and `git diff --check` passes. No production UI or native-code change was made, so no new packaged-app or cross-platform verification is claimed.

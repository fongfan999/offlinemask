# Vietnamese model comparison — 2026-09-10

**No candidate meets the provisional screening floor. Keep the pack unchanged pending further work.**

## Scope

66 synthetic cases, 97 annotated entity occurrences, including 15 entirely non-sensitive cases and one long document. 6 configurations, each run twice in a fresh process. Quality outputs were identical across repeats. All use the existing local recognizers and final masking policy. Inference uses local files with network fetch disabled.

Full coverage requires every non-whitespace character in an annotation to be hidden. Partial spans fail. Some strict failures expose only punctuation or generic address labels; inspect the examples below before interpreting these numbers as privacy leakage. This is a small diagnostic set, not an independent production accuracy estimate.

## Coverage and excess masking

| Configuration | Download including metadata | Fully covered | Partial / wholly missed | Ordinary text masked¹ | Negative cases affected | Requests failed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Small alone | 475.3 MB | 72/97 (74.2%) | 20 / 5 | 0.7% | 1/15 | 0 |
| Large alone | 932.4 MB | 68/97 (70.1%) | 23 / 6 | 1.3% | 2/15 | 0 |
| Both models | 1407.7 MB | 81/97 (83.5%) | 16 / 0 | 1.9% | 3/15 | 0 |
| BigMed INT8 | 872.6 MB | 82/97 (84.5%) | 10 / 5 | 0.7% | 1/15 | 0 |
| Underthesea INT8 | 205.5 MB | 69/97 (71.1%) | 4 / 24 | 1.7% | 1/15 | 6 |
| Underthesea FP32 | 460.2 MB | 69/97 (71.1%) | 4 / 24 | 2.0% | 1/15 | 6 |

¹ Percentage of unannotated letters/numbers/combining marks masked in the 65 short cases; the long repeated boilerplate is excluded from this denominator. A failed request yields no preview and is reported separately, not treated as a successful negative case.

| Category | Small alone: all / category only | Large alone: all / category only | Both models: all / category only | BigMed INT8: all / category only | Underthesea INT8: all / category only | Underthesea FP32: all / category only |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| name | 26/39 / 20/39 | 35/39 / 35/39 | 35/39 / 35/39 | 30/39 / 29/39 | 31/39 / 31/39 | 31/39 / 31/39 |
| address | 10/17 / 10/17 | 2/17 / 2/17 | 10/17 / 10/17 | 12/17 / 12/17 | 12/17 / 12/17 | 12/17 / 12/17 |
| email | 8/8 / 8/8 | 8/8 / 8/8 | 8/8 / 8/8 | 8/8 / 8/8 | 7/8 / 7/8 | 7/8 / 7/8 |
| phone | 8/8 / 8/8 | 8/8 / 8/8 | 8/8 / 8/8 | 8/8 / 8/8 | 7/8 / 7/8 | 7/8 / 7/8 |
| banking | 14/15 / 14/15 | 12/15 / 12/15 | 14/15 / 14/15 | 14/15 / 14/15 | 11/15 / 11/15 | 11/15 / 11/15 |
| other | 6/10 / 5/10 | 3/10 / 2/10 | 6/10 / 5/10 | 10/10 / 9/10 | 1/10 / 1/10 | 1/10 / 1/10 |

“Category only” applies the actual selection filter before transformation. Differences from all-options coverage expose category mistakes that a broad masking score can hide.

## What each checkpoint adds

| Compared with the pair | Additional fully covered entities from the pair | Fully covered entities lost by the pair |
| --- | ---: | ---: |
| Small alone | 9 | 0 |
| Large alone | 13 | 0 |
| BigMed INT8 | 6 | 7 |
| Underthesea INT8 | 17 | 5 |
| Underthesea FP32 | 17 | 5 |

Coverage gains should be weighed against the category table and excess masking above. Adding a checkpoint can combine false positives as well as useful detections.

## Runtime and memory

Measured on Apple M1 Pro, arm64, darwin 25.6.0, Node v24.10.0, 16 GiB system RAM. CPU backend; **these are not desktop WebView/WASM performance numbers**. Ranges span two runs, not confidence intervals.

| Configuration | Local load (s) | First inference (ms) | Warm short p50 (ms) | Warm short p95 (ms) | Long case (s) | Peak process RSS (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Small alone | 0.60–1.09 | 39–39 | 8.4–9.1 | 16.0–16.1 | 1.29–1.34 | 1281–1695 |
| Large alone | 1.30–1.47 | 32–55 | 14.2–14.8 | 20.5–22.9 | 1.78–1.84 | 2374–2907 |
| Both models | 1.82–2.17 | 76–95 | 24.1–25.7 | 30.0–36.8 | 3.09–3.17 | 2617–2970 |
| BigMed INT8 | 0.91–0.98 | 53–61 | 7.3–7.5 | 13.6–14.1 | 0.32–0.36 | 2365–2423 |
| Underthesea INT8 | 0.21–0.21 | 22–22 | 7.6–7.8 | 13.9–14.0 | 0.28–0.28 | 683–684 |
| Underthesea FP32 | 0.33–0.35 | 30–31 | 17.2–17.2 | 23.8–24.2 | 0.69–0.73 | 894–897 |

Peak RSS includes the process, model runtime, allocations and weights. It varies substantially between repeats; it is not a minimum-RAM requirement, and the larger single model can peak above the pair. Model load is process-cold, not filesystem-cache-cold. Latencies exclude failed requests.

## Request failures

- Underthesea INT8: name-ethnic — Token offset alignment failed; provide source offsets.
- Underthesea INT8: name-emoji — Token offset alignment failed; provide source offsets.
- Underthesea INT8: mixed-quoted — Token offset alignment failed; provide source offsets.
- Underthesea INT8: mixed-multiline-letter — Token offset alignment failed; provide source offsets.
- Underthesea INT8: other-password — Token offset alignment failed; provide source offsets.
- Underthesea INT8: other-username-prose — Token offset alignment failed; provide source offsets.
- Underthesea FP32: name-ethnic — Token offset alignment failed; provide source offsets.
- Underthesea FP32: name-emoji — Token offset alignment failed; provide source offsets.
- Underthesea FP32: mixed-quoted — Token offset alignment failed; provide source offsets.
- Underthesea FP32: mixed-multiline-letter — Token offset alignment failed; provide source offsets.
- Underthesea FP32: other-password — Token offset alignment failed; provide source offsets.
- Underthesea FP32: other-username-prose — Token offset alignment failed; provide source offsets.

## Pair: incomplete annotated spans

| Case | Expected value | Still visible |
| --- | --- | --- |
| name-lowercase | đỗ hoàng phúc | hoàng phúc |
| name-unaccented-lowercase | bui ngoc diep | ngoc diep |
| name-ethnic | H’Hen Niê | ’ |
| address-street | 86 Nguyễn Du, phường Bến Nghé, Quận 1, TP. Hồ Chí Minh | , phường |
| address-alley | 12/7/3 Lê Văn Sỹ, Phường 13, Quận 3 | 12/7/3 , |
| address-rural | thôn Đông Hòa, xã Bình Minh, huyện Thanh Oai, Hà Nội | thôn |
| address-apartment | căn hộ B1208, tòa B, 25 Nguyễn Hữu Thọ, Đà Nẵng | căn hộ , tòa |
| address-abbreviated | 19 Trần Hưng Đạo, P.5, Q.5, TP.HCM | 19 , P.5, .5, . |
| address-lowercase | 28 võ thị sáu, cần thơ | 28 võ  sáu,  thơ |
| address-linebreak | 56 Điện Biên Phủ Phường 15, quận Bình Thạnh TP. Hồ Chí Minh | Thạnh |
| mixed-no-diacritics | Do Thi Kim Ngan | Do Thi |
| other-password | demo_khach_482 | _ach_ |
| other-password | DemoOnly!482x | !482x |
| other-ip | 192.0.2.42 | .42 |
| other-passport | B1234567 | 1234567 |
| other-birth-prose | 02 tháng 11 năm 1988 | áng |

## Reproduction and provenance

After preparing and verifying the candidate assets, run `mise exec -- node scripts/compare-models.mjs artifacts/model-alternatives --alternatives`. See `docs/evaluations/alternative-model-protocol.md` for explicit downloads, conversion, hashes, and the separate native-offset quality reference.

Dataset SHA-256: `6ff1c4ea7c79dd4b58e95f3da5eafd00547c954c03fa68ad07151ccf69203139`. Exact model repositories, revisions, hashes, environment, predictions and per-case outcomes are in the companion JSON report. Method and provisional gates are documented in `docs/evaluations/model-comparison-protocol.md`. No confidence intervals or population-level claims are warranted from this small authored set.

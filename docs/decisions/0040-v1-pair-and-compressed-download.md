# 0040 — Owner selects Underthesea + mSuperClinical for v1

Date: 20 September 2026. Status: model choice accepted; production integration, packaging and release qualification remain unfinished.

The owner selected **Underthesea INT8 + OpenMed mSuperClinical INT8** for the first release after the smaller GLiNER2 comparison. This supersedes the three-model integration target in Decision 0037. Stop treating BigMed or SuperClinical as components of the v1 target. Keep the tested contextual-only route (`TEN`, `DIA_CHI`, `TO_CHUC`), shared structured-data rules, NFC input normalization and original source mapping. The earlier willingness to sacrifice organizations was conditional on a smaller GLiNER2 candidate; do not remove organization behavior already supplied by this selected pair.

The pair covers 495/500 full-scope annotated values under their correct options in the existing 386-record comparison, versus 496/500 for the trio, while removing about 873 MB of assets. It still hides 467 ordinary lexical positions and changes 21/92 negative cases. The owner has selected a model combination, not declared the existing failed quality checks passed. Preserve that distinction and all earlier evidence; [the comparison](../evaluations/quality-first-v1/README.md) remains a historical report rather than rewriting its frozen ranking.

## Smaller transfer, identical models

Measure lossless Zstandard compression of the exact pinned evaluation files. Download compressed data and decompress locally once, verifying the restored SHA-256 against the evaluated model hashes. This preserves the exact graph/tokenizer bytes and therefore does not introduce a new quantization accuracy tradeoff. Installed bytes remain approximately 1.14 GB; compression does not reduce the model's working memory. Exact results belong in [the packaging experiment](../evaluations/pack-compression-v1/README.md).

Recommended delivery design, not yet implemented:

- Keep one optional **Gói nhận diện tiếng Việt**, excluded from the default installer. Show actual compressed transfer size and installed size before downloading; avoid claiming the installation is smaller than it is.
- Present one action and genuine stages: **Tải về → Đang cài đặt → Sẵn sàng**. Support pause/resume/retry; do not fake progress or readiness after only one of the two models is available.
- Compress each pinned file independently so completed assets need not be fetched again. Resume compressed byte ranges. Verify transport and restored hashes, enforce declared output sizes, extract to staging and activate the complete verified pack atomically. Never decompress on every app launch.
- Keep the previous working pack until successful activation; preflight disk space for compressed downloads, staging and any prior installed pack. Remove only disposable successful-download/staging files afterward.
- No startup or background Internet checks. Future manually requested updates may reuse unchanged files. Future file installation can use the same verified assets; the current offlinemask.com download-page placeholder remains a placeholder until publishing is implemented.

There is no newly hosted Underthesea INT8 artifact or compressed release URL. Production code must not point to imaginary assets. The current downloader handles pinned uncompressed model files with byte-range resume; compression/extraction and the selected pair's production adapter are separate implementation work. No app manifest or inference dependency changes occur in this decision.

More aggressive quantization or changing tensor precision would change the evaluated model and require a separate quality/runtime evaluation. Lossless compression is the first step; do not promise an unmeasured download size or use first-run local conversion to hide additional preparation time.

## Follow-up — 20 September 2026

[Decision 0041](0041-compressed-pack-installer-and-r2.md) implements the compressed installer and records owner-authorized R2 publication. It supersedes the unavailable-hosting and not-yet-implemented transport statements above. The production pair inference adapter is still outstanding; model selection and quality evidence are unchanged.

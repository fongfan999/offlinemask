# Underthesea exact-offset quality reference

This is a native-tokenizer/ONNX CPU reference, not the current JavaScript adapter or a desktop performance benchmark. It uses the same 66 synthetic cases and shared downstream masking policy.

| Export | Runtime assets | Fully covered | Names | Names selected alone | Addresses | Other | Short-case excess masking |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| INT8 | 205.5 MB | 76/97 | 35/39 | 34/39 | 12/17 | 1/10 | 1.66% |
| FP32 | 460.2 MB | 77/97 | 36/39 | 35/39 | 12/17 | 1/10 | 2.01% |

Both reference runs complete all 66 requests. The JavaScript candidate adapter fails on six inputs for each export; the reference separates those integration errors from model quality. It does not fix the desktop adapter.

INT8 gains one unaccented name but loses two other names relative to FP32, for a net loss of one fully covered entity. Neither export meets the provisional screening floor. Underthesea is a general person/location/organization detector and supplies little coverage of the broader privacy categories.

Native tokenization uses exact source offsets with UTF-16 conversion and 384-token windows with 64-token overlap. Its long-document window plan differs from the JavaScript character-window planner; the reference is diagnostic, not a perfectly isolated tokenizer-only ablation. See [protocol](alternative-model-protocol.md) and [raw outcomes](2026-09-10-underthesea-reference.json).

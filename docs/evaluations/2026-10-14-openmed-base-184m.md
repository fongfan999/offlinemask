# OpenMed SuperClinical-Base 184M as the second pack model — 14 October 2026

**Rejected: the published INT8 graph predicts almost nothing, and the FP32 reference, which does work, is 737 MB and still loses the gate's lowercase name while adding organization misreadings on the contract.** The pack is unchanged. Requested by the owner ("experiment it") after the [contract review](2026-10-14-contract-review.md) showed the shipped second model (OpenMed mSuperClinical, 916 MB) contributing only fragments on a real contract.

## Candidate

[OpenMed/OpenMed-PII-Vietnamese-SuperClinical-Base-184M-v1-onnx-android](https://huggingface.co/OpenMed/OpenMed-PII-Vietnamese-SuperClinical-Base-184M-v1-onnx-android), revision `4c8b167a7e7a64cd710ae6ac13ce534c6571cdf9`, Apache-2.0 declared, DeBERTa-v2 architecture (184M parameters, 512 positions, 76 BIO labels over 55 types including FIRSTNAME/MIDDLENAME/LASTNAME, STREET/CITY/COUNTY/STATE and ORGANIZATION). Seven files were downloaded at that revision and verified against the published sizes and LFS hashes ([pinned-files.json](openmed-base-184m-v1/pinned-files.json), [upstream-metadata.json](openmed-base-184m-v1/upstream-metadata.json)); `model_int8.onnx` is 538 739 764 bytes, the tokenizer 8 340 141 bytes (the same `tokenizer.json` as the SuperClinical-Small 44M model used in September). The upstream `openmed-onnx.json` records `"validation": {}` and `"optimization": {"enabled": false}`. Nothing was redistributed; the files live under the ignored `artifacts/candidates/`.

## Method

Each configuration was written as the shipping pack definition for the duration of its run (same `id`, identity-pinned assets, `minScore` 0.3 on every model, `sequential` offsets for the candidate, the pack file restored afterwards) and scored with the project's own scripts on the Node CPU runtime, native tokenizer harness, network fetch disabled, with the policy of decision 0080:

- `scripts/check-pack.mjs`: the 18 committed fixtures;
- `scripts/score-threshold/evaluate.mjs` at thresholds 0, 0.3, 0.5 on the five annotated corpora (release-challenge-v1, text-reliability holdout and final, address holdout, model-decision; 232 cases, 299 entities);
- the miss and over-masking list at 0.3, and the owner's contract (counts only, as in the contract review).

| Configuration | Pinned graphs | Gate (18 fixtures) | Entities fully covered at 0.3 | Names / addresses | Over-masked lexical characters | Contract: replacements / aliases | Candidate spans on the contract |
| --- | ---: | --- | ---: | --- | ---: | --- | ---: |
| A — shipped pair (Underthesea + mSuperClinical) | 1 069 MB | 17/18, known miss | 299/299 | 90/90 · 77/77 | 184 (0.59 %) | 21 / 20 | 259 (fragments) |
| B — Underthesea + candidate INT8 | 723 MB | **16/18**: `lowercase-name` fails | 298/299 | 90/90 · 77/77 | 169 (0.53 %) | 21 / 20 | **2** |
| C — Underthesea alone | 195 MB | **16/18**: `lowercase-name` fails | 298/299 | 90/90 · 77/77 | 169 (0.53 %) | 21 / 20 | — |
| D — candidate INT8 alone | 528 MB | **4/18** | 197/299 | **35/90 · 36/77** | 0 | 9 / 9 (structured rules only) | 2 |
| E — candidate FP32 alone | 737 MB | **13/18**: `lowercase-name`, `banking-letter`, both uppercase contract names | 286/299 | **77/90** · 77/77 | 20 (0.08 %) | 27 / 25 (10 organizations) | 242 |
| F — Underthesea + candidate FP32 | 932 MB | **16/18**: `lowercase-name` fails | 299/299 | 90/90 · 77/77 | 173 (0.54 %) | **29 / 28** (9 organizations) | 242 |

B equals C in every number: the candidate adds nothing. D shows what it finds on its own: the 197 covered entities are the emails, phones and labelled values the shared rules find without any model; of the model's own categories it covers no name in prose and no address. Its two spans on the whole contract are single diacritic letters labelled ORGANIZATION at 0.09.

## Why the graph, not the pipeline

The sibling [SuperClinical-Small 44M](https://huggingface.co/OpenMed/OpenMed-PII-Vietnamese-SuperClinical-Small-44M-v1-onnx-android) (same tokenizer file, same loader, same token layout check) labels the probe sentences as expected: "Phạm Gia Bảo" as LASTNAME/MIDDLENAME/LASTNAME pieces, the account, "23 Võ Văn Tần, Quận 3, TP. Hồ Chí Minh" as STREET/COUNTY/CITY, the phone, the email, and "+44 20 7946 0958" in the English sentence. The 184M INT8 graph on the same sentences labels one token in total ("Smith" as I-ORGANIZATION at 0.27). The CLS/SEP layout, input names (`input_ids`, `attention_mask`) and the 76-label output are as declared. The FP32 reference graph (`model.onnx`, 736 600 200 bytes) was then downloaded and probed; see below.

## FP32 reference

With `model.onnx` (FP32, 736 600 200 bytes, verified) the same probe sentences label as expected: "Phạm Gia Bảo" as name pieces at 0.46–0.71, the account at 0.85–0.93, "23 Võ Văn Tần" as STREET, "Quận 3" as COUNTY, "TP. Hồ Chí Minh" as CITY at 0.92–0.98, the phone and the email, and "John Smith", "12 Main Street", "London" and the UK number in English. The INT8 graph is therefore a broken quantization of a working model, not a weak model; its empty upstream validation block is consistent with that.

Scored as E and F above, the FP32 graph is the most precise model measured here on the corpora (20 over-masked characters alone), but it is weaker than Underthesea on names: it misses the uppercase "ĐOÀN QUỐC BÌNH" and its unaccented form entirely, covers short names such as "Tạ Uyên Chi" only partly, and misses the gate's lowercase "nguyễn văn an" and the uppercase names of the contract fixtures. Paired with Underthesea (F) it recovers the unaccented organization that Underthesea alone misses (299/299, 173 over-masked characters against 184 for the shipped pair) but not the lowercase chat name, and on the owner's contract it adds organization misreadings the shipped pair does not make: a tax abbreviation, "pháp luật", one word of "thuế Thu nhập cá nhân" (29 replacements and 28 aliases against 21 and 20). On the contract its windows took 11.7–15.2 s on the Node CPU runtime against 1.4 s for Underthesea and 7.9 s for the shipped second model.

## Decision

The candidate cannot replace the second model: with the published INT8 graph it is no model at all; with the FP32 graph it is larger than the model it would replace, slower, fails a gate fixture the shipped pair passes, and over-masks the contract more. A re-quantized INT8 graph produced here could at best reproduce F. What the second model is worth is now measured: compared with Underthesea alone it adds the gate's lowercase chat name and one unaccented organization in the challenge corpus (298 → 299), for 874 MB and 15 over-masked characters. Replacing it is still worth doing, but needs either a working INT8 export of a DeBERTa candidate produced and validated here (the Underthesea export under `scripts/export-underthesea.py` is the precedent) or a different checkpoint; the two other OpenMed Vietnamese models (SuperMedical-Large 355M RoBERTa, SnowflakeMed-Large 568M XLM-R) are bigger than the incumbent and were not downloaded.

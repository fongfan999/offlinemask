# Bounded pretrained screen — no replacement selected

19 September 2026. Three checkpoints screened; only GreenNode downloaded and executed. Production code, pack contents, annotations and shared masking rules are unchanged. Custom training remains deferred.

## Admission screen

Sizes below are decimal bytes for a single published checkpoint plus the listed runtime/config/tokenizer files, excluding duplicate weight formats and training files. They are not installer sizes or measured RAM.

| Candidate | Published runtime files | Disposition |
| --- | ---: | --- |
| [GreenNode GLiNER PII](https://huggingface.co/GreenNode/gliner-pii-base-v1.0-tuned) | 675,260,957 bytes (~675 MB) | Vietnamese and Apache-2.0 declared; tested locally; configuration rejected on quality. |
| [AITeamUIT GLiNER2 PII](https://huggingface.co/AITeamUIT/gliner2-pii500k-final-model) | 1,244,448,008 bytes (~1.244 GB) | Vietnamese and Apache-2.0 declared; no compact weights/graph published at this revision. Parked for download cost; not downloaded or accuracy-tested. |
| [NlpHUST Vietnamese ELECTRA](https://huggingface.co/NlpHUST/ner-vietnamese-electra-base) | 534,131,051 bytes (~534 MB) | Vietnamese NER checkpoint, but no license declared in the card or repository file list. Redistribution permission unresolved; not downloaded or accuracy-tested. |

Exact revisions and upstream file sizes/hashes are saved in [upstream-metadata.json](upstream-metadata.json). GreenNode downloaded files are pinned in [asset-manifest.json](asset-manifest.json). No blanket inference that Vietnamese tags imply adequate detection, that absent licensing prohibits all uses, or that the parked large model cannot be compressed is made. These are bounded admission decisions under the owner's product constraints.

The GreenNode card contains generic upstream ONNX size and benchmark claims; this tuned repository publishes a PyTorch checkpoint, not those compact graphs. No claimed upstream benchmark is used as OfflineMask accuracy evidence. Apache-2.0 is the publisher declaration, not a completed audit of training-data provenance.

## Final supported configuration

- Checkpoint `85cf26b39f2a02d9af9af483ac66b2194bf14c9f`, source FP32, CPU, four Torch threads, strict weights-only loading.
- GLiNER 0.2.22, Torch 2.8.0, Transformers 4.51.0 and tokenizers 0.21.4. Developer-only Python dependencies; app dependencies and lockfiles unchanged.
- Fixed contextual labels: `person`, `street address`, `location`, `organization`, `company name`; threshold 0.3 from the model card; flat NER. Existing policy handles structured fields. No post-result threshold tuning.
- Canonical NFC inference mapped back to original UTF-16 grapheme offsets; Python code-point spans validated before conversion. Existing boundary repair, reconciliation and six option filters unchanged.
- Word-aligned overlapping windows, maximum 384 input tokens including label prompt, 1,200 code-point target and 24-word overlap. Exact prepared token IDs checked against nontruncated IDs. Verification confirms every nonwhitespace source code point was processed. Identical windows are cached; timing is not desktop performance evidence.
- Offline flags and socket connection denial enabled before model loading/imports. No inference input is sent to a service. This is a developer Python check, not a packaged-app network audit.

## Measured outcome

“Own option” means a complete expected value is hidden when its corresponding user option is selected; an incorrectly typed finding does not receive credit. Ordinary counts use the existing letter/mark/number metric, which excludes punctuation and symbols. Exact previews retain those differences.

| Evidence set | Cases | Full values, own option | Ordinary lexical positions masked | Cases matching lexical expectations | Screening |
| --- | ---: | ---: | ---: | ---: | --- |
| Existing regression | 262 | 275 / 328 | 605 | 185 / 262 | Fail |
| Existing challenge | 100 | 119 / 142 | 107 | 76 / 100 | Fail |
| Owner-approved batch | 24 | 18 / 30 | 71 | 11 / 24 | Fail |
| Earlier owner-review overlay | 12 | 6 / 13 | 52 | 4 / 12 | Diagnostic only; overlaps regression |

The earlier 12-case overlay lacks examples in some categories, so its computed generic floor is not a meaningful standalone release gate. It is reported separately and never added to the independent sample count.

In the 24-case batch, correct-option coverage is 1/8 names, 1/4 addresses, 2/4 organizations and 14/14 structured values. The structured result is largely supplied by unchanged local rules, not evidence that the contextual model detected those values. With every option enabled, 20/30 values are covered, but two names are incorrectly categorized as addresses. Examples include missing lowercase and unaccented names, overextending a person's name into ordinary prose, and missing full addresses. No runtime errors occurred.

Across the historical 362 cases, own-option coverage is 394/470 with 712 ordinary lexical positions masked. Previous unchanged-policy measurements were Underthesea 463/470 with 270 ordinary positions, and BigMed 448/470 with 90 ordinary positions. None of those previous candidates passed release checks either; the comparison does not promote a prior candidate.

## Integration diagnostics retained

1. [Initial run](results.json): generic README `name` label plus contextual labels, with reused Transformers 4.57.6. Not the final basis for a model decision.
2. [Schema correction](schema/results.json): publisher `count.json` lists `person` and `company name`; replace the former and add the latter. Same threshold/weights/expectations. Still uses the incompatible dependency version.
3. [Final supported runtime](compatible/results.json): correct GLiNER's declared Transformers upper-bound mismatch using 4.51.0/tokenizers 0.21.4. **All detections, previews and metrics are identical to run 2.**

Every run has a protocol frozen before inference; later protocols retain hashes of previous results. Both corrections are integration work on already-observed cases, not fresh validation or prompt-search evidence. No failed artifact is overwritten. Native compact inference/packaging was not attempted because source quality did not pass.

## Verification and scope

The [verification receipt](verification.json) checks frozen files, inherited historical sources, all approval receipts, raw hashes, complete source-window coverage, source offsets, exact previews for all six options, scores and decisions. All three runs have 398 completed case executions and zero errors. The final run represents 386 unique case records plus a 12-case overlapping review overlay. Sixteen related offset, policy and metric tests pass.

The approved examples were assistant-authored and owner-reviewed before the earlier models ran, but they are now observed regression material. Their scenarios are not proven representative of real banking documents. These measurements cannot justify a 100% coverage claim, a banking-grade claim, or promotion of the unchanged installed pair.

See [final exact previews](compatible/previews.md), [final protocol](compatible/protocol.json), and [decision 0036](../../decisions/0036-bounded-pretrained-search.md). The search is closed with **no replacement selected**. Further work should not silently lower the gate, expand annotation requests, add another model, or alter offline behavior.

## Reproduction

Scripts are developer-only. `download.py` explicitly fetches the pinned GreenNode files using the existing range downloader and metadata/hash validation. Install GLiNER 0.2.22 in the experiment's `python-packages` directory; the original diagnostic used the existing `artifacts/minilm-admission/env` environment. For the final compatibility run, install GLiNER 0.2.22, Transformers 4.51.0 and tokenizers 0.21.4 into `compatible-packages` with the same existing base environment. The base environment's package inventory is retained in `artifacts/pretrained-search-v1/base-environment.txt` locally. No optimizer is invoked.

`prepare.mjs` freezes original inputs and scripts, then `infer.py`, `score.mjs`, and `report.mjs` produce the original diagnostic. `freeze-variant.py schema` and `freeze-variant.py compatible` create their separately frozen scripts/protocols; execute the corresponding `infer-*.py`, `score-*.mjs`, and `report-*.mjs`. These preparation/result scripts refuse an existing output. Use a clean experimental copy for a new reproduction rather than erasing evidence. All project commands run through `mise exec --`.

Existing evidence can be replayed without downloading or inference:

```sh
mise exec -- node --experimental-strip-types scripts/pretrained-search-v1/verify.mjs
mise exec -- node --test tests/source-offsets.test.mjs tests/contextual-repair.test.mjs tests/model-comparison.test.mjs tests/pretrained-scope.test.mjs
```

The local verifier requires the ignored raw artifacts and downloaded source/package files whose hashes are referenced in the frozen protocols. This evaluation is not added to the app's startup, build, or ordinary offline test path.

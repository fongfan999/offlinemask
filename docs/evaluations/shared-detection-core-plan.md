# Selecting the shared detection core

Status: architecture and evaluation proposal following the owner's request to go deeper on model selection. The subsequent common-pipeline implementation and observed-corpus comparison are recorded in [Decision 0013](../decisions/0013-shared-detection-comparison.md) and the [comparison report](shared-core-comparison.md). No replacement model is selected; the existing development pack remains unchanged. The findings below describe the pre-refactor audit and motivate that work.

## Product requirement

Text, spreadsheets, digital PDFs and OCR text should share the privacy-detection core. A successful text preview is not sufficient evidence that the foundation is ready for those formats. Prefer one primary Vietnamese contextual model with deterministic local recognizers. Keep one optional recognition pack in the UI. Model identity must remain replaceable without changing format adapters, user categories or aliases.

The shared core is the combination of model, rules, context handling and source mapping. OCR and file extraction are separate components with their own failure modes. A text model cannot detect material the extractor omitted, or by itself find non-text content such as faces and signatures. Future image/PDF support needs a declared scope for those elements.

## Findings from the existing implementation

1. [Decision 0010](../decisions/0010-vietnamese-model-selection.md) rejects both current checkpoints and the pair as release configurations. The latest structured-value improvements do not supersede that decision.
2. [BigMed and Underthesea results](2026-09-10-alternative-decision.md) precede the latest name/address and credential repairs. `scripts/alternative-detector.mjs` still uses a different offset helper and omits current address completion, labelled-field reconciliation and structured-value reconciliation. Historical scores remain valid for their recorded pipelines, but cannot rank those alternatives against today's pipeline.
3. `src/core/detection/engine.ts` directly loads the OpenMed integration. Model execution, contextual span completion and local recognizers are combined inside `openmed.ts`. A common postprocessing stage is needed for a fair comparison and replaceable providers.
4. `WorkerRequest` currently carries one text string, selected categories and a model root. `Detection` carries offsets into that string. Neither contract represents sheet/cell locations, page regions, OCR provenance or extraction completeness. Future adapters need a source mapping layer around these text offsets.
5. The current screening helper checks selected-category completeness for names and addresses, but not all other categories. A credential assigned the wrong category can pass an all-options score. The next protocol must report and gate every supported category separately, with an explicit list of types inside the broad “other” option.

## Intended architecture

```text
Text / workbook parser / PDF extractor / local OCR
        ↓
Source segments + explicit context + reversible position mapping
        ↓
Local structured recognizers + one contextual model provider
        ↓
Shared boundary, conflict and category policy
        ↓
Findings tied to original source locations
        ↓
Review / alias mapping / format-specific output and validation
```

Each segment should preserve exact source text and carry a stable document/segment identity, origin, relevant header or label context, and extraction limitations. Context is evidence; it must not be mistaken for new source content. If a detector needs a serialized header-plus-value input, every added character must be excluded from output locations through an explicit mapping. Ambiguous schema matches must not silently become authoritative column classifications.

For example, the same synthetic number under “Số tài khoản” and “Số tiền” must not be treated identically just because the cell strings match. Table context should preserve row/column boundaries rather than concatenate an entire workbook into prose. Repeated values can share aliases only within the declared mapping policy; repeated text alone must not establish that two people or records are the same entity.

For OCR and PDFs, a finding must map to all relevant page regions, including spans crossing lines. Normalization must retain a reversible map to original extracted characters and regions. Extraction omissions, wrong reading order and insufficient localization must remain visible limitations. File redaction/export must independently verify removal from supported content layers; detection coordinates alone do not establish safe output.

## Bounded candidate comparison

| Candidate | Role in the next comparison | Unresolved requirement |
| --- | --- | --- |
| Current SuperClinical, mSuperClinical and pair | Controls using the current shared policy | Still provisional; demonstrate losses/gains against them |
| Existing pinned BigMed INT8 | Broad single-model challenger | Re-evaluate names and unaccented input after equalizing integration |
| Existing pinned Underthesea INT8 | Compact Vietnamese name/location challenger plus rules | Repair exact offsets first; explicitly test private types its label set does not cover |
| A Vietnamese-specific PII checkpoint | Distinct challenger, subject to provenance and adapter screening | Verify labels, preprocessing, licensing, local execution and export fidelity before benchmarking |

One newly found lead is [Phuc2005/pii-phobert-base-ner](https://huggingface.co/Phuc2005/pii-phobert-base-ner). Its author describes Vietnamese PII fine-tuning and 54 labels, but the inspected card supplies no quality results or detailed evaluation method. Labels must not be interpreted as 54 distinct private-information categories without examining the configuration. This is a research lead, not a recommended replacement; no local measurements or redistribution conclusion exist yet.

Do not automatically add every model marketed as multilingual. For example, the inspected [GLiNER2-PII card](https://huggingface.co/fastino/gliner2-privacy-filter-PII-multi) lists seven European training languages and says non-European locale/script performance is unmeasured. Its published benchmark is not evidence of Vietnamese suitability. It is not prioritized over the Vietnamese candidates in this bounded comparison.

Do not add a second contextual model by default to repair a losing single. An ensemble would need reproducible improvements on held-out cases, acceptable added false positives and measured resource cost. If no single qualifies, record rejection and decide between targeted training and a narrower supported scope; do not silently choose the least-bad aggregate score.

## Evaluation sequence and decision rule

1. **Equalize integration.** Extract the shared policy without changing production predictions. Give candidate adapters the same source-offset requirements, category policy, local rules and postprocessing. Measure both model-only output and complete-engine output to distinguish learned detection from rule repairs. Verify each tokenizer in its supported reference runtime before attributing adapter errors to model quality.
2. **Freeze the capability list and development protocol.** Define the concrete supported private types, including “other,” category-only checks, critical misses, preservation requirements and CPU/memory budgets. Existing screening limits are a minimum, not a release guarantee. Add no threshold changes after held-out outcomes are seen. Calibrate candidate-specific scores on development data only; raw confidence scales are not directly comparable.
3. **Test formats as separate evidence.** Use synthetic prose, labelled forms, header-plus-cell tables and OCR-like text. Paired representations of one underlying record belong in the same development/holdout split. Include changed headers, sparse cells, leading zeros, uppercase/unaccented names, Unicode, line breaks, confusable characters, ordinary negatives and long inputs. Corrupted-text simulation tests detector resilience; rendered synthetic scans through an actual local OCR engine are needed later to qualify OCR extraction and localization.
4. **Freeze a separate final validation set.** Keep all existing observed fixtures as regression material. Have annotations independently reviewed where feasible, and state clearly when that has not happened. Report complete values, selected-category completeness, wholly missed values, partial exposure, ordinary masking, negative-document failures and request failures by type and representation. Do not inflate sample counts by treating rendering variants or repeated runs as independent records.
5. **Qualify deployment finalists.** Evaluate the exact quantized/exported artifact and proposed packaged runtime, checking span parity, cancellation, cold/warm processing, large batches and memory on the declared CPU-only reference hardware. Pin revisions and hashes, account for supporting files, and verify explicit installation plus disconnected processing. Publish gains and losses against the current baseline rather than relying on one aggregate number.
6. **Issue a written selection or rejection.** Select one model only if it passes the predeclared quality, supported-category, source-mapping, deployment and resource gates. Unknown or untested gates remain open. OCR/PDF output support receives its own later qualification; choosing a shared text detector must not imply those adapters are implemented.

## Privacy and deliverables

Evaluation uses authored synthetic data and local developer runs. No app telemetry, background checks, input/error uploads or correction collection are permitted. Offline operation does not prevent controlled local experiments, but synthetic scenario representativeness remains an assumption.

The next implementation milestone is the common policy and fair candidate harness, with unchanged production predictions verified first. Its deliverable is a comparable baseline and frozen next-stage protocol. The subsequent decision deliverable must name the checkpoint, exact export/runtime, supported capabilities, resource costs and remaining failures—or explicitly reject every candidate. This plan does not claim those experiments have already run.

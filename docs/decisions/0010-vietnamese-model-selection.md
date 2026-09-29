# 0010 — Reject the current model configurations for release

Date: 11 September 2026. Status: evaluation completed; no release checkpoint selected.

## Decision

SuperClinical alone, mSuperClinical alone, and the existing combination are **not approved as the final Vietnamese recognition solution**. This supersedes any interpretation of decisions 0005–0009 that preserving the current pack amounted to final model selection. It does not replace the existing development pack with a weaker single checkpoint.

Keep the accepted product concept: one optional **Gói nhận diện tiếng Việt**, a small default app with local contact/identifier detection, explicit downloads, and manual-only general update checks. Users should not select competing checkpoints. The preferred implementation direction is one primary Vietnamese detector supported by the existing local rules. No specific replacement checkpoint has qualified.

## Evidence

The owner requested a concrete decision from one fresh comparison, allowing rejection if none qualified. The [frozen protocol](../evaluations/2026-09-11-model-decision-protocol.json) applies the existing screening floor without changes to 56 new synthetic cases. Six native runs and three WASM runs complete without request errors; native repeats have identical predictions.

The pair fully covers 61/72 private values on both runtimes, including 23/26 names and 20/24 addresses with their respective category selected. It incorrectly masks text in 9/12 negative cases. Singles have weaker contextual coverage. Although the pair adds 24–26 percentage points of complete selected-category name/address coverage over the better single, it increases false positives and still fails the minimum criteria. Even a supplementary metric ignoring punctuation-only gaps does not rescue its address coverage or false positives.

The combination costs 1,407,678,316 model/support bytes and approximately 41 seconds for the fresh 50,000-unit native probe, versus 475,327,639 bytes / 17–21 seconds for SuperClinical and 932,350,677 bytes / about 24 seconds for mSuperClinical. These are development measurements, not packaged-app promises. Full methods, limitations, and measurements are in the [evaluation report](../evaluations/2026-09-11-model-decision.md).

## Consequences

- Do not promote the pair on the strength of complementary detections, or choose a single purely for size. Neither action resolves the observed reliability failures.
- Keep the current installation and functioning development flow intact. No runtime migration, pack removal, automatic network check, or user-facing model catalog is part of this evaluation.
- Treat these fixtures as regression material from now on. Do not tune to them and then call another pass fresh validation.
- A subsequent model/integration change needs a new evaluation, including category-only behavior, ordinary-text false positives, Unicode, and long-input coverage. Repeating the unchanged candidates is not the next step.
- Native inference remains a promising runtime prototype, not a selected release backend. Faster execution does not qualify a detector that misses or misclassifies private text.

No new dependency, model download, or license change is introduced. The pinned model/export and native runtime provenance remains in the manifest and earlier decisions.

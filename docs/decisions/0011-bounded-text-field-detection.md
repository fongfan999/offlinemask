# 0011 — Bounded field detection without user tracking

Date: 14 September 2026. Status: targeted implementation; no model promotion.

## Problem and evidence

The owner authorized tracing the failed text examples and improving reusable behavior, while explicitly prohibiting tracking to improve detection. The current system combines predictions, decoding, category policy, boundary completion, and alias selection; failure of the whole system does not isolate the checkpoint as the cause.

Developer-only traces of six existing synthetic failures capture aligned token predictions, decoded spans, model policy output, and the final preview on both native and WASM. The labelled uppercase name has no positive name tokens in either checkpoint. The slash-number address contains street tokens labelled as a person, and the nonbreaking-space address contains email/person/vehicle guesses. The empty-field placeholder has a name prediction on one letter that word completion extends. The hyphenated name has predicted pieces separated by an unlabelled hyphen. Thus some failures originate in model classification and others can be addressed with application field/boundary semantics. No confidence-threshold change alone is justified by these examples.

Context7 was consulted for OpenMed decoder semantics but returned Python-oriented documentation rather than the installed JavaScript API. The existing `openmed` 2.3.0 implementation and declarations were inspected locally: BIO decoding consumes token labels/positions and the current threshold remains zero. No decoder dependency, tokenizer, model export, or runtime setting is changed.

## Implementation

`labelled-fields.ts` recognizes an explicit, colon-delimited name or address field. Supported name labels include “Họ và tên”, “Họ tên”, “Tên khách hàng”, “Người thụ hưởng”, and sender/recipient/requester labels. Address labels include “Địa chỉ”, “Địa chỉ liên hệ”, “Địa chỉ nhận thư”, “Nơi nhận”, “Nơi ở”, and “Thường trú”. Matching is case-insensitive and accent-insensitive for labels, while a grapheme-to-source map preserves exact original UTF-16 positions. Input is never normalized or rewritten for the preview.

Values stop at the next recognized field, a sentence or hard separator, or a line boundary. A label alone may introduce the next line, but not skip an empty paragraph. Address abbreviations keep their dots. Comma-separated contact and postcode labels also end address values when no colon is present. Names have bounded letter/apostrophe/hyphen syntax and length; address candidates have bounded syntax and must contain letters. Recognized missing-value placeholders are excluded. These constraints are assumptions about structured text, not identity or address validation. Structurally plausible prose or misleading labels can still be ambiguous.

Explicit field meaning overrides conflicting model categories inside that value before checkbox filtering. Reconciliation preserves outside portions of overlapping detections. Recognized label text and exact missing-value placeholders cannot themselves become model findings. This is localized reconciliation, not a global blacklist of Vietnamese words.

Name completion now connects an apostrophe or hyphen only between existing predicted name pieces and does not join names across line breaks. Address completion can bridge a comma followed by one newline (including CRLF), preserving the existing limit against bridging paragraphs or arbitrary prose. Explicit address fields can provide a seed to the existing component completion policy.

These rules run in the existing model-required branch. Available local-only choices still use the existing contact/identifier libraries without loading the model or these rules. The UI, optional pack contents, native download manager, category availability, and production WASM selection remain unchanged. Rule-backed findings identify their source and remain reviewable.

## Rejected change

The initial experiment discarded model EMAIL/PHONE guesses not supplied by the existing contact parsers. This removed obvious false contacts, but it also exposed portions of passwords, usernames, API keys, and account identifiers the model had misclassified. That blanket filter was backed out. Ambiguous model contact guesses outside explicit fields remain an unresolved detection limitation; they must not be described as validated contact information. The final change does not sacrifice that partial masking merely to improve a false-positive count.

## Offline and evidence boundaries

No analytics, input logging, correction collection, training-data upload, crash upload, or automatic update check is introduced. The production additions are pure local transformations without file/storage/network APIs. User input and manual corrections retain the existing RAM-only lifecycle. Developer traces and measurements use only authored synthetic fixtures and are excluded from the shipped app.

Synthetic test outcomes are measured facts about those inputs. The distribution of real banking documents, user behavior, and field accuracy remains unverified. Future changes must use versioned synthetic evidence and fresh validation after tuning; they must not silently collect real input to close this gap. The owner-approved optional download and future manual general update check remain explicit actions only.

## Validation and remaining decision

See the [evaluation](../evaluations/2026-09-14-text-reliability.md) for before/after coverage, regressions, fresh-set outcomes, and verification. The initial 32-case holdout became observed during the first iteration; a separate 20-case final set was frozen after the corrective changes. The same existing screening floor is retained. mSuperClinical is the single-model candidate because earlier evidence showed stronger name-only coverage; the current pair is the regression control. Neither improved synthetic results nor these field rules overturn [Decision 0010](0010-vietnamese-model-selection.md) without meeting its reliability criteria.

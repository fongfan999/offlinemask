# Release challenge v1: specification before inference

15 September 2026. This is a bounded, newly authored synthetic challenge for the existing shared detector. It is not a release approval, independently reviewed benchmark or sample of actual banking documents. The developer is the sole author and annotation reviewer. No private records or user corrections are used.

## Partition and annotation policy

Freeze the fixture, evaluation sources and this specification before any candidate inference. Keep the prior 262 observed cases as regressions; do not edit them. All representations of one underlying record stay in this single challenge partition. There are 24 positive record families, each expressed as prose, labelled text and simulated extraction, plus four long variants from those same families. Add 24 distinct ordinary-text negative families: 100 cases, 48 families. Variants and repeated runs are not independent records. Exact counts of annotations and their types are recorded by the freeze script.

Annotation markers identify original UTF-16 spans; each marker has a corresponding explicit subtype. All unmarked lexical content must remain visible. Whitespace is ignored for complete-value coverage, while punctuation inside an annotated value counts. Ordinary-text masking counts letters, combining marks and digits, using the unchanged prior metric. Selected-category completeness is scored separately from all-options completeness. Labelled forms are plain text with local context, not an Excel adapter.

Sensitive types in this experiment:

| Category | Explicit types to hide |
| --- | --- |
| Name | Full person names |
| Address | Full residential or delivery address, including apartment/house and administrative components |
| Email | Complete email address |
| Phone | Complete phone value, including country code when present |
| Banking | Labelled account, identity, passport, transaction, tax, card and customer identifiers |
| Other | Birth-date expression, organization name, username, password, API key and IP address |

Retain operational dates, appointment dates, transaction amounts, fees, quantities, interest rates, HTTP codes, software versions, empty-field descriptions and generic field labels. Treat the explicitly named organization as sensitive in these synthetic workflows. This is an evaluation policy, not a claim that every organization is private in every workflow. Labelled banking identifiers are within scope; guessing the meaning of an unlabelled numeric cell is outside it.

The extraction variants simulate NFD Unicode, missing accents, line wrapping and a leading emoji. They do not establish OCR recognition quality, page-region mapping, workbook cell context or safe export. The long variants test a known record following boilerplate; they do not increase the number of independent records. Short-case excess masking excludes the four long cases to prevent boilerplate diluting the denominator.

## Fixed experiment

Compare Small, Large, their existing pair, BigMed with the validated native preprocessing provider, and Underthesea INT8. Reuse the exact pinned artifacts, common detection policy, windowing and native offset checks from the previous protocols. No new weights, checkpoint tuning, confidence changes, policy changes or extra ensemble are included. The blocked PhoBERT candidate remains outside scored evaluation.

Run each configuration twice in separate sequential Node CPU processes, with fetch blocked. Score both the model-derived stage and complete engine, but make the decision on the complete engine. Verify exact outputs across repeat runs. Report setup/inference failures explicitly; a failing integration is ineligible, not a usable low-quality score. Node CPU execution is not evidence for a packaged desktop runtime or performance budget.

## Decision gates

Retain the prior engineering screen: zero failed requests; at least 95% full-value coverage overall; at least 95% own-category coverage for names, addresses and other; at least 99% for email, phone and banking; at most 1% ordinary lexical characters masked across short cases; at most one affected negative case among the 24 negatives.

Additionally, each of the 17 explicit subtypes must meet its category's own-category threshold. Designate every email, phone, banking identifier, password and API-key annotation critical: require complete all-options and own-category coverage, and no loss of even partial all-options or own-category coverage compared with the pair. A high aggregate score cannot override a failed critical type. Small denominators make these diagnostic engineering gates, not statistical estimates of field reliability.

Report per-type and per-representation outcomes, affected negative cases, full/selected gains and losses against the pair, critical regressions, and the number of families with all variants complete and no ordinary text masked. Do not select a model simply because it leads this corpus. Existing regression failures, licensing, deployability and resource budgets remain release gates.

After scoring, mark this challenge observed. Do not adjust the model/policy to these cases and describe another run as fresh validation. If all candidates fail, record the failure pattern and a bounded next direction; keep production unchanged. A narrower supported workflow or targeted development may be necessary, but neither is silently authorized as a product change by a failed benchmark.

## Privacy and limits

Everything is developer-local and synthetic. No analytics, private-text logs, uploads, correction collection, model downloads or background update checks are added. The app's runtime is unchanged. Blocking fetch is a harness control, not an OS-level proof of disconnected application behavior. Independent annotation review, new final validation, real extraction/localization and packaged-app offline testing remain outstanding.

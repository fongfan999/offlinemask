# Actual no-pack route, distinguished from the raw helper

During code inspection, the experiment's `local` route was identified as the raw `localDetections()` helper. That helper can produce credential and postcode detections which the production engine subsequently filters to the selected email/phone/banking options. Its full-scope score must not be presented as actual no-pack behavior. Preserve the original protocol/runs and label this route “raw local helper” in reporting.

Add a separate check through `createDetectionEngine()` using the actual three available no-pack options, with a progress callback that fails if model loading is attempted. Score (a) the original full product scope to expose unsupported capabilities, and (b) selected-category targets to measure the real no-pack promise. Do not mix these denominators. Use the same existing fixtures and code fingerprints, no downloads or model predictions. Freeze this addendum and script hashes in its create-only output.

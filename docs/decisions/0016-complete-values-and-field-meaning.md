# 0016 — Complete values and explicit field meaning

Date: 2026-09-15. Status: implemented in the shared production policy; model selection remains open.

## Problem and resulting behavior

The owner asked us to implement the next reliability improvements. The new challenge exposed credentials fragmented across model categories, house numbers detached from street names, and a tax identifier treated as a phone. These require shared policy work as well as contextual model evaluation.

Keep the six existing category choices and the optional-pack experience. Strengthen their underlying behavior:

- Recognize bounded username/password/API-key values after explicit labels in prose, including `là`/`is`, in addition to `:`/`=` assignments. Quoted values keep spaces and punctuation. Unquoted prose needs an opaque-looking value rather than an ordinary instruction. Existing size, newline, quote and placeholder restrictions remain.
- Recognize explicitly labelled passport and tax identifiers under the existing banking/identity category, including in the no-pack path. Reconcile the complete value before filtering categories, so a labelled tax identifier is not masked when only phone is selected. Update the existing category tooltip to state the additional support.
- Complete a house number followed by `đường`, `phố` or `đại lộ` and a proper street name. Permit one wrapped house/street or typed-address component in explicit address context. Final acceptance still requires existing textual address evidence. Reject blank-paragraph joins and unrelated quantities; keep exact source offsets and bounded lookahead.

For example, `Mã số thuế: 0319264857` is treated as one banking identifier rather than a phone. `mật khẩu hello@example.net` belongs to the other-private-information category rather than email. `57/2\nđường Hoàng Sa, Hà Nội` can retain its house number when address-model evidence supports the component chain. These are synthetic examples, not submitted customer records.

## Product scope

The owner's instruction to implement the reliability work authorizes these explicit field improvements; this is a documented expansion of labelled passport/tax support, not a silent claim of universal identifier recognition. Cards remain in “Thông tin riêng tư khác,” as already described by the app. Names, addresses, credentials and other contextual options still require the pack; the availability and download flow do not change.

Recognizers apply bounded syntactic rules, not identity or government-document validation. Supported passport-shaped values have one or two ASCII letters followed by six to eight digits. Tax-shaped values have ten or thirteen digits, optionally a hyphen before the final three. Unlabelled numbers, arbitrary passport formats and undocumented field schemas are not covered by this addition. No number-length-only blanket masking is introduced.

The prose credential rule deliberately leaves ambiguous all-letter unquoted prose to existing detection/review. It does not infer missing values or join credentials across lines. Address completion cannot find an entirely undetected address or establish accurate OCR extraction.

## Engineering and validation

No model checkpoint, dependency, native configuration, storage path or network behavior changes. Existing contact libraries and contextual models remain in use. The changes are portable TypeScript policy shared by providers; there is no new hand-written general name detector.

See the [measured before/after report](../evaluations/policy-hardening.md). The original 262 regressions and the 100-case challenge are now both observed material. Preserve their annotations and the historical frozen results. The first hardening run is retained; a second frozen experiment adds the guarded wrapped-address repair and reruns the complete comparison. No result is described as fresh validation.

Independent final validation, the release model decision, resource budgets and packaged-runtime qualification remain open. Real input and corrections remain temporary and excluded from evaluation. There are no uploads, tracking, extra model downloads or automatic update checks.

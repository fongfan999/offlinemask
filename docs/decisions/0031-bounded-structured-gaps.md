# 0031 — Repair structured values independently of contextual weights

Date: 19 September 2026. Status: implemented and regression-checked; no replacement model selected.

Following decision 0030, the shared detector now recognizes bounded labelled payment cards, CVV/CVC and PIN values, canonical labelled IPv4, explicitly named written birthdays, and account values in aligned plain-text TSV columns. It preserves opaque credentials, Unicode source offsets and category filtering. No weights, dependencies, UI controls, pack availability, background network activity or training behavior change.

Cards require an explicit card-number/test-card label and 13–19 digits, allowing single spaces or hyphens. CVV/CVC accepts 3–4 digits and PIN 4–6 after explicit labels. Malformed numeric continuations and length instructions are rejected. Luhn validity is not required to protect a labelled value. Strong labels distinguish CVV and PIN findings; both remain under the existing “other” category, as do cards, IPs and birthdays.

IPv4 uses the already pinned ipaddr.js 2.5.0 `IPv4.isValidFourPartDecimal`, after an explicit IP label; shorthand, CIDR and address-plus-port strings are outside this bounded addition. Documentation was checked through Context7 against the [official library](https://github.com/whitequark/ipaddr.js). Its existing MIT notice remains applicable, with no new dependency or download.

The named birthday bridge accepts a bounded capitalized name followed by “là” (including unaccented connectors), validates the calendar date, and does not suppress the intervening model name. This is not general birthday prose recognition. TSV account detection requires an exact account header, a second recognized companion header and consistent row width. Blank lines and malformed row widths end the table; only complete valid account cells are returned. This does not implement spreadsheet extraction.

The [evaluation](../evaluations/structured-gaps-v1.md) records 146 passing tests, type checking and 724 actual model case executions. All prior before-policy previews replay exactly. Every evaluated route has zero new complete/partial/own-category losses and zero newly masked ordinary positions. Actual no-pack selected-scope coverage is 73/73 regression and 53/53 challenge, without model loading or fetch. These are previously observed synthetic cases, not independently established banking accuracy.

Retain Underthesea INT8 as the compact engineering candidate and the existing pack as the installed control. Its residual name/category errors, NFD failures, address boundaries and ordinary-text masking remain unresolved. Do not train MiniLM, install another ensemble or claim release qualification based on these rule repairs. The next bounded investigation should isolate tokenizer/Unicode mapping from contextual classification failures under unchanged weights, preserving all remaining misses and previous evidence.

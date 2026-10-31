# 0004 — Local text processing and temporary sessions

Date: 9 September 2026

> The detector and synchronous processing described here are superseded by [Decision 0005](0005-library-text-detection.md). The session and transformation boundaries remain applicable.

## Decision

The text entry point accepts typed or pasted text, starting empty with an optional synthetic sample. An explicit **Ẩn thông tin** action creates an independent in-memory session with the exact original, detected spans, aliases, and mask/keep choices. The existing single-panel original/preview switch, expandable change list, copying, and sidebar navigation remain in place. Every processing action masks the proposed findings initially; users can retain values before copying. No-match results preserve the input and explicitly explain the absence of detected suggestions.

`src/core/text.ts` is a portable, deterministic rule-based detector and span transformer. It has no network, storage, model, or third-party runtime dependencies. `src/core/sessions.ts` owns session creation and dispatches output by session type. Vue uses [textarea v-model](https://vuejs.org/guide/essentials/forms) and [nextTick](https://vuejs.org/api/general#nexttick) for state binding and post-render focus; official docs were consulted through Context7.

## Supported suggestions and limits

- Conventional ASCII email addresses, including plus addressing and subdomains.
- Vietnamese mobile-shaped numbers beginning with 03/05/07/08/09, or +84/0084 equivalents, with optional space/dot/hyphen separators. These are format suggestions, not phone ownership or validity checks; unlabelled digit strings may be false positives.
- Account numbers of 6–20 digits following account/STK labels, with optional spaces/hyphens; identity numbers of 9 or 12 digits following CCCD/CMND/căn cước labels.
- Alphanumeric transaction and customer identifiers after supported Vietnamese/English labels.
- Names of 2–6 capitalized words after supported Vietnamese name labels. Exact repeated values, including signatures, share an alias. This is string reuse, not an assertion that matching names identify the same person.

The detector does not offer general Vietnamese named-entity recognition, address detection, international phone coverage, arbitrary document semantics, configurable packs, manual span additions, or restoration. Lowercase/unlabelled names and unsupported formats can be missed. The entry page says that rules can miss information and that review is necessary. Numeric length alone never classifies an account or identity number. Dates, amounts, whitespace, and unmatched text are copied exactly, except where an identifier rule itself matches them; false-positive suggestions remain reversible through the keep control.

Each finding carries a reason and rule source; its source locations are UTF-16 start/end offsets, matching JavaScript textarea strings. Explicit rule matches resolve overlaps by documented rule order (email, labelled account/identity/reference/customer code, phone, name). Exact whole-value propagation fills only unoccupied spans; it cannot overwrite an explicit classification or partially replace a longer identifier. Distinct representations are not normalized or merged automatically.

Aliases include category, sequence, and an eight-hex-character prefix of a random session UUID for readability. Session creation explicitly retries prefixes already used by any session in the current app instance; generation also skips tokens already present in the original. This separates active sessions while keeping mappings local. It does not guarantee namespace uniqueness across separate app instances; a future vault must retain and enforce its namespace registry before enabling saved projects and restoration. Existing alias-like text is preserved. Transformation builds output from original spans in one pass, so replacements cannot recursively mask generated aliases.

## Storage boundary

Private sessions have a distinct `private-text-v1` discriminator and generic numbered titles. They are never sent to localStorage or sessionStorage. The sample-history encoder also explicitly excludes them, even when handed a mixed session list while saving a spreadsheet sample. It serializes only the previous sample metadata/choice allowlist. Legacy text sample sessions still reopen correctly.

Drafts survive navigation within the current app instance and clear after successful processing. Private sessions remain reopenable until close/reload, with that limitation visible beside the editor and in history. Closing/reloading discards in-memory state; this is not a secure memory-erasure guarantee. The clipboard receives text only on an explicit copy action. Encrypted persistence and restoration remain separate unfinished MVP work; no vault or custom cryptography is introduced here.

## Bounds and verification

Input was limited to 50,000 UTF-16 code units (removed by [0173](0173-no-limits-only-estimates.md), once detection ran in a cancellable worker). Over-limit pastes are retained and reported rather than truncated; empty/whitespace-only input cannot process. Detection runs synchronously within this bound. Local Node spot checks measured approximately 9 ms for 50,000 unmatched characters, 51 ms for 1,800 distinct emails in 36,689 characters, and 10 ms for 49,000 characters of repeated name context. These are development-machine observations, not target-hardware performance guarantees. A worker with cancellation should precede increasing the limit or introducing heavier detectors.

Focused tests cover real input, fixture detection, repeated values, contextual precedence, overlap boundaries, exact original preservation, keep choices, dates/amounts, no-match results, phone formats, scoped aliases, existing tokens, private-history exclusion, invalid input, and missing decisions. Browser and packaged-app checks were recorded in `docs/review-design.md` at the time (retired on 11 October 2026; see git history).

# 0007 — Verified text positions and manual review

Date: 10 September 2026

## Decision

Strengthen positioning for the existing pinned recognition pack and allow users to correct missed text directly in either preview view. Keep the pack, download flow, category choices, and manual-only Internet policy unchanged. No dependency or model download is added.

Transformers.js 4.2.0 does not supply source offsets for token classification. Its convenience pipeline also omits unknown IDs when decoding individual tokens. We already retain the raw tokenizer pieces and logits; production now aligns those pieces sequentially against the original, replacing OpenMed's case/accent-folded search-ahead alignment. OpenMed still decodes BIO labels and canonical entity types. The alternative evaluation adapters remain separate and are not promoted into the app.

The source aligner is specifically for the two pinned NFC/Metaspace tokenizers. It:

- Uses NFC grapheme mappings to original UTF-16 offsets, without changing the original string.
- Retains unknown input, literal special tokens, literal metaspace characters, and nonbreaking spaces.
- Accounts for all non-whitespace source characters, including tokens labelled O; never searches ahead to another matching word.
- Rejects unverifiable alignment and retains the draft through the existing processing-error path.
- Bounds model windows at complete graphemes, preserving accents and joined emoji at chunk edges. A single grapheme that cannot fit the token budget fails rather than being split or truncated.

This is a verified reconstruction for these checkpoints, not a general native-tokenizer offset API. Future packs need their own validated tokenizer contract. It does not correct a model's wrong or missing label. `Intl.Segmenter` is required for grapheme boundaries; the macOS/WebKit and browser checks below are the tested environments, not certification of older WebViews or other OS versions.

## Review behavior

A short hint under the preview explains that users can select missed text. “Ẩn phần đã chọn” appears only for a meaningful selection; it works without a recognition pack. The selection can come from the original or masked view, using pointer or keyboard selection.

The portable selection mapper accounts for textarea CRLF/CR-to-LF normalization and the length difference between source text and aliases. It expands partial emoji/accents and existing findings to their full boundaries. Selecting only an already masked value does not offer another mask action. A correction affects only the selected occurrence, without regenerating unrelated aliases or changing keep choices.

The last manual correction has a “Hoàn tác” action. Undo restores the preceding analysis and choices; the session's manual-alias counter never rewinds. Replacing or undoing a correction cannot reuse its alias for another value. Further keep/mask edits clear this undo snapshot so it cannot overwrite later review choices. Earlier manual additions remain reversible via the existing change list.

All corrections, mappings, counters, and undo snapshots stay in the private RAM-only session. Reopening the session in the sidebar preserves them; closing/reloading discards them. Sample serialization excludes the entire private session. Copy still uses the same span-based output shown in the masked preview, with no network request.

## Evidence and limits

See [the reliability check](../evaluations/2026-09-10-text-reliability.md). The expanded diagnostic corpus exposes incomplete addresses and ordinary-text false positives; neither “reliable detection” nor production readiness is claimed. Model accuracy improvements remain separate work, with a new held-out set needed after tuning.

Context7 was used for [Transformers.js token classification](https://github.com/huggingface/transformers.js/blob/main/packages/transformers/src/pipelines/token-classification.js), [tokenizer encode](https://github.com/huggingface/transformers.js/blob/main/packages/transformers/src/tokenization_utils.js), and Vue [template refs](https://vuejs.org/guide/essentials/template-refs.html) / [nextTick](https://vuejs.org/api/general#nexttick). Installed code and the pinned tokenizer JSONs were inspected to establish the actual normalization/layout contract.

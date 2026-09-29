# 0042 — Connect the selected pair to production text masking

Date: 20 September 2026. Status: integrated and synthetic CPU replay matched; release quality limitations remain.

## Shipping path

The app now uses Underthesea INT8 and mSuperClinical INT8 from the published `release-pack-v1.json`. Settings derives **712 MB downloaded / 1.14 GB installed** from that same pinned catalog. `models.rs` downloads and verifies this pack; its ready root is the only source accepted by the native tokenizer. Old model files are not deleted or treated as a valid copy of the new pack.

`recognition.ts` is the production adapter. The historical `openmed.ts`, `scripts/model-manifest.json` and candidate scripts remain intact for old evaluation reproduction; they no longer select the shipping models. Existing `models:download` / `test:models` commands still concern those historical development candidates, not the shipping pack.

The production policy exactly follows Decision 0040: normalize inference input to NFC, evaluate each model, keep contextual `TEN`/`DIA_CHI`/`TO_CHUC` evidence, restore positions in the original input, then apply the shared structured-field rules. Email, phone and banking-only selections do not load model weights. Masks and manual corrections remain in RAM.

## Exact positions and local IPC

Transformers.js does not supply the required source offsets for Underthesea. The app now directly depends on Hugging Face Rust `tokenizers = 0.22.2` (Apache-2.0, same version as the evaluation). Default features are disabled; only `fancy-regex` is enabled, so no Hub download support is compiled for tokenization. This moves a previously optional prototype dependency into the shipping build, without adding Python or a training runtime.

The token-classification graph still runs in the existing local Transformers.js/WASM worker. For Underthesea chunks, the worker asks the main adapter to call `recognition_encode` over local Tauri IPC. Rust loads only the pinned tokenizer from the ready pack, verifies its hash, bounds input/token counts, and converts UTF-8 byte offsets to UTF-16. The worker requires native and JavaScript token IDs to match exactly before using those positions. No guessed decoding or fallback to cloud inference is allowed. Unexpected layouts fail without creating a partial session; errors do not expose provider exception text.

The tokenizer retains its vocabulary, not user input. Input is transient in-process data; no text logging, persistence, telemetry, correction collection or background update check was added. Cancelling terminates the worker; late native responses cannot reach a new worker or create a stale session.

Official documentation consulted through Context7: [Transformers.js token classification](https://github.com/huggingface/transformers.js/blob/main/packages/transformers/src/pipelines/token-classification.js), [Hugging Face Tokenizers](https://github.com/huggingface/tokenizers), [Tauri commands](https://v2.tauri.app/develop/calling-rust/).

## Evidence and release boundary

The production TypeScript adapter and the exact shipping Rust tokenizer replayed all **398** synthetic records on CPU. Full previews and all category-specific selections matched the recorded selected-pair results, excluding source-attribution wording. The 386 independent records still yield **495/500 own-category values**, with **467 ordinary lexical positions** unnecessarily masked. The extra 12 owner-review records overlap earlier examples and do not enlarge the independent denominator. Network fetches were disabled, with zero attempts. No new holdout or real banking accuracy claim is implied.

See [production integration evidence](../evaluations/recognition-production-v1/README.md). Matching the chosen model recipe is an integration result, not a change to its known false positives, missed values or failed quality floors. A platform-wide release claim still requires Windows/Linux packaging/runtime validation and broader independent quality evidence.

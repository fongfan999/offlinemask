# Native tokenizer: exact source mapping without Python

18 September 2026. A reusable Rust tokenizer adapter now passes the bounded MiniLM source-position checks and feeds the compressed graph successfully. **The shipping app and installed recognition pack remain unchanged.** This closes the Python-only implementation gap for a native prototype, not packaged-app qualification or model selection.

## What changed

The standalone crate in `scripts/minilm-native/native/` loads only the existing local tokenizer JSON, verifies its frozen SHA-256 and encodes through Hugging Face Tokenizers 0.22.2. This matches the Python binding used in the reference evaluation. Its default features and HTTP support are disabled; the resolved target dependency graph contains no `hf-hub`, `reqwest` or `ureq` package.

Grapheme-wise NFC normalization carries a map from normalized UTF-8 bytes back to original UTF-16 source spans. Returned positions cover complete original graphemes, including decomposed Vietnamese accents and emoji. The library rejects invalid byte boundaries, unexpected empty source spans and hidden truncation. Source input is limited to 50,000 UTF-16 units; inference encodings over 384 tokens are rejected. Longer diagnostic encodings remain available explicitly for evaluation and future window planning.

The pinned tokenizer's raw spans can include preceding whitespace. Independent tests exposed this for a repeated name and a line break. The adapter now exposes both raw alignment offsets and separate masking offsets that remove only edge whitespace graphemes. Token indices remain unchanged. The two original failures and their source snapshots are retained; the original expected masking boundaries were not weakened. See the [boundary policy](minilm-native/masking-boundaries.md).

The library has no Python, network, UI, persistence or inference dependency. The developer executable adds a bounded stdin/stdout harness and generic errors that do not echo source text. It is not bundled or started by the app. Its measured macOS arm64 release binary is **3,016,720 bytes**; that is not a final installer-size measurement. The recognition pack remains the previously measured 203.89 MB Gather-only prototype.

## Verification

| Check | Result |
| --- | --- |
| Original full inputs plus planned windows | **883/883** exact ID, attention-mask and raw-offset matches |
| Separately authored source-boundary and failure checks | **31/31** after whitespace-boundary repair |
| Native Rust tokenization → Node-hosted WASM graph vs slow-tokenizer/Python CPU reference | **20/20**, maximum absolute error **2.682e-7** |
| Rust mapping and source-limit unit tests | **4 passed** |
| Existing application tests | **118 passed** |
| Rust formatting and Clippy | Pass, warnings denied |
| Production and historical-evidence hashes | Unchanged |

The 883 records contain 407 full inputs and 476 windows, not 883 independent documents. The raw-offset oracle is the frozen native Python reference, previously checked for lexical association against original SentencePiece. Additional hand-authored expectations cover decomposed names, duplicate occurrences, astral/ZWJ/flag emoji, compatibility characters, punctuation, unknown/control characters, source special-token strings, separator-only input and CRLF. Failure checks cover source/token budgets, malformed/oversized frames, unknown protocol fields and a modified tokenizer asset.

The integrated inference run uses complete original shared-core windows instead of truncation, with 2–363 tokens. It compares IDs against original slow SentencePiece, then logits against the same Gather-only graph on Python CPU. The original `atol=1e-4, rtol=1e-4` tolerance remains unchanged. It also checks tensor-to-offset indexing and surrogate boundaries. These are technical probes of a random classification head, not privacy accuracy.

The final corpus run reported 733 ms for native tokenizer loading under concurrent developer load. Per-record timings are retained but do not qualify cold start, p95 latency, cancellation, memory or battery targets. No packaged WebKit/Tauri process was exercised. Unicode behavior outside the tested corpus and boundary cases is not proven universally.

## Next integration boundary

Bring this adapter into a feature-gated Tauri development path, preserving the verified local-asset contract and using masking spans when aggregating entities. The app must manage worker lifetime, cancellation and errors without blocking the UI, ensure source offsets survive IPC/window rebasing, and run the complete path offline in the packaged app. Then measure the proposed resource budgets on that executable.

No Python sidecar is needed. Do not enable the candidate in the normal UI or replace the installed control pack yet. Independently reviewed training data, training, trained-model compression checks and privacy-quality evaluation remain separate requirements. MiniLM remains a feasibility candidate with zero training steps.

## Reproduction and provenance

The [specification](minilm-native/spec.md) precedes implementation. [Frozen results](minilm-native/results.json) include source/lockfile hashes, raw-output hashes, all comparison outcomes, selected dependency features, licenses and binary fingerprint. Raw synthetic artifacts stay under ignored `artifacts/minilm-native/`. The library is isolated from the production Cargo manifest and lockfile; its own Cargo.lock is retained.

The relevant upstream library is [Hugging Face Tokenizers](https://github.com/huggingface/tokenizers), Apache-2.0. Local `Tokenizer::from_bytes`, byte-based `encode`, special-token masks and offsets were verified through Context7 and installed 0.22.2 source. Unicode normalization 0.1.24 and segmentation 1.13.3 are pinned; the complete resolved target licenses are recorded in results. Dependency downloads occurred only for the explicit developer build; inference used local files and a rejecting Node fetch stub.

With the prior admission/repair assets present and a clean output directory:

```sh
mkdir -p artifacts/minilm-native
mise exec -- cargo build --release --locked --manifest-path scripts/minilm-native/native/Cargo.toml --target-dir artifacts/minilm-native/target
mise exec -- cargo test --locked --offline --manifest-path scripts/minilm-native/native/Cargo.toml --target-dir artifacts/minilm-native/target
mise exec -- node scripts/minilm-native/evaluate.mjs
mise exec -- node scripts/minilm-native/boundaries.mjs
mise exec -- artifacts/minilm-admission/env/bin/python scripts/minilm-native/runtime-reference.py
mise exec -- node scripts/minilm-native/runtime.mjs
mise exec -- pnpm test
```

Python is used only to independently produce comparison evidence. The executable, corpus comparison, boundary checks and graph execution require no Python. Evidence writers refuse to overwrite completed outputs. The report-freezing script additionally expects historical failure snapshots and validation logs; it is not a fresh-run setup command.

An initial dependency fetch was attempted before crate targets existed and failed harmlessly; the completed build resolved dependencies after targets were added. An all-platform offline metadata query requested an uncached platform-specific dependency; restricting the query to the measured macOS arm64 target succeeded without another download. Neither event changed a measured gate or implies other-platform support.

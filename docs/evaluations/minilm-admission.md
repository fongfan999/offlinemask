# MiniLM technical admission: size passes, integration held

18 September 2026. **Do not begin training or replace the production detector yet.** The pinned MiniLM base compresses to a complete 140.24 MB prototype, but the tokenizer/source-position and compressed WebAssembly parity gates fail. This is a technical integration result, not a rejection of its learned privacy quality: the prototype has an untrained head.

## What was actually built

Downloaded five source assets for `microsoft/Multilingual-MiniLM-L12-H384` revision `6e8c1ec6b4ec4e3fc6eb7d2cd834fcd582b61daf` into ignored developer artifacts. Verified the weight's publisher LFS SHA-256 and the small files' Git blob hashes. The 470,657,952-byte source weight was loaded with `weights_only=True`, local-only loading and no remote code. Source configuration and tokenizer files remain intact.

Added a deterministic random 39-label classification head, seed 9182026, with **zero training steps**. Only the two classifier tensors were missing from the source checkpoint as expected. Exported FP32 ONNX opset 18, then quantized MatMul and Gather with ONNX Runtime. The large word-embedding initializer is now UINT8 with scale/zero point, instead of remaining FP32. No custom embedding-compression implementation or vocabulary trimming was needed.

| Artifact | Bytes | Interpretation |
| --- | ---: | --- |
| FP32 ONNX graph | 470,267,281 | Reference only; exceeds pack target |
| Compressed ONNX graph | 118,069,991 | Includes compressed word embeddings |
| Complete prototype pack | **140,242,189** | Graph, tokenizer JSON, SentencePiece model, configuration, special tokens and upstream MIT notice |
| Proposed pack ceiling | 300,000,000 | Size gate passes |

The pack includes both tokenizer representations so size is not understated by omitting support files. It is a local directory total, not a signed installer or measured final trained-model size. Shared runtime binaries and source-only training weights are outside the recognition pack. Nothing was copied into the user's installed recognition pack or app manifest.

## Tokenization and source-position result

Tested 407 synthetic inputs: all 362 existing regressions, 29 authored development records and 16 adversarial/length probes. The unchanged shared window planner produced 476 windows; every reference-tokenized window fits the 384-token limit and the windows cover their original source text.

| Check | Result |
| --- | --- |
| Original slow SentencePiece vs converted fast tokenizer, full inputs | 16 ID mismatches |
| JavaScript vs converted fast tokenizer, full inputs | 16 ID mismatches; 14 attention-mask length/value mismatches |
| JavaScript vs original slow SentencePiece, all 476 windows | **0 ID mismatches** |
| JavaScript vs fast conversion, all 476 windows | 16 ID mismatches |
| Existing production piece-to-source aligner | 6 input failures |
| Raw converted-fast offsets with uncovered lexical source positions | 19 inputs |

The conversion mismatch is concentrated in decomposed Vietnamese accents. JavaScript agrees with the original SentencePiece path in this window probe, so the evidence does **not** show that JavaScript tokenizer IDs are generically wrong. It shows that converted-fast offsets cannot simply be attached to its predictions. Attention-mask mismatches mainly reflect differing sequence lengths, not an independently established attention implementation defect.

The existing aligner rejects examples involving unknown/emoji input, invisible characters, compatibility forms and a literal SentencePiece marker. Some raw reference offsets omit combining marks after normalization. These are integration failures to fix with explicit, reversible source mapping—not reasons to silently drop characters or guess repeated substrings. The tokenizer warning about a Mistral regex was logged but its suggested patch was not applied to this unrelated checkpoint.

## Export and runtime fidelity

Twenty bounded probes exercise empty strings, whitespace, Unicode, long token sequences up to 384 tokens and ordinary Vietnamese inputs. The predeclared comparison tolerance is `atol=1e-4, rtol=1e-4`.

| Comparison | Result |
| --- | --- |
| PyTorch FP32 vs Python CPU FP32 ONNX | 20/20 pass; maximum absolute error 4.17e-7 |
| Python CPU compressed vs Node CPU compressed | 20/20 pass; maximum absolute error 0 |
| Python CPU compressed vs production-version WASM hosted in Node | **14/20 pass**; maximum absolute error 0.03322 |
| FP32 CPU vs FP32 WASM diagnostic control | 20/20 pass; maximum absolute error 2.38e-7 |

The six compressed cross-runtime failures are probe IDs 4, 5, 14, 15, 17 and 18. The FP32 control was added after observing the compressed failures; it narrows the discrepancy to compressed execution in this configuration, without identifying a particular operator or proving an upstream runtime bug. The original tolerance was retained. Runtime optimization, dynamic quantization or kernel differences need a separate investigation.

Quantization versus the FP32 model changes random-head logits: maximum absolute deviation 0.07648 and maximum per-probe RMSE 0.01845. Those descriptive numbers and argmax agreement are retained in the JSON; they cannot establish privacy accuracy, training quality or an acceptable post-training quantization loss.

Versions: PyTorch 2.8.0, Transformers 4.57.6, Tokenizers 0.22.2, SentencePiece 0.2.1, ONNX 1.19.0 and Python ONNX Runtime 1.22.1. Node CPU uses the existing 1.24.3 runtime; WASM uses the app dependency `1.26.0-dev.20260416-b7804b056c`. The isolated Python environment is recorded in [requirements](minilm-admission/python-requirements.txt). Production JavaScript and Rust dependencies were not changed.

These are Node-hosted runtime probes, not packaged WebKit/browser/cross-platform verification. No end-to-end latency, process-tree memory, cold load, cancellation, battery or batch budget is qualified. Inference forbids fetch in JavaScript and uses offline/local-file settings in Python; that does not replace disconnected-app testing.

## Decision and next bounded repair

The candidate passes the size and FP32 export checks and can execute the compressed graph in all tested runtimes. **It remains held before training admission**, because execution alone is insufficient when token positions or runtime outputs disagree.

1. Establish one source-mapped tokenizer contract consistent with the original SentencePiece IDs. Investigate a reversible normalization/offset implementation or a corrected fast conversion, retaining exact NFC/NFD/emoji/unknown-token tests. Do not add a Python dependency to the shipping app or attach offsets from a different token sequence.
2. Isolate compressed CPU/WASM disagreement with controlled quantization/operator and runtime-optimization variants. Record each variant, preserve failures and retain the declared tolerance. A different quantization method or execution backend needs a new reproducible qualification; it is not an implicit production migration.
3. Only after those gates and packaged-runtime feasibility pass, complete the separate training corpus/review requirements before the bounded training smoke run. Passing this technical probe would still not select a privacy detector.

No additional contextual model or ensemble was introduced. The currently installed pair remains a development control. Private user data, telemetry, correction uploads, persistent private sessions and automatic updates are unaffected.

## Reproduction and experiment history

The [specification](minilm-admission/spec.md) was written before export/runtime measurement. [Results](minilm-admission/results.json) record gates, per-probe discrepancies, artifact hashes and source fingerprints. [Source manifest](minilm-admission/source-manifest.json) and [verified download evidence](minilm-admission/download-evidence.json) identify the exact files. The upstream MIT notice's URL/revision/hash is in [license provenance](minilm-admission/license-source.json); this does not complete training-data or redistribution review. Context7 documentation and installed source were used to check export, tokenizer and Gather quantization APIs.

The first export attempt compared against a reference model whose mode had been changed through its wrapper, causing a false FP32 parity failure. Setting the wrapper explicitly to evaluation mode and asserting both model/wrapper modes corrected the harness. The failed log/source hashes are retained; it is not reported as model degradation. A tokenizer-audit replay optimized its lexical-coverage scan; the existing evidence writer refused overwrite. The original completed evidence remains the result. No failed result was rewritten as passing.

For a fresh isolated evidence workspace, supply the pinned Python environment and local runtime dependencies. Prepare the corpus, explicitly download/verify sources, and provide the verified license notice at `artifacts/minilm-admission/pack/LICENSE-MiniLM.txt` before final pack measurement. The pack directory is developer-only.

```sh
mise exec -- node scripts/minilm-admission/prepare.mjs
mise exec -- python scripts/minilm-admission/download.py
mise exec -- artifacts/minilm-admission/env/bin/python scripts/minilm-admission/prototype.py
mise exec -- node scripts/minilm-admission/tokenizer.mjs
mise exec -- artifacts/minilm-admission/env/bin/python scripts/minilm-admission/chunks.py
mise exec -- node scripts/minilm-admission/runtime.mjs cpu
mise exec -- node scripts/minilm-admission/runtime.mjs wasm
mise exec -- node scripts/minilm-admission/runtime.mjs wasm fp32
```

Raw references and failed-attempt snapshots live under ignored `artifacts/minilm-admission/`. The report writer fingerprints those archival attempts as well as successful outputs; historical attempts must be supplied to reproduce that exact evidence package. It refuses to overwrite the tracked results. All **115 existing unit tests pass**, and the prior production-source fingerprint still verifies. No new production build was needed or claimed for this isolated prototype.

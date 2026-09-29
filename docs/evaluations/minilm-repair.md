# MiniLM integration repair: smaller pack with consistent runtime output

18 September 2026. The developer prototype now fits in **203,886,165 bytes (203.89 MB)** and passes the original CPU/WASM comparison tolerance. Explicit NFC normalization also repairs the observed tokenizer-ID mismatches. **MiniLM is still not a selected or trained privacy detector.** The app has not changed.

## Results

| Check | Previous admission | This repair |
| --- | --- | --- |
| Compression | Gather + dynamic MatMul | Gather weights only; MatMul remains FP32 |
| Complete recognition pack | 140.24 MB | **203.89 MB**, below the 300 MB ceiling |
| Python CPU vs Node CPU | 20/20 | **20/20**, exact agreement |
| Python CPU vs Node-hosted WASM | 14/20 | **20/20**, maximum error 2.384e-7 |
| Converted-fast vs original token IDs | 16 mismatches on full inputs | **0** across 407 full inputs and 476 original windows |
| JavaScript vs repaired fast IDs/masks | Mismatches | **0** across the same 883 records |
| Mapped native lexical coverage/association | Uncovered combining marks | **0** gap cases or token association failures in this probe |
| Original windows over 384 tokens | 0 | **0** |

The runtime tolerance remains `atol=1e-4, rtol=1e-4`. The frozen export, input tensors and random 39-label head are reused; no training or tolerance relaxation occurred. The Gather-only graph is 181,713,967 bytes. The total includes both tokenizer representations, configuration, special tokens and the MIT notice; shared application runtimes are outside the pack. It is a measured local artifact total, not a final signed download or installer.

The largest deviation from FP32 random-head logits is 0.007918; the largest per-probe RMSE is 0.001647. These are descriptive fidelity values, not privacy-accuracy evidence. The test shows that avoiding dynamic MatMul quantization removes the discrepancy in this configuration. It does not establish which runtime/kernel caused the earlier failure, or how compression will affect a trained detector.

## Tokenizer contract tested

The installed JavaScript tokenizer's `Precompiled` normalizer approximates the SentencePiece character map using replacements and NFKC. Its current API returns token IDs/pieces without usable source offsets. The converted Python fast tokenizer has a different normalization path, which produced the decomposed-Vietnamese discrepancies. A general claim of identical Unicode behavior would therefore be unjustified.

The repair creates a grapheme-wise NFC view while keeping a mapping from normalized code points to whole original UTF-16 graphemes. It feeds that view to fast and JavaScript tokenizers, verifies both against original-text slow SentencePiece IDs, then maps fast-tokenizer offsets back to the original text. Native SentencePiece immutable-proto surfaces provide an independent source-association check, with added-token boundaries taken from the reference library. Repeated text is never resolved by searching ahead for a plausible match. Literal special-token text retains its source; only inserted sequence delimiters lack source positions.

The association comparison checks original letters, numbers and combining marks assigned to each token, after whole-grapheme expansion. It deliberately does not equate differing whitespace ownership conventions. **It does not prove exact positions for all punctuation, control characters or arbitrary Unicode, nor provide a shipping JavaScript offset adapter.** Emoji grapheme/UTF-16 conversion and repeated decomposed names have direct unit tests; those tests do not replace complete end-to-end token offset qualification.

All 407 inputs and 476 windows are reused diagnostics. They are not independent holdout data. The Mistral-regex warning emitted by Transformers for this unrelated tokenizer is retained in logs; its suggested patch was not applied.

## Decision and remaining work

Use Gather-only compression as the preferred **technical prototype** for subsequent qualification. Retain the earlier 140 MB failure evidence. Do not promote either artifact to the installed recognition pack.

The next bounded task is an executable offline tokenizer/offset implementation usable by the desktop app, using the pinned SentencePiece normalization contract, with exact source-boundary tests including punctuation, unknowns, special-token lookalikes and compatibility forms. Do not ship Python or attach offsets from a different token sequence. Evaluate a native tokenizer adapter or a library implementation that supplies offsets before inventing a permissive string aligner.

Then qualify that complete path in the packaged desktop runtime, including cold start, memory, long inputs and cancellation. Independently reviewed training data and a trained model's privacy-quality evaluation remain separate requirements. A successful runtime repair does not select MiniLM over the existing development control or settle the final model decision.

No UI, app model manifest, installed recognition pack, dependency lockfile, private-input persistence or network behavior changed. Inference used cached local assets, offline library flags and a rejecting fetch stub in Node. No user data was collected, and no background check/download was added. All **118 unit tests pass**. Production and historical-evidence fingerprints verify unchanged.

## Reproduction and evidence

The [specification](minilm-repair/spec.md) precedes measurement; [results](minilm-repair/results.json) freeze artifact hashes, per-case checks, source fingerprints and runtime versions. Inputs and Python dependencies are the pinned [admission environment](minilm-admission/python-requirements.txt). Context7 documentation and installed source were inspected for Gather quantization and tokenizer behavior. No new dependency or checkpoint download was needed.

Starting with the original local admission artifacts and an empty `artifacts/minilm-repair/` directory:

```sh
mkdir -p artifacts/minilm-repair
mise exec -- artifacts/minilm-admission/env/bin/python scripts/minilm-repair/compress.py
mise exec -- node scripts/minilm-repair/runtime.mjs cpu
mise exec -- node scripts/minilm-repair/runtime.mjs wasm
mise exec -- node scripts/minilm-repair/tokenizer.mjs
mise exec -- artifacts/minilm-admission/env/bin/python scripts/minilm-repair/offsets.py
mise exec -- pnpm test
```

Writers refuse to replace completed outputs. The report writer additionally expects archival logs and original admission hashes, so it is an evidence-freezing step, not a standalone clean-room reproduction command. One initial offset invocation began before normalized input generation completed and failed with a missing-file error; its log is retained. The dependent run after generation succeeded. No successful measurement was overwritten.

# MiniLM integration repair probe

18 September 2026. Developer-only follow-up to the frozen admission failure; no app installation or training. Preserve all previous artifacts and thresholds.

1. Quantize Gather weights only in the existing FP32 graph, leaving MatMul arithmetic FP32. Compare the same 20 operator probes against new Python CPU outputs on installed Node CPU and Node-hosted WASM, retaining atol=rtol=1e-4. Count the full pack against 300,000,000 bytes. Report FP32 differences descriptively; a random classifier cannot establish privacy quality.
2. Test explicit grapheme-wise NFC before converted fast tokenization, mapping every returned offset back to whole original graphemes. Compare IDs to original slow SentencePiece on all 407 corpus cases and 476 original windows. Inspect lexical coverage and exact token source associations against SentencePiece immutable-proto offsets. A native-only offset success does not qualify the JavaScript or packaged app path.
3. Record failures without relaxing gates. Keep production fingerprints unchanged. No remote requests during inference, no private input, no automatic downloads. Existing installed dependencies and cached pinned assets only.

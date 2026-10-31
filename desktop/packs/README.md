# Recognition packs

A **recognition pack** is the optional download that adds contextual categories (names, addresses, organizations and other private information) to the built-in rule-based detection. Everything the app knows about the models it runs lives in one JSON file in this directory. Replacing the models means editing that file, pinning the new files, and passing the same checks the current pack passes. No TypeScript or Rust changes are needed for a pack that follows the contract below.

The shipping pack is [`vietnamese-pii-v1.json`](vietnamese-pii-v1.json). The build embeds it in three places that always agree because they read the same file:

| Consumer | What it uses |
| --- | --- |
| `src/core/detection/pack.ts` | Validates the file at startup, exposes `recognitionPack` to the loaders and the Settings page. |
| `src-tauri/src/models.rs` | Downloads, verifies and installs the `assets`; serves exact tokenizer offsets for models with `"offsets": "native"`. |
| `src-tauri/src/bin/*` | Feature-gated evaluation and native-inference helpers read the same `models` list. |

## File format

```jsonc
{
  "id": "vietnamese-pii-v1",            // stable, path-safe; installed versions live under models/<id>/
  "name": "Gói nhận diện tiếng Việt",   // shown in Settings and as the provenance of every model finding
  "attribution": "Underthesea + OpenMed · Nguồn: Hugging Face · Giấy phép Apache 2.0.",
  "models": [                            // run in this order; each gets its own bounded windows
    {
      "directory": "underthesea",        // subdirectory of the pack root
      "source": "Underthesea · INT8",    // internal provenance before the pack name replaces it
      "graph": "model_int8",             // <graph>.onnx is loaded
      "offsets": "native",               // see “Choosing offsets” below
      "labels": { "PER": "PERSON", "LOC": "LOCATION", "ORG": "ORGANIZATION" },
      "minScore": 0.3                    // optional; spans whose mean token probability is lower are dropped
    },
    { "directory": "vietnamese-pii-multilingual", "source": "OpenMed · mSuperClinical · INT8",
      "graph": "model_int8", "offsets": "sequential", "minScore": 0.3 }
  ],
  "assets": [                            // every file of every model, pinned by size and SHA-256
    {
      "directory": "underthesea",
      "name": "model_int8.onnx",
      "bytes": 204645861,
      "sha256": "9e95…",
      "transport": {                     // how the installer fetches it
        "url": "https://…/bbe0….zst",    // null until published; the app then says the pack has no download
        "bytes": 158225764,              // transferred bytes (compressed)
        "sha256": "bbe0…",               // digest of the transferred bytes
        "encoding": "zstd",              // or "identity"
        "parts": []                      // optional ordered split of large transfers; url must be null when used
      }
    }
  ]
}
```

Rules enforced by `validatePackDefinition` (TypeScript) and `Pack::validate` (Rust), and covered by `tests/recognition-pack.test.mjs`:

- `id`, every `directory`, `graph` and asset `name` are plain file-name components (no separators, no `..`).
- Every model directory lists `<graph>.onnx`, `config.json`, `tokenizer.json` and `tokenizer_config.json`; every asset belongs to a listed model; no duplicates. `LICENSE` is written by the installer and may not be listed.
- Transport URLs are `https` without credentials. `identity` transports must repeat the installed size and digest. Multi-part transports add up to the transport size and carry no top-level URL.
- The install directory name is the SHA-256 of the `assets` array alone. Changing `name`, `attribution` or `models` therefore never orphans an existing installation; changing any file does, and the previous version is left on disk.

## What a model must provide

The shared code around the models is fixed; a pack only supplies models that fit it.

- **Task:** ONNX token classification with BIO labels. `config.json` must carry `id2label`; `tokenizer.json` must load in Transformers.js (and in the Rust `tokenizers` crate for native offsets).
- **Inputs:** `input_ids` with exactly one leading CLS and one trailing SEP token; `attention_mask` and `token_type_ids` are supplied as all ones / all zeros when the graph declares them. Any other input name is rejected.
- **Output:** `logits` shaped `[1, tokens, labels]`, finite values only. Each window holds at most 384 tokens; `src/core/detection/chunks.ts` builds overlapping windows at grapheme boundaries.
- **Labels:** after the optional `labels` map, the canonical labels the policy understands are `PERSON`, `FIRST_NAME`, `MIDDLE_NAME`, `LAST_NAME`, `USERNAME`, `EMAIL`, `PHONE`, `ACCOUNT_NUMBER`, `IBAN`, `ID_NUM`, `SSN`, `CREDIT_CARD`, `CVV`, `PIN`, `PASSWORD`, `API_KEY`, `STREET_ADDRESS`, `BUILDING_NUMBER`, `LOCATION`, `ZIPCODE`, `GPS_COORDINATES`, `IP_ADDRESS`, `ORGANIZATION` and `DATE_OF_BIRTH` (`src/core/detection/model-policy.ts`). Unknown labels are ignored. Only `PERSON`/`LOCATION`/`ORGANIZATION` evidence (types `TEN`, `DIA_CHI`, `TO_CHUC`) is kept from models; structured values such as account numbers come from the shared rules.
- **Licensing:** the installer writes the Apache-2.0 text from `docs/licenses/models-Apache-2.0.txt` into each model directory. A pack under another license needs that file and `attribution` updated, and the license recorded in a decision.

### Choosing `offsets`

Detections must point at exact positions in the user's original text.

- `"sequential"`: the JavaScript aligner in `src/core/detection/source-offsets.ts` walks the tokenizer pieces in order against the NFC-normalized text. It works for Metaspace/SentencePiece-style tokenizers whose pieces reproduce the source characters (the OpenMed models).
- `"native"`: the Rust `tokenizers` crate reports byte offsets for the same `tokenizer.json`, converted to UTF-16 units. The JavaScript token IDs must match the native IDs exactly, or the request fails closed. Use this when pieces do not reproduce the source (the Underthesea model). The optional `labels` map translates the model's label set; with a map present, unmapped labels become `O`.

### Choosing `minScore`

Optional, per model. A decoded span whose mean token probability is below `minScore` is dropped; absent means every span counts. Raise it only from a measured sweep that regresses no gate: `scripts/score-threshold/evaluate.mjs` runs the pack fixtures and the annotated corpora at several values. The shipped pack uses 0.3: at 0.4 an organization in the corpora was only partly covered ([decision 0079](../../docs/decisions/0079-file-review-and-capital-names.md)).

## Replacing the models, step by step

1. **Put the files in place.** Create `artifacts/packs/<id>/<directory>/` for each model with its ONNX graph, `config.json`, `tokenizer.json` and `tokenizer_config.json`. `artifacts/` is ignored by git; pack weights are never committed (the one committed graph is the small text recogniser built into the app, decision 0181).
2. **Describe the models.** Copy or edit a file in `packs/`, set `id`, `name`, `attribution` and the `models` list. Point `src/core/detection/pack.ts`, `src-tauri/src/models.rs`, `src-tauri/src/bin/*.rs` and `src-tauri/src/model_pack.rs`'s test helper at the new file name if you created one.
3. **Pin the files.**

   ```sh
   mise exec -- pnpm pack:prepare packs/<id>.json artifacts/packs/<id>
   ```

   This writes identity-transport `assets` entries with `url: null`. The pack is now valid for local use and reports “no download available” in Settings.

4. **Run the code checks.** `mise exec -- pnpm test` validates the file and exercises the loaders with fake models; `pnpm lint`, `pnpm build` and `pnpm check:native` must stay green.
5. **Run the model checks.**

   ```sh
   mise exec -- cargo build --manifest-path src-tauri/Cargo.toml --release --features recognition-evaluation --bin recognition-tokenizer-check   # only for native offsets
   mise exec -- pnpm test:models artifacts/packs/<id>
   ```

   A candidate that only replaces one model can be checked before `pack.ts` points at it: copy the shipping file, pin the replaced directory into the copy (`pnpm pack:prepare <copy> <root> <directory>`, the other models' entries are kept) and pass `--definition <copy>` to `check-pack.mjs` and `evaluate-documents.mjs`. `scripts/train/README.md` builds such a candidate by fine-tuning the Underthesea model on the synthetic document set ([decision 0163](../../docs/decisions/0163-fine-tune-the-pack-model.md)). `pnpm compare:packs --candidate <copy> --candidate-root <root> --ablate` measures it against the shipping pack on the held-out sets and lists which structural mechanisms it still needs ([decision 0164](../../docs/decisions/0164-pack-comparison-and-ablation.md)).

   `scripts/check-pack.mjs` verifies every pinned file, loads the pack on the Node CPU runtime with network access disabled, and masks the synthetic fixtures in `tests/fixtures/recognition-pack.json`: every `sensitive` value must be fully covered, every `retain` value must survive, and keeping all findings must reproduce the input exactly. A fixture marked `knownMiss` documents a limitation of the current pack; it is reported, not failed, unless you pass `--strict`. A replacement pack must pass every unmarked fixture and should remove `knownMiss` entries it fixes. Pass `--fixtures <file>` for additional synthetic cases; never add real customer text.

6. **Try it in the app.** Copy the model directories into the app-local data directory under `models/<id>/` (macOS: `~/Library/Application Support/dev.offlinemask.desktop/models/<id>/<directory>/…`). The app verifies the hashes at startup and reports the pack as ready without downloading anything.
7. **Publish.** Compress each file with Zstandard, upload the objects, and fill in `transport` (see [Decision 0041](../../docs/decisions/0041-compressed-pack-installer-and-r2.md) and `scripts/build-r2-pack.mjs` for the shipping pack's procedure; [Decision 0169](../../docs/decisions/0169-ship-the-fine-tuned-underthesea-graph.md) for replacing one file: only the changed file gets a new object, the other entries stay). Re-run `pnpm test`, repin the two totals in `tests/recognition-pack.test.mjs` and the fingerprint and totals in `src-tauri/src/model_pack.rs`, and verify the published objects with `scripts/verify-r2-pack.mjs <inventory> <receipt>`.
8. **Record the evidence.** Add a decision under `docs/decisions/` and an evaluation under `docs/evaluations/` stating what was measured on which fixtures. A green fixture run is a regression check, not an accuracy claim.

## Text recognition models

The models that read text in pictures where the system cannot (Windows, [decision 0181](../../docs/decisions/0181-own-line-recogniser-for-windows.md)) are not a pack: they ship inside the app, described by [`reading/reading-v1.json`](../reading/reading-v1.json) (each file's size, SHA-256 and source, the detector's post-processing, the recogniser's classes). `scripts/prepare-reading.mjs` puts them in the build; `pnpm eval:documents <scans> --reading` measures them; `scripts/ocr-train/` trains the recogniser.

## What a pack cannot change

The six user-facing categories, the structured-value rules, the plausibility rules for model spans (field separators, contract parties, boilerplate phrases, a 0.6 score bar on one-word spans; decisions 0080 and 0081), the alias format and the review flow are shared code with their own tests. A pack changes which contextual evidence feeds that policy, nothing else. The historical OpenMed development models under `scripts/model-manifest.json` are kept for reproducing earlier evaluations and are not a pack.

# 0054 — Replaceable recognition packs and open-source readiness

Date: 11 October 2026. Status: accepted by the owner's request to prepare the repository for public contribution and to make replacing the local models "simple and quick" for contributors, provided the existing tests and specifications keep passing.

## Context

The app depended on one model pair in a way that was spread across the code: the two model directories, their graph file name, which one needed native tokenizer offsets, its label translation, the provenance strings and the Settings copy were literals in `recognition.ts`, `native-recognition.ts`, `recognition-source.ts`, `model-policy.ts`, `ModelSettings.vue`, `models.rs`, `recognition_tokenizer.rs`, `recognition_native.rs`, `recognition_sidecar.rs`, `recognition_process.rs` and three evaluation binaries. The download catalog lived in `scripts/release-pack-v1.json` next to frozen experiments. A contributor swapping a model had to find and edit all of these consistently, and nothing checked that they had.

The repository was also written for its owner: the README described acceptance history rather than the project, there was no security policy, code of conduct or issue guidance, and `src/core/` was excluded from formatting and partly from linting because evaluation protocols had fingerprinted it.

## Decisions

### One pack definition file

`packs/<id>.json` now describes a recognition pack completely: `id`, user-facing `name`, `attribution`, the ordered `models` (directory, provenance, graph file, offset strategy, optional label map) and the pinned `assets` with their transports. The shipping file is `packs/vietnamese-pii-v1.json`, moved from `scripts/release-pack-v1.json` with the `assets` array unchanged. [packs/README.md](../../packs/README.md) is the contributor guide.

- `src/core/detection/pack.ts` validates the file at module load (`validatePackDefinition`) and exports `recognitionPack`. Settings reads the name, attribution and sizes from it.
- `src-tauri/src/model_pack.rs` deserializes the same file with `deny_unknown_fields` and validates the model entries against the catalog in addition to the existing transport rules.
- The install directory name is the SHA-256 of the serialized `assets` array alone (`Pack::fingerprint`, formerly `Pack::id`). A unit test pins the shipping value `65245d3f…`, which is the directory already installed on the owner's machine, so adding model metadata did not orphan existing installations.

### Loaders are generic over the pack

`recognition.ts` exposes `loadPackRecognition(pack, root, encode, backend)`. A `ModelBackend` turns one pack model into a `ModelSession` (tokenizer plus raw predictions); `wasmBackend` is the default Transformers.js/ONNX Runtime WASM path and `native-recognition.ts` provides the opt-in native backend over the Tauri bridge. `createPackProvider` applies the pack's offset strategy and label map; `createRecognition` relabels every model source to the pack name. `loadRecognition(root, encode, device)` keeps its signature so the frozen production replay still imports it.

`attachRecognitionOffsets` takes the label map as a parameter instead of hard-coding PER/LOC/ORG. With a map, unmapped labels become `O` (unchanged behaviour for the shipping pack); without one, labels pass through.

The worker's encode request and the `recognition_encode` command carry the model directory. Rust looks the directory up in the pack, requires `"offsets": "native"`, verifies that model's `tokenizer.json` against the pinned size and digest, and caches one tokenizer per directory. More than one native-offset model is therefore possible.

`recognition_native.rs`, the sidecar supervisor and the two feature-gated binaries iterate the pack's `models` and use `<graph>.onnx`; the model index bound is the pack's model count rather than the literal `1`.

### Contributor gates

- `tests/recognition-pack.test.mjs` (7 tests) checks the shipping file, the validation rules a contributor is most likely to trip, and the loader contract with fake models: pack order, native offsets requested per directory with the label map applied, sequential alignment otherwise, pack-name provenance, disposal on partial load failure, and bridge release on a session-count mismatch.
- `pnpm test:models <pack root>` runs `scripts/check-pack.mjs`: it verifies every pinned file, loads the real pack on the Node CPU runtime with fetch disabled, and masks `tests/fixtures/recognition-pack.json`. Entries marked `knownMiss` document a limitation of the current pack and are reported rather than failed (pass `--strict` to fail them). The fixture is a copy of `tests/fixtures/text-model.json`, which stays untouched because a protocol pins its hash, plus the long-tail case the legacy evaluator appended.
- `pnpm pack:prepare <pack.json> <model root>` (`scripts/prepare-pack.mjs`) pins local model files into identity-transport `assets` entries with `url: null`, which the installer already treats as "no download available", so a pack can be tried locally before it is published.
- The legacy OpenMed development evaluation is now `pnpm test:models:legacy`.

### Formatting and the former source freeze

`src/` is formatted and linted uniformly; the Prettier exclusion of `src/core/**`, `src/workers/**` and `src/adapters/text-detection.ts` is lifted and the regex-escape ESLint exemption narrowed to `src/core/detection/**`. The evaluation protocols under `docs/evaluations/` that fingerprint these sources remain valid for the commit they recorded; the last commit with the previous formatting and the old pack path is `3138fc2`. Frozen experiment scripts under `scripts/` subdirectories are unchanged and still reference `scripts/release-pack-v1.json`; reproduce them from history as [scripts/README.md](../../scripts/README.md) describes.

### Repository files for a public project

README rewritten for readers who are not the owner; CONTRIBUTING updated for the pack workflow and the lifted formatting freeze; new SECURITY.md (GitHub private vulnerability reporting, scope, design commitments), CODE_OF_CONDUCT.md, issue and pull request templates with synthetic-data reminders; `license` field in `package.json`. The O’Saasy license, copyright and product-direction history are unchanged.

### Small fixes made on the way

`models::tests::progress_pushes_are_coalesced_but_forced_pushes_are_not` raced the status change against the notifier push and could fail under parallel test load; it now waits for the push and starts the coalescing interval itself. `combinedModelSource` and `defaultModelSource` in `model-policy.ts` replace two OpenMed-specific strings that the runner and pack relabelling always overwrote.

## Verification

On macOS 26.6 / Apple Silicon with the pinned toolchain:

- `pnpm lint`, `pnpm typecheck`, `pnpm build`: pass; the bundle still emits one `dist/runtime/*.wasm`.
- `pnpm test`: 188 tests pass (181 existing, 7 new). One existing test was updated to pass the label map explicitly.
- `cargo fmt --check`, `cargo clippy -D warnings` with the default features, with `native-inference-prototype,recognition-evaluation,recognition-native-sidecar`, and with `recognition-native-desktop`: pass. `cargo test --locked`: 16 pass, 2 ignored (the explicit 712 MB download checks).
- Production parity: the frozen `scripts/recognition-production-v1/evaluate.mjs`, run from an isolated copy with only its import paths and the pack path adjusted, replayed all **398** recorded cases through the refactored `loadRecognition` and the rebuilt `recognition-tokenizer-check` harness: **398/398 match, zero network attempts**. Source wording is excluded by that script, as before.
- `pnpm test:models artifacts/recognition-production-v1/models`: all pinned files verified, 13 of 14 fixtures pass, the uppercase negative example reported as the documented known miss; `--strict` fails it as intended.

Not verified here: a packaged desktop run (the IPC change adds one argument to `recognition_encode`; the worker and the Rust command were changed together and the frozen replay exercises the same tokenizer), Windows and Linux compilation, and the hosted CI run.

## Consequences

Replacing or adding a model is a change to one JSON file, the files it pins, and the evidence that the two gates pass. Code changes are needed only when a model breaks the contract in [packs/README.md](../../packs/README.md) (input layout, label vocabulary, offsets). Future work that touches `src/core/**` formats normally; new evaluation evidence should pin the sources it ran against as before.

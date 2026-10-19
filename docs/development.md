# Development foundation

Initialized on 9 September 2026 using the official `create-tauri-app@4.7.4` Vue/TypeScript template in a temporary directory, then merged into this repository while preserving the product documents.

## Tools and dependencies

`mise.toml` is the source of truth for development tool versions. mise selects the existing Node LTS installation, installs pnpm, and manages Rust through rustup. The Rust toolchain includes Clippy and rustfmt. `package.json` repeats the pnpm pin for package-manager enforcement. Update both pins together when upgrading pnpm.

| Tool or direct dependency | Installed version |
| --- | --- |
| Node.js | 24.10.0 |
| pnpm | 11.18.0 |
| Rust / Cargo | 1.98.1 |
| Tauri Rust crate | 2.11.5 |
| Tauri CLI | 2.11.4 |
| Tauri JavaScript API | 2.11.1 |
| Vue | 3.5.42 |
| Vite | 8.2.2 |
| TypeScript | 6.0.3 |
| Vue Vite plugin | 6.0.8 |
| vue-tsc | 3.3.11 |
| Node types | 24.13.3 |

These are the resolved scaffold versions, not a claim that every package is the latest release. `pnpm-lock.yaml` and `src-tauri/Cargo.lock` record the complete dependency graphs. The existing pnpm version and the generator's dependency ranges were retained.

Use the commands in the [README](../README.md). `mise exec --` ensures the project versions apply even if the terminal has not activated mise. This machine has mise 2026.5.16 and the macOS Command Line Tools; mise itself was not upgraded.

## Structure and boundaries

Since 20 October 2026 the repository is a pnpm workspace ([Decision 0106](decisions/0106-workspace-layout.md)): the desktop app lives in `desktop/`, the product website in `landing/`, and `brand/theme.css` holds the tokens both use. Paths below such as `src/`, `src-tauri/`, `tests/`, `scripts/` and `packs/` are under `desktop/`, and the commands in this document run from that directory (`pnpm -C desktop …`, or `cd desktop` first).

- `src/App.vue`: shell only. Owns navigation and focus hand-off, and provides the three shared stores below to its pages.
- `src/composables/`: `useRecognitionPack` (optional pack status and actions), `useSessions` (sidebar list and sample-only persistence), `useMaskingRun` (draft, category choices, one in-flight run), `useTextReview` (manual selection, hide, undo). Plain factories with injected dependencies; see [Decision 0051](decisions/0051-shell-refactor-and-tooling.md).
- `src/pages/`: `HomePage`, `SettingsPage` and `WorkspacePage` (real text entry and table samples, explicit masking, original/masked views, individual choices, copying, session removal).
- `src/components/AppSidebar.vue`: navigation, session history (private sessions titled by their masked first line via `src/core/session-preview.ts`), settings entry, website link and version.
- `src/components/RestorePanel.vue` and `src/core/restore.ts`: in-session restoration of exact aliases from a pasted AI reply; unknown alias-shaped tokens are reported, never guessed.
- `src/components/AppIcon.vue`: local SVG icons.
- `src/core/review.ts`: portable fixture types, explicit decisions, tokenization, sample alias replacements, and the final-copy gate.
- `src/core/text.ts`: provider-span validation, overlap policy, aliases, and exact transformations.
- `src/core/detection/`: contact, banking and labelled-field rules, token-bounded source windows, and the model pipeline. `pack.ts` validates the pack definition from `packs/`; `recognition.ts` loads every pack model through a `ModelBackend` (WASM by default, native when opted in); `policy.ts` is the one place model and rule evidence meet. See [Decision 0054](decisions/0054-replaceable-recognition-packs.md).
- `packs/`: recognition pack definitions, the single source of truth for model directories, graph files, offset strategy, label maps and pinned downloads; [packs/README.md](../desktop/packs/README.md) is the contributor guide for replacing models.
- `src/workers/detection.worker.ts` and `src/adapters/text-detection.ts`: cancellable local inference. Exact tokenizer offsets for native-offset models are requested per model directory through the `recognition_encode` command.
- `src/core/sessions.ts`: private in-memory text sessions, versioned sample records, sample-only persistence, and synthetic table transformations.
- `tests/sessions.test.mjs`: history round trips, independent choices, serialization boundaries, invalid history, and table preservation.
- `tests/composables.test.mjs`: store persistence boundary, pushed status with polling fallback, run cancellation/failure paths, manual review hide/undo.
- `tests/restore.test.mjs`: exact-alias restoration, unknown/rewritten alias reporting, manual corrections, sidebar previews.
- `tests/review.test.mjs`: built-in Node test runner coverage for review gating, exact preservation, and consistent aliases.
- `src/adapters/desktop.ts` and `src/adapters/models.ts`: the only frontend modules importing Tauri APIs: the product website opener, and the pack status/download commands plus the `model-status` event subscription.
- `src/style.css`: the brand theme tokens (paper/ink/cobalt, light and dark), system fonts, keyboard focus and narrow-window layouts.
- `brand/`: the product mark (`[—]`) as SVG in ink/paper/mono variants plus the app-icon tile; `pnpm tauri icon brand/tile-cobalt.svg` regenerates `src-tauri/icons/`. Rules in `brand/README.md`.
- `src-tauri/src/`: Rust application entry points. `model_pack.rs` parses and validates the pack definition and installs it; `models.rs` owns download status and the per-model native tokenizers; `recognition_tokenizer.rs` converts byte offsets to UTF-16 units. No private-data commands or storage.
- `src-tauri/capabilities/default.json`: grants status event listening and opening the fixed product website to the main window.
- `src-tauri/tauri.conf.json`: desktop window, development hooks, local assets, and content security policy.

Add feature modules and workers when their first implementation exists, following [Decision 0001](decisions/0001-desktop-stack.md). Text libraries and model packaging are documented in [Decision 0005](decisions/0005-library-text-detection.md). File parsers and vault technology remain open decisions.

The development bundle identifier is `dev.offlinemask.desktop`. Review ownership and release identity before distributing signed builds. The Tauri application icons are generated from `brand/tile-cobalt.svg`.


## Offline scope

The app has no remote fonts, UI assets, updater, telemetry, or network plugin. The opener plugin handles the explicit product website link. Production CSP limits connections to local assets, scoped app-local model resources, and Tauri IPC, and permits local workers/WASM for text inference. Development permits the local Vite server and HMR; browser preview does not receive Tauri's production CSP.

This establishes a small starting surface, not complete offline or privacy certification. Clean disconnected installation, attempted-connection monitoring, Windows WebView2 offline provisioning, Linux prerequisites, signing/notarization, and the supported OS/CPU matrix remain release work. No sensitive-data persistence should be added until the vault lifecycle is designed.


## Optional recognition pack

Normal builds prepare the local WASM runtime but neither require nor include model weights, even when `public/models/` exists. Vite public copying is disabled; `prepare-assets.mjs` copies only non-model assets. The desktop bundle embeds the staged frontend and has no model resource mapping.

The native `models` module downloads only the URLs pinned in the embedded pack definition (`packs/vietnamese-pii-v1.json`) on an explicit Settings action. Its reqwest client runs on a background thread and pushes small status objects to the frontend as `model-status` events, coalescing progress to one push per 200 ms; the frontend reads the status once on start and after each action. Pinned byte counts and SHA-256 digests gate activation. The model root is `<app_local_data_dir>/models/<pack id>`; installed versions live under `packs/<sha256 of the asset list>` beneath it, and a directory holding the exact pinned files directly under the root is also recognised, which is how a developer tries a local pack. Partial files resume after cancellation or restart. The Tauri asset protocol can read only the model subtree. Runtime inference disallows remote models and has no remote CSP allowance.

Once the installed pack reports ready, the app prepares it in the background using the same worker and loading promise as masking. This is local initialization, not a download or update check; preparation receives no source text and runs no inference.

`mise exec -- cargo test --manifest-path src-tauri/Cargo.toml --locked` checks resume, cancellation, range rejection, corruption, incomplete installs and pack validation using a loopback test server. `pnpm test` covers local-only routing, selected-category scope and the pack contract without weights. `pnpm test:models <pack root>` runs the real pack against the committed synthetic fixtures; [packs/README.md](../desktop/packs/README.md) describes the pack contract and how to replace the models. See [Decision 0006](decisions/0006-optional-models.md) and [Decision 0054](decisions/0054-replaceable-recognition-packs.md).

Manual review uses browser selection offsets mapped through aliases and textarea newline normalization. Tests must preserve untouched characters, keep choices, grapheme boundaries, non-reused aliases and the private-session serialization exclusion. Undo covers the last manual correction and does not rewind the session's alias counter.

## Reproducing evaluations

Each evaluation under `docs/evaluations/` has a decision that states what it showed and what it did not. The scripts that produced them live in `scripts/` subdirectories and are frozen: their protocols pin SHA-256 fingerprints of the sources they ran against, so reproduce a historical result from its recorded sources in an isolated copy and start a new versioned experiment for new work ([scripts/README.md](../desktop/scripts/README.md)). All of them use local synthetic fixtures, block inference-time fetches and leave the installed user pack untouched. The commands below are the entry points; the linked reports hold prerequisites, artifact locations and limitations.

**Current pack gate** ([packs/README.md](../desktop/packs/README.md), [Decision 0054](decisions/0054-replaceable-recognition-packs.md)):

```sh
mise exec -- cargo build --manifest-path src-tauri/Cargo.toml --release --features recognition-evaluation --bin recognition-tokenizer-check
mise exec -- pnpm test:models artifacts/packs/vietnamese-pii-v1
```

**Production pair replay**, 398 recorded synthetic outcomes ([report](evaluations/recognition-production-v1/README.md), [Decision 0042](decisions/0042-production-recognition-pair.md)):

```sh
mise exec -- node scripts/recognition-production-v1/evaluate.mjs <output.json>
```

**Tokenizer offsets and text reliability** with the pinned development assets ([report](evaluations/2026-09-10-text-reliability.md), [Decision 0007](decisions/0007-text-positioning-and-manual-review.md)):

```sh
mise exec -- node scripts/check-tokenizer-offsets.mjs
mise exec -- node scripts/check-text-reliability.mjs
```

**Historical OpenMed checkpoint comparison** on the 66-case synthetic corpus ([protocol](evaluations/model-comparison-protocol.md), [Decision 0010](decisions/0010-vietnamese-model-selection.md)); `pnpm models:download` fetches the pinned development models first:

```sh
mise exec -- pnpm compare:models
mise exec -- pnpm test:models:legacy
```

**Isolated macOS runtime benchmark** of the production worker in a separate app identity ([report](evaluations/2026-09-10-desktop-runtime.md), [Decision 0008](decisions/0008-address-boundary-completion.md)). Open the generated **OfflineMask Benchmark.app**, choose **Run benchmark**, and create `artifacts/native-benchmark/stop-monitor` to stop the memory monitor; rebuild with the ordinary `desktop:build` afterwards:

```sh
mise exec -- node scripts/build-desktop-benchmark.mjs
mise exec -- pnpm exec vue-tsc --noEmit -p scripts/desktop-benchmark/tsconfig.json
mise exec -- pnpm desktop:build --config artifacts/native-benchmark/tauri.conf.json --bundles app -- --locked
mise exec -- python3 scripts/monitor-desktop-benchmark.py
```

**Native inference prototype** on macOS arm64 ([Decision 0009](decisions/0009-native-inference-prototype.md)); run `scripts/native-prototype/monitor.py` before the native evaluation for memory sampling:

```sh
mise exec -- cargo build --manifest-path src-tauri/Cargo.toml --locked --release --features native-inference-prototype --bin offlinemask-native-prototype
mise exec -- node scripts/native-prototype/evaluate.mjs cpu
mise exec -- node scripts/native-prototype/evaluate.mjs native
mise exec -- node scripts/native-prototype/evaluate.mjs wasm
mise exec -- node scripts/native-prototype/compare.mjs
mise exec -- node scripts/native-prototype/check-lifecycle.mjs
```

**Single-model versus pair decision** ([report](evaluations/2026-09-11-model-decision.md)):

```sh
mise exec -- pnpm models:check
mise exec -- python3 scripts/run-model-decision.py
mise exec -- node scripts/report-model-decision.mjs
```

**Shared detector comparison** ([report](evaluations/shared-core-comparison.md), [Decision 0013](decisions/0013-shared-detection-comparison.md)) and its **native preprocessing** follow-up ([Decision 0014](decisions/0014-native-preprocessing-evaluation.md)). Candidate runs need a local interpreter with `tokenizers==0.22.2` passed as `OFFLINEMASK_EVAL_PYTHON`; run configurations sequentially:

```sh
mise exec -- node scripts/shared-core/parity.mjs
mise exec -- node scripts/shared-core/evaluate.mjs small
mise exec -- node scripts/shared-core/evaluate.mjs large
mise exec -- node scripts/shared-core/evaluate.mjs combined
OFFLINEMASK_EVAL_PYTHON=/path/to/venv/bin/python mise exec -- node scripts/shared-core/evaluate.mjs bigmed
OFFLINEMASK_EVAL_PYTHON=/path/to/venv/bin/python mise exec -- node scripts/shared-core/evaluate.mjs underthesea
mise exec -- node scripts/shared-core/report.mjs
OFFLINEMASK_EVAL_PYTHON=/path/to/venv/bin/python mise exec -- node scripts/native-preprocessing/evaluate.mjs 1
mise exec -- node scripts/native-preprocessing/report.mjs
```

**Release challenge and local-scope audit** ([report](evaluations/release-challenge-v1.md), [Decision 0015](decisions/0015-release-challenge-evidence.md)): reproduction commands are in the report; `scripts/challenge-local-scope.mjs` checks the no-pack engine without loading models.

**Detector feasibility audit** ([report](evaluations/detector-feasibility.md), [Decision 0019](decisions/0019-single-detector-feasibility.md)):

```sh
mise exec -- node scripts/detector-feasibility/audit.mjs
```

The later policy, corpus, MiniLM and recognition-runtime experiments (Decisions [0016](decisions/0016-complete-values-and-field-meaning.md) through [0049](decisions/0049-native-release-packaging.md)) each document their own commands in their evaluation README or spec.

## Native release preparation (macOS arm64, Windows x64)

`mise exec -- pnpm desktop:build:native` prepares the pinned ONNX Runtime and helper, builds the normal UI with native recognition, signs the package (ad hoc locally unless `APPLE_SIGNING_IDENTITY` is set), and verifies the resulting bundle. This path never seeds app data or downloads the recognition pack. The pack remains optional and manually downloaded. Build dependencies must already be available for an offline build.

For an isolated QA build, run `mise exec -- node scripts/prepare-native-desktop.mjs --qa`, then `mise exec -- pnpm tauri build --features recognition-native-release --bundles app --config artifacts/native-desktop/tauri.conf.json`. Verify it with `mise exec -- node scripts/verify-native-desktop.mjs 'src-tauri/target/release/bundle/macos/OfflineMask Release QA.app'`. The QA identity starts without model fixtures; staging does not install any. Do not launch the production identity to test failure/restart behavior while a user has RAM-only sessions open.

Runtime/license provenance is in `docs/licenses/onnxruntime-1.24.3/README.md`. Signed builds verify the complete bundle locally before loading recognition. Re-signing correctly changes the runtime bytes, so only pre-signing staging uses the upstream full-file checksum. Public Developer ID/notarization and project licensing are separate release prerequisites; ad hoc QA signing is not public distribution approval. Browser and ordinary `tauri dev` workflows retain WASM; `mise exec -- pnpm desktop:dev:native` runs `tauri dev` with the native helper instead.

On Windows x64 ([Decision 0077](decisions/0077-native-recognition-windows.md)), `desktop:build:native` additionally needs Visual Studio with the C++ tools: it bundles the Visual C++ runtime DLLs next to `onnxruntime.dll`, compiles the SHA-256 of every native file into the app, checks the PE imports, and starts the packaged helper once. The `Windows native build` workflow does the same on `windows-latest` and uploads the installers. Windows stays off the `desktop:build` default until the manual checklist in Decision 0077 passes on a Windows PC.

The standard `mise exec -- pnpm desktop:build` selects this verified native path on macOS arm64. Other platforms retain the prior Tauri build. Custom QA configurations use explicit `tauri build` as above. Current local QA ZIP size is about 18 MB; this is separate from the optional recognition pack and is not a public notarized installer measurement.

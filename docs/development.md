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

- `src/App.vue`: shell only. Owns navigation and focus hand-off, and provides the three shared stores below to its pages.
- `src/composables/`: `useRecognitionPack` (optional pack status and actions), `useSessions` (sidebar list and sample-only persistence), `useMaskingRun` (draft, category choices, one in-flight run), `useTextReview` (manual selection, hide, undo). Plain factories with injected dependencies; see [Decision 0051](decisions/0051-shell-refactor-and-tooling.md).
- `src/pages/`: `HomePage`, `SettingsPage` and `WorkspacePage` (real text entry and table samples, explicit masking, original/masked views, individual choices, copying, session removal).
- `src/components/AppSidebar.vue`: navigation, session history (private sessions titled by their masked first line via `src/core/session-preview.ts`), settings entry, website link and version.
- `src/components/RestorePanel.vue` and `src/core/restore.ts`: in-session restoration of exact aliases from a pasted AI reply; unknown alias-shaped tokens are reported, never guessed.
- `src/components/AppIcon.vue`: local SVG icons.
- `src/core/review.ts`: portable fixture types, explicit decisions, tokenization, sample alias replacements, and the final-copy gate.
- `src/core/text.ts`: provider-span validation, overlap policy, aliases, and exact transformations.
- `src/core/detection/`: model, contact, banking providers and token-bounded source windows.
- `src/workers/detection.worker.ts` and `src/adapters/text-detection.ts`: cancellable local inference.
- `src/core/sessions.ts`: private in-memory text sessions, versioned sample records, sample-only persistence, and synthetic table transformations.
- `tests/sessions.test.mjs`: history round trips, independent choices, serialization boundaries, invalid history, and table preservation.
- `tests/composables.test.mjs`: store persistence boundary, pushed status with polling fallback, run cancellation/failure paths, manual review hide/undo.
- `tests/restore.test.mjs`: exact-alias restoration, unknown/rewritten alias reporting, manual corrections, sidebar previews.
- `tests/review.test.mjs`: built-in Node test runner coverage for review gating, exact preservation, and consistent aliases.
- `src/adapters/desktop.ts` and `src/adapters/models.ts`: the only frontend modules importing Tauri APIs: the product website opener, and the pack status/download commands plus the `model-status` event subscription.
- `src/style.css`: the brand theme tokens (paper/ink/cobalt, light and dark), system fonts, keyboard focus and narrow-window layouts.
- `brand/`: the product mark (`[—]`) as SVG in ink/paper/mono variants plus the app-icon tile; `pnpm tauri icon brand/tile-cobalt.svg` regenerates `src-tauri/icons/`. Rules in `brand/README.md`.
- `src-tauri/src/`: minimal Rust application entry points; no private-data commands or storage.
- `src-tauri/capabilities/default.json`: grants status event listening and opening the fixed product website to the main window.
- `src-tauri/tauri.conf.json`: desktop window, development hooks, local assets, and content security policy.

Add feature modules and workers when their first implementation exists, following [Decision 0001](decisions/0001-desktop-stack.md). Text libraries and model packaging are documented in [Decision 0005](decisions/0005-library-text-detection.md). File parsers and vault technology remain open decisions.

The development bundle identifier is `dev.offlinemask.desktop`. Review ownership and release identity before distributing signed builds. The Tauri application icons are generated from `brand/tile-cobalt.svg`.

## Documentation studied and applied

Context7 was used to resolve and query the official Tauri documentation, Vue documentation, pnpm documentation, and mise documentation. Current official pages supplemented details absent from those results.

| Documentation | Application to this scaffold |
| --- | --- |
| [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) | macOS desktop uses Command Line Tools and Rust; mobile SDKs were not installed. |
| [Tauri project creation](https://v2.tauri.app/start/create-project/) | Official Vue/TypeScript scaffold using pnpm. |
| [Tauri Vite integration](https://v2.tauri.app/start/frontend/vite/) | Fixed port 1420, matching `devUrl`, build hooks, and ignored Rust watch directory. |
| [Vue TypeScript overview](https://vuejs.org/guide/typescript/overview.html) | Composition API with `script setup`; explicit vue-tsc checks because Vite only transpiles. |
| [Vite getting started](https://vite.dev/guide/) | Supported Node LTS and a production frontend build. |
| [Tauri capabilities](https://v2.tauri.app/security/capabilities/) | Main-window capability with one metadata permission; template opener removed. |
| [Tauri CSP](https://v2.tauri.app/security/csp/) | Explicit production policy allowing local assets and IPC; development policy additionally allows local Vite traffic. |
| [pnpm install](https://pnpm.io/cli/install) | Frozen lockfile installs and an exact package-manager pin. |
| [mise Node cookbook](https://mise.jdx.dev/mise-cookbook/nodejs.html) and [Rust support](https://mise.jdx.dev/lang/rust.html) | Project tool pins and rustup-backed toolchain management. |

## Offline scope

The app has no remote fonts, UI assets, updater, telemetry, or network plugin. The opener plugin handles the explicit product website link. Production CSP limits connections to local assets, scoped app-local model resources, and Tauri IPC, and permits local workers/WASM for text inference. Development permits the local Vite server and HMR; browser preview does not receive Tauri's production CSP.

This establishes a small starting surface, not complete offline or privacy certification. Clean disconnected installation, attempted-connection monitoring, Windows WebView2 offline provisioning, Linux prerequisites, signing/notarization, and the supported OS/CPU matrix remain release work. No sensitive-data persistence should be added until the vault lifecycle is designed.

## Original scaffold verification

The current review workspace replaces the original input screen; see [review design notes](review-design.md) for its checks.

Verified on macOS 26.6.2 / Apple Silicon:

- `mise exec -- pnpm install --frozen-lockfile` passed without changing dependency resolution.
- `mise exec -- pnpm build` passed both Vue/app and Vite-config type checking, then generated production assets.
- `mise exec -- pnpm check:native` passed rustfmt and Clippy with warnings denied.
- `mise exec -- pnpm desktop:dev` started Vite, compiled the debug target, and launched `target/debug/offlinemask`. The temporary development process was stopped after verification.
- `mise exec -- pnpm tauri build --bundles app -- --locked` produced `src-tauri/target/release/bundle/macos/OfflineMask.app`.
- The bundled app launched from local assets with the development server stopped. The footer showed native version `0.1.0`, verifying IPC under the production CSP and capability configuration.
- Browser UI checks passed sample loading, clearing, Vietnamese text input, leading-zero retention, and resetting text on reload. The packaged app passed sample loading and clearing with Vietnamese text rendered correctly.

Windows and Linux have not been built or tested here. The UI checks do not certify Vietnamese IME composition, grapheme counting, file processing, or complete offline installation.

### Optional models

Normal builds prepare local WASM but neither require nor include model weights, even when `public/models/` exists. Vite public copying is disabled; `prepare-assets.mjs` copies only non-model assets. The desktop embeds the staged frontend and has no model resource mapping.

The native `models` module downloads only compile-time manifest URLs on an explicit Settings action. Its reqwest client runs on a background thread and pushes small status objects to the frontend as `model-status` events, coalescing progress to one push per 200 ms; the frontend reads the status once on start and after each action. Pinned byte counts and SHA-256 digests gate activation. The model root is `<app_local_data_dir>/models/vietnamese-pii-v1`; partial files resume after cancellation or restart. Tauri asset protocol can read only the model subtree. Runtime inference disallows remote models and has no remote CSP allowance.

Once the installed shipping pack reports ready, the app prepares it in the background using the same worker and loading promise as masking. This is local initialization, not a download or update check. Preparation receives no source text and runs no inference. The developer-only [preload benchmark](evaluations/recognition-preload-v1/README.md) measures a request eight seconds into preparation; production collects no timings.

`mise exec -- cargo test --manifest-path src-tauri/Cargo.toml --locked` checks resume, cancellation, range rejection, corruption, and incomplete installs using a loopback test server. `pnpm test` covers local-only routing and selected-category scope without weights. Full quality evaluations remain opt-in via `pnpm test:models`. See [Decision 0006](decisions/0006-optional-models.md).

For the original checkpoint comparison, run `mise exec -- pnpm compare:models` with both pinned development models already available. This verifies hashes and runs Small, Large, and the pair in two fresh-process rounds with network fetch disabled. It writes per-case JSON and a Markdown comparison under ignored `artifacts/model-comparison/`; it does not download models or touch app-local installations. The 66-case corpus is synthetic and diagnostic, not representative production validation. CPU timing/peak RSS are separate from desktop WASM performance. See the [original protocol](evaluations/model-comparison-protocol.md) and [current selection decision](decisions/0010-vietnamese-model-selection.md).

Underthesea/BigMed evaluation is separate developer tooling, with explicit downloads and an isolated Python conversion environment. Follow the [alternative model protocol](evaluations/alternative-model-protocol.md); no alternative models, Python dependencies, or evaluation scripts are part of the desktop app. The ongoing real-model regression suite now also includes the uppercase unknown-token case discovered by the broader corpus.

### Source positioning and manual correction checks

After changes to tokenizer alignment, run `mise exec -- node scripts/check-tokenizer-offsets.mjs` with the pinned development assets present. It checks 120 actual-tokenizer mappings offline, including NFD, NBSP, literal special tokens, repeated text, and emoji. Run `mise exec -- node scripts/check-text-reliability.mjs` for the fresh synthetic diagnostic set; this records remaining detection misses instead of treating successful processing as full coverage. See [reliability evidence](evaluations/2026-09-10-text-reliability.md).

Manual review uses browser selection offsets mapped through aliases and textarea newline normalization. Tests must preserve untouched characters, keep choices, grapheme boundaries, non-reused aliases, and the private-session serialization exclusion. Undo is for the last manual correction and does not rewind the session's alias counter.

### Isolated macOS runtime benchmark

The developer-only benchmark uses the production worker, model status adapter, and single-threaded WebKit/WASM backend. It does not ship in the normal app. After verifying local development model files, run:

```sh
mise exec -- node scripts/build-desktop-benchmark.mjs
mise exec -- pnpm exec vue-tsc --noEmit -p scripts/desktop-benchmark/tsconfig.json
mise exec -- pnpm desktop:build --config artifacts/native-benchmark/tauri.conf.json --bundles app -- --locked
mise exec -- python3 scripts/monitor-desktop-benchmark.py
```

Open the generated **OfflineMask Benchmark.app** and explicitly choose **Run benchmark**. The Mac must be unlocked for interactive checks. It runs synthetic short, 2,000-, 10,000-, and 50,000-character cases, displaying cold/warm detection times, address coverage, and main-thread heartbeat delays. Cold means a new worker/model initialization, not an emptied OS file cache. The first-progress timestamp includes model loading, chunk planning, and the first chunk; it is not pure load time.

The build script hard-links already downloaded development weights into a distinct `dev.offlinemask.benchmark.address20260910` application-data directory. The native manager validates them normally. No Internet download or production model-file mutation occurs. Do not run the benchmark alongside builds or CPU evaluations when measuring speed.

The memory monitor starts before launch and samples newly created benchmark/WebKit processes every 500 ms. Correlate the new WebKit processes with benchmark launch/exit before attributing them; it is not a generic per-app memory accounting API. Create `artifacts/native-benchmark/stop-monitor` to stop and write `memory.json`. It also streams `memory-samples.jsonl` during the run. RSS is resident memory at sampled instants; the separate `proc_pid_rusage` physical-footprint reading includes compressed pages. Neither is a minimum RAM specification. Preserve failed-run artifacts before restarting the monitor.

The isolated harness persists only synthetic timings, counts, coverage booleans, and phase markers in its own localStorage. It accepts no user text. On a WebContent reset, the previous incomplete phase is displayed instead of presenting a lost report as success. The normal production entry point has no benchmark metrics storage.

After benchmarking, close the isolated app, remove only its dedicated test-data directory if no longer needed, and rebuild with the ordinary `desktop:build` command to restore the default executable/build configuration. The normal bundle never includes benchmark UI or model weights.

### Native inference experiment

This developer-only prototype is excluded from the normal app. It requires verified local development models and the existing macOS arm64 `onnxruntime-node` library; the launcher verifies the runtime against its pinned hash. It neither downloads weights nor alters the installed user pack.

```sh
mise exec -- cargo build --manifest-path src-tauri/Cargo.toml --locked --release --features native-inference-prototype --bin offlinemask-native-prototype
mise exec -- node scripts/native-prototype/evaluate.mjs cpu
mise exec -- node scripts/native-prototype/evaluate.mjs native
mise exec -- node scripts/native-prototype/evaluate.mjs wasm
mise exec -- node scripts/native-prototype/compare.mjs
mise exec -- node scripts/native-prototype/check-lifecycle.mjs
```

For memory sampling, run `mise exec -- python3 scripts/native-prototype/monitor.py` immediately before the native evaluation. It reads the evaluation's exact parent/child PIDs and writes under ignored `artifacts/native-prototype/`. Create `artifacts/native-prototype/stop-monitor` when evaluation finishes. Run timing measurements without concurrent builds or evaluations. The WASM comparison under Node is for output parity, not WebKit performance. See [decision 0009](decisions/0009-native-inference-prototype.md).

### Frozen single-model versus pair decision

The [11 September comparison](evaluations/2026-09-11-model-decision.md) rejects SuperClinical, mSuperClinical, and their combination as final release configurations. It uses 56 fresh synthetic texts with the existing policy and screening floor, two native runs per configuration, one WASM run per configuration, and physical-footprint monitoring. Both native rounds have identical final predictions. The ordinary test suite passing does not override this quality rejection.

With the native prototype above already built and the development weights available:

```sh
mise exec -- pnpm models:check
mise exec -- python3 scripts/run-model-decision.py
mise exec -- node scripts/report-model-decision.mjs
```

These developer commands require macOS arm64 for the existing prototype/runtime and memory monitor. They use local files, block inference-time fetches, and leave the installed user pack untouched. Raw run files are written under ignored `artifacts/model-decision/`; the report generator writes the dated JSON evaluation under `docs/evaluations/`. The [protocol](evaluations/2026-09-11-model-decision-protocol.json) locks fixture and implementation hashes before inference. A changed implementation needs a separate versioned experiment; do not silently rewrite this historical protocol to make a rerun pass. The now-observed fixtures are regression evidence, not fresh validation for future fixes.

### Bounded text-field reliability and no tracking

[Decision 0011](decisions/0011-bounded-text-field-detection.md) adds bounded colon-labelled name/address values, category reconciliation before selection, and punctuation/multiline boundary repairs. It does not select a new model or migrate the runtime. The [14 September evaluation](evaluations/2026-09-14-text-reliability.md) records the initial rejected contact-filter experiment, final no-regression results, and a fresh final validation set. Test procedures write only synthetic developer artifacts. Do not add analytics, automatic input/error uploads, or correction collection to improve detection; real input never becomes evaluation material.

[Decision 0012](decisions/0012-structured-credentials-and-identifiers.md) extends explicit field recognition to credentials, role-labelled accounts and postcodes, and retains supported labelled transaction facts. It reconciles categories before checkbox filtering without changing model availability. The [structured-value evaluation](evaluations/2026-09-14-structured-values.md) records the frozen comparison, reproduction prerequisites and remaining category/false-positive limitations. Its fresh fixtures are now regression cases, not fresh validation for subsequent changes.

### Shared detector comparison

[Decision 0013](decisions/0013-shared-detection-comparison.md) separates the common runner/policy from pinned model loading. Use the versioned `scripts/shared-core/` harness for comparisons with the latest policy. The old alternative adapter remains a historical implementation.

With the pinned production and alternative development weights already supplied locally:

```sh
mise exec -- node scripts/shared-core/parity.mjs
mise exec -- node scripts/shared-core/evaluate.mjs small
mise exec -- node scripts/shared-core/evaluate.mjs large
mise exec -- node scripts/shared-core/evaluate.mjs combined
OFFLINEMASK_EVAL_PYTHON=/absolute/path/to/evaluation/bin/python mise exec -- node scripts/shared-core/evaluate.mjs bigmed
OFFLINEMASK_EVAL_PYTHON=/absolute/path/to/evaluation/bin/python mise exec -- node scripts/shared-core/evaluate.mjs underthesea
OFFLINEMASK_EVAL_PYTHON=/absolute/path/to/evaluation/bin/python mise exec -- node scripts/shared-core/evaluate.mjs underthesea-fp32
mise exec -- node scripts/shared-core/report.mjs
```

The candidate interpreter must already contain `tokenizers==0.22.2`; the helper installs nothing. Use the interpreter inside the virtual environment, preserving its path rather than resolving its symlink to a system interpreter. Store long-lived evaluation environments under ignored workspace artifacts rather than temporary directories. Run configurations sequentially. Each command validates frozen source/fixture hashes and selected model file hashes before inference, then blocks fetch. The parity harness reconstructs the old detector from frozen source evidence, using real WASM predictions once and replaying them through the new runner. It does not require an ignored pre-change snapshot to survive a clean checkout. Candidate inference uses the same Node CPU backend; native offset references for Underthesea and BigMed are development tooling, not a shipping Python dependency. No performance ranking is produced because reference tokenization is prepared separately. BigMed currently records seven tokenizer-ID mismatches; a completed runner process does not mean that every request succeeded.

The checked-in protocols are historical evidence. The current harness uses `shared-core-protocol-v2.json` and writes raw runs under `artifacts/shared-core-v2/`. `freeze.mjs` is the explicit experiment-freezing tool and refuses to overwrite an existing protocol; do not delete the protocol to make changed source pass. Future changes need a new versioned experiment. Results are diagnostic on observed fixtures and do not qualify OCR, PDF, Excel or a release checkpoint.

### Consistent native BigMed preprocessing

The subsequent `scripts/native-preprocessing/` experiment uses native token counts and native IDs for inference, resolving the seven mismatches in the older shared-core adapter. It leaves that frozen adapter unchanged. With the same local interpreter and pinned BigMed assets, run `scripts/native-preprocessing/evaluate.mjs 1` and `2` via `mise exec -- node`, setting `OFFLINEMASK_EVAL_PYTHON` as above, then run `scripts/native-preprocessing/report.mjs`. The provider uses a prepared native count/encoding cache for known synthetic fixtures; it is not a shipping tokenizer architecture. Both rounds complete, but BigMed still fails the quality screen. See [Decision 0014](decisions/0014-native-preprocessing-evaluation.md) and the [results](evaluations/native-preprocessing-comparison.md). No candidate or dependency is installed by those commands.

### Frozen release challenge and actual local-scope audit

The [release challenge v1 report](evaluations/release-challenge-v1.md) records ten sequential candidate runs over 100 newly authored synthetic cases, frozen before inference, and a separate audit of the actual no-pack engine. All candidates fail the challenge; this is not a release selection. The set is now observed and must not be reused as fresh final validation after development changes.

The frozen scripts are in `scripts/challenge-core/`; `scripts/challenge-local-scope.mjs` verifies actual local-only selections without loading models. Use the reproduction commands in the report with the already installed evaluation interpreter and model artifacts. Evidence writers refuse overwrites. No production imports, dependencies, downloads or telemetry are added. See [Decision 0015](decisions/0015-release-challenge-evidence.md) for scope differences and remaining validation.

### Current shared-policy hardening

The subsequent [policy improvement](evaluations/policy-hardening.md) changes the shared production policy for bounded prose credentials, labelled passport/tax identifiers and wrapped address boundaries. It keeps the same pack and six categories. `scripts/policy-hardening-v2/` records that before/after experiment; older frozen evaluators intentionally reject the changed source tree. Reproduce historical results with their recorded sources in an isolated copy, rather than weakening fingerprint checks.

The final pair comparison repeats all 362 observed cases, with unchanged model-derived outputs. `scripts/policy-hardening-selected-audit.mjs` reconstructs the original policy from verified sources and checks partial category coverage on the same real predictions. The report records gains, remaining misses and exact reproduction commands. All 100 unit tests, the build and 14 model regressions pass; this is not a new packaged-runtime qualification or final checkpoint decision. See [Decision 0016](decisions/0016-complete-values-and-field-meaning.md).

The latest [context-field experiment](evaluations/context-fields.md), in `scripts/context-fields/`, adds pinned `ipaddr.js` 2.5.0 IPv6 parsing, explicit date semantics and bounded organization completion. Its two 362-case runs preserve model-derived predictions and all prior private coverage, complete 12 additional occurrences and reduce challenge ordinary masking. All 108 unit tests, the build and 14 real-model regressions pass. Existing screening gates still fail; the report documents remaining gaps. See [Decision 0017](decisions/0017-contextual-fields.md) for library provenance and syntax limits. This is the current source fingerprint; historical protocols remain unchanged.

The [candidate recheck](evaluations/model-recheck.md) uses `scripts/model-recheck/` to compare six configurations twice under this fingerprint. All 4,344 case executions complete and outputs repeat exactly; no configuration qualifies. It reports original and product-scope card scoring separately, exact coverage losses and exploratory CPU/resource observations. The 110-test suite passes. No production code, dependency, model manifest or runtime changed. See [Decision 0018](decisions/0018-model-recheck.md) for the rejection and bounded next direction.

The subsequent [single-detector feasibility preparation](evaluations/detector-feasibility.md) adds a provenance/annotation/split auditor and a small authored development seed. Run `mise exec -- node scripts/detector-feasibility/audit.mjs`; structural validity is distinct from pilot readiness, which currently remains false. No training/final corpus or admitted replacement exists. [Decision 0019](decisions/0019-single-detector-feasibility.md) records the proposed MiniLM export/offset/size probe and predeclared prototype budgets. No model or dataset payload was downloaded.

The subsequent [MiniLM admission prototype](evaluations/minilm-admission.md) explicitly downloads one pinned base checkpoint into developer artifacts and tests a random classification head with zero training. Its 140.24 MB complete compressed pack meets the size target, but tokenizer/source-mapping and compressed WASM parity gates fail. Production source/dependencies remain unchanged and 115 tests pass. [Decision 0020](decisions/0020-minilm-admission.md) holds training admission pending bounded integration repair; exact versions and artifact hashes are linked from the report.

The [MiniLM integration repair](evaluations/minilm-repair.md) follows the frozen admission failures without changing app behavior. Gather-only compression measures 203.89 MB and passes 20/20 CPU/Node-hosted WASM fidelity probes. Explicit NFC with native reference offsets passes the observed lexical association checks across 407 inputs and 476 windows. A shipping offset implementation, packaged-runtime qualification and reviewed training data remain required; this is not a trained or release-selected privacy detector. See [decision 0021](decisions/0021-minilm-integration-repair.md).

The [native MiniLM tokenizer adapter](evaluations/minilm-native.md) removes the Python runtime requirement for the prototype. Its isolated Rust crate produces verified UTF-16 raw/masking spans, passes 883 exact reference comparisons, 31 boundary/failure checks and 20 native-to-WASM inference comparisons. The standalone executable is developer-only; feature-gated Tauri integration, packaged offline/resource tests and reviewed training data remain outstanding. See [decision 0022](decisions/0022-native-minilm-tokenizer.md).

The [packaged MiniLM probe](evaluations/minilm-desktop.md) adds the opt-in `minilm-desktop-prototype` feature. Normal builds exclude its tokenizer dependency and diagnostic commands. The isolated macOS app passes 20/20 reference comparisons and cancellation/recovery checks, but exceeds warm latency, long-document latency and sampled memory budgets. Keep it disabled; next compare native graph execution and separate tokenizer/IPC allocations. See [decision 0023](decisions/0023-minilm-desktop-resources.md). The probe uses a separate app identifier and a numeric-metrics-only report sink; it never installs into the normal model pack.

The [packaged native graph comparison](evaluations/minilm-native-desktop.md) adds `minilm-native-desktop-prototype`, also off by default. The same graph passes 20/20 reference comparisons and improves sampled footprint to 835 MB, but warm/long latency still fails and a 1,032 ms heartbeat stall needs attribution. Active graph cancellation passes; the tokenizer-cancellation assertion did not exercise accepted cancellation in this run. Continue phase-level profiling and cancellation hardening before activation. See [decision 0024](decisions/0024-minilm-native-resource-comparison.md).

The [native phase profile](evaluations/minilm-profile.md) measures inference as the dominant cost and adds a bounded request-local encoding cache plus a two-thread comparison. Its component speed/memory budgets pass, window/offset identity is preserved and accepted tokenizer cancellation succeeds. The separate [foreground follow-up](evaluations/minilm-focus.md) records 205 ms warm p95, 5.224 seconds for 50,000 characters and no long foreground timer stall; its normal launch has no memory/network-deny measurement. Earlier background gaps and failed launch evidence remain preserved. See [decision 0025](decisions/0025-minilm-runtime-profile.md). The candidate remains untrained and disabled; reviewed corpus readiness and complete trained-pipeline qualification are still required.

The [first corpus expansion](evaluations/detector-corpus-v1.md) adds 60 authored families and an independent review ledger bound to exact source/contract digests. `scripts/detector-corpus-v1/prepare.mjs` generates a create-only local review pack and validates text/template/scenario/value separation. All 91 combined records remain pending review, family/type quotas still fail, and no final holdout or training run is created. See [decision 0026](decisions/0026-independent-corpus-review.md). The previous corpus and evidence are preserved; new batches must not rewrite frozen sources or approvals.

The [local training hardware diagnostic](evaluations/minilm-local-training.md) tests the existing FP32 MiniLM on the M1 Pro GPU without corpus access, optimizer updates or checkpoint writes. Preserve its initial 6 GiB-cap failure at batch two. A fixed batch-one follow-up completes eight forward/backward passes with finite gradients and unchanged parameter hashes, observing 4.19 GB maximum driver allocation. This supports continuing locally; actual optimizer/long-run/label-alignment checks remain gated by reviewed corpus readiness. See [decision 0027](decisions/0027-local-training-hardware.md). No cloud jobs, dependency downloads or application changes are introduced.

The [second corpus batch](evaluations/detector-corpus-v2.md) adds 70 authored families for thin private types and ordinary contrasts, bringing totals to 65 training and 93 development families. `scripts/detector-corpus-v2/prepare.mjs` preserves the first batch, rejects within-partition duplicate-family inflation and emits exact coverage deficits with a pending review ledger. All 161 records await independent review; type/training-family quotas still fail. See [decision 0028](decisions/0028-targeted-corpus-expansion.md). No weights are trained or activated.

**Current direction:** [decision 0029](decisions/0029-defer-custom-detector-training.md) defers custom fine-tuning after the owner's data/maintenance concern. Preserve the corpus and hardware experiments as research; stop treating quota completion as the release path. Reassess a maintained pretrained detector plus scoped local rules without reversing prior candidate failures or making new coverage claims. The optional annotation review page is a development draft; no human approval or browser qualification is implied.

The [pretrained responsibility comparison](evaluations/pretrained-scope.md) runs 1,810 case executions with exact prior-output replay, then restricts contextual predictions before the unchanged shared policy. Narrowing alone still fails and exposes structured-rule gaps. Underthesea is the compact engineering candidate, BigMed the broad control; neither is selected for release. A separate actual-engine audit distinguishes raw local helper findings from the three no-pack options. See [decision 0030](decisions/0030-pretrained-responsibility-split.md). Next address bounded structured recognizers while preserving scope, pinned weights and historical evidence.

The [bounded structured-value repair](evaluations/structured-gaps-v1.md) adds labelled cards/security codes, IPv4, named birthday bridges and TSV account cells to the shared policy. The new versioned harness preserves old source inside its protocol, exactly replays both model baselines and records zero new complete/partial/category losses or ordinary masking across 724 case executions. All 146 tests and type checking pass. The separate actual no-pack engine check covers its supported 73/73 and 53/53 values; full-scope model screening still fails. See [decision 0031](decisions/0031-bounded-structured-gaps.md). No model replacement or training is enabled.

The [contextual Unicode and boundary diagnosis](evaluations/contextual-repair-v1.md) applies two bounded shared address fixes and evaluates inference-only NFC for the compact candidate. It records 739 case executions, exact prior-baseline replay, 151 passing tests and successful type checking. NFC recovers five NFD names but introduces one ordinary-text false-positive case; it remains a developer adapter. Token evidence identifies remaining classifier/category failures. The pair and compact candidate retain failed regression screening; only the normalized compact challenge subset passes. See [decision 0032](decisions/0032-contextual-unicode-and-boundaries.md). No pack replacement, training or UI change is enabled.

The [final bounded single-model comparison](evaluations/single-model-decision-v1.md) rejects both Underthesea and BigMed for release under unchanged criteria. Underthesea has stronger own-category coverage (463/470 vs 448/470), while BigMed masks less ordinary text. Neither passes both corpora. Two isolated offline Underthesea resource probes pass developer speed/memory targets with 12/12 output parity each; packaged runtime qualification is not implied. All 151 application tests pass. The [12-case owner review](evaluations/single-model-decision-v1/review.md) remains pending. [Decision 0033](decisions/0033-single-model-release-rejection.md) closes selection for these unchanged checkpoints without modifying the current development pack or restarting training.

The [owner review reconciliation](evaluations/single-model-owner-review-v1.md) now records all twelve responses and the explicit instruction to hide the customer ID in example 5. The separate completed receipt and reviewed-case overlay supersede the old pending review status without rewriting historical evidence. BigMed matches nine selected examples, Underthesea five; these counts are not overall accuracy or release approval. Exact source spans and 24 model assessments are verified. [Decision 0034](decisions/0034-owner-review-reconciliation.md) retains both release rejections and makes no production/category/training changes.

**Owner review correction:** the owner subsequently confirmed that organization names should be hidden. The [v2 review receipt](evaluations/single-model-owner-review-v2.md) supersedes v1's case-8 keep-visible expectation; it restores agreement with the existing organization scope. Example 8 remains a failure for both models because the legal prefix is missed and the body is labelled as a location. Counts remain A 5/12 and B 9/12. No unresolved scope conflict remains within these twelve examples, and no detector/pack change was made.

The [review-first validation batch](evaluations/review-first-validation-v1.md) freezes 24 new assistant-authored synthetic examples (30 proposed sensitive spans, five ordinary contrasts) before any model execution. All annotations await owner review, with exact source/annotation hashes and a prior-text collision scan. New wording is not independent-holdout evidence. The [review page](evaluations/review-first-validation-v1/review.md) is organized in groups of six. Models must not run on this batch before explicit annotation review is complete; no model/production change is included.

**Review-first batch completed:** the owner approved all 24 exact annotations before model execution. The [new validation results](evaluations/review-first-validation-v1-results.md) record 48 successful case executions under unchanged weights/policy: Underthesea covers 26/30 values (5/8 names) with 99 extra ordinary lexical positions; BigMed covers 22/30 (1/8 names) with eight. Both fail existing criteria. [Decision 0035](decisions/0035-reviewed-validation-rejects-current-candidates.md) retains release rejection without another model or production change. This batch is now observed regression evidence; the initial pending ledger is preserved as history and superseded by the four approval receipts.

### Native macOS arm64 release preparation

`mise exec -- pnpm desktop:build:native` prepares the pinned ONNX Runtime and helper, builds the normal UI with native recognition, signs the package (ad hoc locally unless `APPLE_SIGNING_IDENTITY` is set), and verifies the resulting bundle. This path never seeds app data or downloads the recognition pack. The pack remains optional and manually downloaded. Build dependencies must already be available for an offline build.

For an isolated QA build, run `mise exec -- node scripts/prepare-native-desktop.mjs --qa`, then `mise exec -- pnpm tauri build --features recognition-native-release --bundles app --config artifacts/native-desktop/tauri.conf.json`. Verify it with `mise exec -- node scripts/verify-native-desktop.mjs 'src-tauri/target/release/bundle/macos/OfflineMask Release QA.app'`. The QA identity starts without model fixtures; staging does not install any. Do not launch the production identity to test failure/restart behavior while a user has RAM-only sessions open.

Runtime/license provenance is in `docs/licenses/onnxruntime-1.24.3/README.md`. Signed builds verify the complete bundle locally before loading recognition. Re-signing correctly changes the runtime bytes, so only pre-signing staging uses the upstream full-file checksum. Public Developer ID/notarization and project licensing are separate release prerequisites; ad hoc QA signing is not public distribution approval. Other platforms remain unqualified for native recognition. Browser and ordinary `tauri dev` workflows retain WASM.

The standard `mise exec -- pnpm desktop:build` selects this verified native path on macOS arm64. Other platforms retain the prior Tauri build. Custom QA configurations use explicit `tauri build` as above. Current local QA ZIP size is about 18 MB; this is separate from the optional recognition pack and is not a public notarized installer measurement.

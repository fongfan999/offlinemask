# 0051 — Shell refactor, pushed pack status and repository tooling

Date: 9 October 2026. Status: accepted by the owner's instruction to apply the full project review, with one constraint: the application must keep masking exactly as before.

## Context

A whole-project review found the app structurally sound but carrying debt that made further work slower and riskier: one 700-line `App.vue` holding every concern, a one-second status poll, a duplicated 23 MB runtime binary in every bundle, a download timeout that could fail forever on slow links, several `Mutex::unwrap()` calls under `panic = "abort"`, and no formatter, linter or continuous integration. The owner asked for all of it to be addressed.

## Decisions

### Frontend shell split

`src/App.vue` is now a shell of roughly 130 lines that owns navigation and provides three shared stores to its pages through typed `provide`/`inject` keys (`src/composables/context.ts`):

| Module | Responsibility |
| --- | --- |
| `composables/useRecognitionPack.ts` | Optional pack status, download/pause actions, readiness. |
| `composables/useSessions.ts` | Sidebar session list, sample-only persistence, add/remove/find. |
| `composables/useMaskingRun.ts` | Draft, category choices, one in-flight detection run, background pack preparation. |
| `composables/useTextReview.ts` | Manual selection capture, hide selection, undo. |
| `components/AppSidebar.vue` | Navigation, history, settings entry, website and version footer. |
| `pages/HomePage.vue`, `pages/SettingsPage.vue`, `pages/WorkspacePage.vue` | The three screens, unchanged in markup and CSS classes. |

Templates were moved rather than redesigned; `src/style.css` gained one rule (`.editor-actions`) for a second heading button. Pages expose `focusHeading` and `focusResult` so the shell keeps the previous focus management. Composables are plain factories with injected dependencies and are covered by `tests/composables.test.mjs` (10 tests) without a DOM.

### Pack status is pushed, not polled

The native `Models` manager accepts a notifier and emits `model-status` on every stage change, coalescing download/install progress to one push per 200 ms. The frontend subscribes once, reads the status once on start and once after each user action, and falls back to slow polling only if subscribing fails. The capability grants `core:event:allow-listen` and `core:event:allow-unlisten`; the unused `core:app:allow-version` grant and `getDesktopVersion` were removed. No other events, payloads or network behavior were added.

### A detection run continues while the user navigates

Navigation no longer cancels a running detection or terminates the worker. The run finishes and its session is added to the sidebar. If the user is still on the text entry page it becomes the active session as before; otherwise it waits in the list. The explicit "Hủy xử lý" action and unmount keep the behavior recorded in [Decision 0043](0043-cancellation-recovery.md); the clause there about navigation performing a hard termination is superseded by this decision.

### Sessions can be removed

An active session shows "Xóa phiên" beside "Phiên mới". Removing a private session frees its text and findings from memory without quitting the app; removing a sample session updates the stored history. No confirmation dialog was added, following the owner's "less is more" direction.

### One copy of the WASM runtime

Vite emits the onnxruntime-web binary referenced by the detection worker at `dist/runtime/ort-wasm-simd-threaded.asyncify.wasm`, the exact path the detector already loads, through `assetFileNames` on both the main and worker bundles. `prepare-assets.mjs` no longer copies `public/runtime/`, which remains for `vite dev` and evaluation scripts. The production bundle shrank from 46 MB to 23 MB with no path change at runtime.

### Native download and locking

- Range requests shrank from 8 MiB to 2 MiB and the whole-request timeout rose from 60 s to 120 s. The blocking reqwest 0.12 client has no per-read idle timeout, so this pair bounds the slowest completing connection at about 140 kbit/s instead of about 1.1 Mbit/s.
- The undocumented `?offset=` query appended to each range request was removed; the `Range` header already carries that information and the query defeated range caching.
- Status and tokenizer mutexes recover from poisoning with `PoisonError::into_inner`; both guard plain data. The remaining `unwrap()` calls are in tests.

### Tooling

Prettier (print width 100) and ESLint (recommended JS, typescript-eslint, eslint-plugin-vue, eslint-config-prettier) were added with `pnpm lint` and `pnpm format`. A GitHub Actions workflow runs lint, build, tests, `check:native` and `cargo test` on macOS, plus an advisory `cargo check` on Ubuntu and Windows. The workflow has not yet executed on a hosted runner.

`tsconfig.json` targets ES2022, matching the WebKit/WebView2 runtimes and the Node configuration. Context7 was not available in this session; Tauri permission identifiers were taken from the generated schema under `src-tauri/gen/schemas/`.

### Deliberately not changed

- `src/core/**`, `src/workers/**`, `src/adapters/text-detection.ts` and the experiment directories under `scripts/` are fingerprinted by evaluation protocols in `docs/evaluations/`. They are excluded from formatting, left unmodified, and get a narrow ESLint exemption for regex escapes. The review's suggestion to move the experiments out of `scripts/` was dropped for the same reason; `scripts/README.md` indexes build tooling versus frozen experiments instead.
- Startup hash verification of the installed pack (Decision 0006) is unchanged; a size/mtime fast path remains a possible follow-up.
- The 50,000-character message inside `src/core/text.ts` stays as recorded; the entry hint now derives its figure from `maxTextLength`.

## Verification

On macOS 26.6 / Apple Silicon with the pinned toolchain:

- `pnpm lint`, `pnpm typecheck`, `pnpm build`: pass. Bundle layout confirmed with a single `dist/runtime/*.wasm`.
- `pnpm test`: 177 tests pass (167 existing, 10 new composable tests).
- `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test --locked`: pass, including two new notifier tests.

Not verified here: a packaged desktop run with the installed pack exercising the new status events and the background-run behavior, Windows and Linux compilation, and the hosted CI run. These remain release-gate checks; see [docs/release/macos-arm64.md](../release/macos-arm64.md).

## Consequences

Pages and composables can now be tested and changed independently. The glue that previously had no tests is covered. Status changes reach the UI immediately instead of within a second. Users on slow connections can complete the optional download. Later work that touches `src/core/**` must still start a new versioned experiment, as before.

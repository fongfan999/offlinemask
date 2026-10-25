# Contributing to OfflineMask

Thank you for helping. OfflineMask is source available under the [O’Saasy License Agreement](LICENSE.md); by contributing you agree that your contribution is licensed under the same terms. Security problems go through [SECURITY.md](SECURITY.md), not public issues.

## Local setup

Use the pinned tools in `mise.toml`; do not rely on globally installed Node, pnpm or Rust. Follow the [README setup](README.md#getting-started) and the [development notes](docs/development.md). Commit both lockfiles (`pnpm-lock.yaml`, `src-tauri/Cargo.lock`). Downloading build dependencies needs the network; the application's offline requirement is separate.

Before opening a pull request, run:

```sh
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm lint
mise exec -- pnpm -C desktop build
mise exec -- pnpm -C desktop test
mise exec -- pnpm -C desktop check:native
mise exec -- pnpm -C desktop test:native
```

The repository is a pnpm workspace: `desktop/` is the Tauri app, `landing/` the product website (`pnpm -C landing deploy:check` builds it and dry-runs its deployment). Lint and format run at the root over both.

Run the native checks whenever `desktop/src-tauri/` or native configuration changes. For UI changes, verify keyboard interaction and narrow windows in the browser preview, then smoke-test the packaged desktop app. Record which platforms you actually tested; a macOS build does not establish Windows or Linux support.

## Changing the models

The recognition models are described by one file under `packs/`. Read [packs/README.md](desktop/packs/README.md): it lists the model contract, the step-by-step replacement procedure and the two gates every pack must pass, `pnpm test` (code and pack contract, no model files) and `pnpm test:models` (the real models against the committed synthetic fixtures, offline). A green run is a regression check; detection quality claims need an evaluation recorded under `docs/evaluations/` and a decision under `docs/decisions/`. A change to the PDF reader, the detection rules or a model is also run against a private set of real documents with `pnpm -C desktop eval:documents <folder>` ([decision 0152](docs/decisions/0152-document-evaluation-set.md)); the set stays on the owner's machine, and only counts go into the repository. The synthetic set (`pnpm -C desktop documents:generate`, [decision 0153](docs/decisions/0153-synthetic-document-set.md)) is public and measured the same way.

## Conventions

Read [product direction](docs/product-direction.md) before UI work; it records the accepted baseline and the owner's page-by-page feedback. Apply new feedback to the page it concerns rather than starting a broad redesign.

- Vue Composition API with TypeScript, semantic HTML, standard CSS, and small modules with one responsibility. Portable logic lives in `desktop/src/core/` with no Vue or Tauri imports; `desktop/src/adapters/` is the only place that calls Tauri.
- Prefer documented platform APIs and maintained libraries. Add a dependency for a demonstrated need and record its source, license, runtime cost and offline behaviour in a decision when the choice is substantial.
- `pnpm lint` runs ESLint and Prettier over `desktop/src/`, `desktop/tests/`, `landing/` and the build scripts; `pnpm format` rewrites. The frozen experiments under `desktop/scripts/` subdirectories, `desktop/tests/fixtures/` and `docs/evaluations/` are deliberately excluded (see [scripts/README.md](desktop/scripts/README.md)). CI runs the same commands.
- Use the shared design tokens in `brand/theme.css` (paper, ink, cobalt accent, light and dark; imported by `desktop/src/style.css` and by the landing page) and the `.glass` sheet rule. No remote fonts, animated backdrops, independent surface recipes, or automatic runtime downloads. Explicit user-triggered pack downloads in Settings are the one allowed network action.
- UI copy is Vietnamese. Labels describe behaviour, not implementation.
- Test invariants, persistence boundaries and failure paths rather than component markup. Fixtures are synthetic.
- Record consequential choices in `docs/decisions/` as a new numbered file; do not rewrite earlier decisions or evaluation protocols.
- Use current official documentation for library-specific work (Context7 is available to agents) and note what was consulted.

## Privacy and sample data

Only synthetic fixtures belong in source control, tests, screenshots, logs and issues. Never submit real customer files or identifiers. The plain persisted history holds versioned sample references and mask/keep choices only. Do not extend that storage to user text, workbook contents, private mappings or titles derived from private data. Real input persists only through the passcode vault ([Decision 0062](docs/decisions/0062-passcode-vault.md)); changes to its format or key derivation need a decision and a migration.

Do not add analytics, automatic error uploads, input logging, correction collection or background update checks to improve detection. Evaluation uses explicitly authored synthetic fixtures run locally by developers. Synthetic results measure those fixtures; whether they represent real documents is an unverified assumption, and a green suite is not an accuracy claim.

## Changes and review

Keep changes focused. Describe the user-visible problem, the final behaviour, what you verified and the known limitations. Update documentation with scope or architecture changes. Do not commit generated bundles, credentials, machine-specific paths or private data. Releases are built by [the release workflow](docs/release/github-actions.md) when a maintainer pushes a version tag; signing and notarization are maintainer tasks, see [docs/release/macos-arm64.md](docs/release/macos-arm64.md).

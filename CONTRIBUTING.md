# Contributing to OfflineMask

The project owner has selected the O’Saasy License Agreement for source-available publication; see the [license decision](docs/decisions/0050-osaasy-license.md). The final license file, copyright ownership/attribution, third-party redistribution review, and a private vulnerability-reporting contact remain required before public release. Do not interpret this recorded choice as a completed license grant.

## Local setup

Use the pinned tools in `mise.toml`; do not depend on globally installed Node, pnpm, or Rust versions. Follow [README setup](README.md#development-with-mise) and [development notes](docs/development.md). Commit both dependency lockfiles. The app's offline runtime requirement is separate from downloading build dependencies.

```sh
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm build
mise exec -- pnpm test
mise exec -- pnpm check:native
```

Run native checks when changing Rust or native configuration. For UI changes, verify relevant keyboard interactions and narrow windows in a browser, then smoke-test the packaged desktop application. Record actual platforms and limitations; do not claim cross-platform support from one macOS build.

## Implementation conventions

Read [product direction](docs/product-direction.md) before UI work. The current UI is accepted as the boilerplate baseline; apply later owner feedback page by page rather than initiating an unsolicited broad redesign.

- Use Vue Composition API with TypeScript, semantic HTML, standard CSS, and small components/modules with clear responsibilities. Keep portable transformations separate from native adapters and UI state.
- Prefer documented platform APIs and maintained libraries over proprietary formats or custom infrastructure. Add dependencies for a demonstrated need; record their source, license compatibility, runtime cost, offline behavior, and alternatives in an architecture decision when the choice is substantial.
- Use shared design tokens and the `.glass` surface rule. Do not add independent blur recipes, animated backdrop effects, remote fonts, or automatic runtime asset downloads. Explicit user-triggered model downloads in Settings are allowed; processing and startup remain offline. Use the blue/white/neutral palette; purple and lavender are excluded from the current design direction.
- Study current official documentation (Context7 is available in the agent workflow). Record consequential choices in `docs/decisions/`, and describe unresolved decisions honestly.
- Keep UI copy in Vietnamese for the current prototype. User-facing labels describe behavior, not implementation internals.
- Test transformation invariants, persistence boundaries, and failure paths. Avoid tests that simply repeat trivial component markup.

## Privacy and sample data

Only synthetic fixtures belong in source control, screenshots, tests, logs, and public issues. Do not submit real customer files or identifiers. The current history serializes only versioned sample references and mask/keep choices; it is not an encrypted vault. Never extend that storage path to user text, workbook contents, private mappings, or custom titles derived from private data.

Real-input persistence needs the vault lifecycle described in the [PRD](PRD.md). File support needs a documented compatibility matrix and fixtures. A preview table is not an XLSX parser or writer. Preserve these distinctions in code, documentation, and release notes.

## Changes and review

Keep changes focused. Describe the user-visible problem, final behavior, relevant validation, and known limitations. Update documentation alongside scope or architecture changes. Do not commit generated bundles, credentials, machine-specific paths, or private data. Public repository hosting, CI, release signing, licensing, and vulnerability reporting remain release setup tasks; no remote publishing is implied by this guide.

## Offline evaluation boundary

Do not add analytics, automatic error uploads, user-input logging, correction collection, or background update checks to improve detection. Evaluation uses explicitly authored synthetic fixtures and local developer runs. Real input and manual corrections remain in RAM and never become training/evaluation records. Synthetic results measure those fixtures only; whether their scenarios represent banking employees' actual documents remains an unverified assumption. New detection claims require versioned, independently reviewable evidence, not inferred field accuracy from a green test suite.

# OfflineMask

Mask and restore sensitive data, entirely on your device.

OfflineMask is a planned cross-platform desktop tool for preparing sensitive information before using external AI. The initial focus is Vietnamese banking workflows, with an extensible design for other industries, languages, and file formats.

The MVP covers pasted text, CSV, supported Excel workbooks, user review, consistent aliases, encrypted local restoration mappings, and reusable rule packs and profiles. Required resources can be supplied locally, and the application operates without external network requests.

## Project status

The owner accepted the current UI as **good enough for the boilerplate**, with page-by-page feedback to follow. See [product direction and acceptance notes](docs/product-direction.md) before changing the experience. This is not final design or MVP acceptance.

The desktop boilerplate uses **Tauri 2 + Vue 3 + TypeScript + Vite**, with pnpm for frontend dependencies and a focused Rust layer for native integration. Node, pnpm, and Rust versions are pinned in `mise.toml`.

The home page offers **Text and Excel sample workspaces**, with other formats marked coming soon. Every sample conversion creates a separate session in the left sidebar. Sessions and mask/keep choices survive reloads and app restarts on the same device. Only fixture references and choices are stored; this is not a private-data vault. Excel currently provides a sample table with tab-separated clipboard output, not XLSX import/export.

The interface uses standard CSS glass surfaces with shared tokens and a blue/white palette. No glass library or remote UI assets are required. Real-input detection, file adapters, encrypted storage, and restoration remain unimplemented.

OfflineMask is **intended to be open source**. The owner must select a license before publication; no license has been granted yet. See [contribution guidance](CONTRIBUTING.md) and the [workspace/design decision](docs/decisions/0002-workspace-and-glass.md).

See the [review design notes](docs/review-design.md) for interaction choices and verification.

See the [accepted stack decision](docs/decisions/0001-desktop-stack.md) and [setup notes and documentation reviewed](docs/development.md).

See [the product requirements document](PRD.md) for scope, user journeys, acceptance criteria, and open decisions.

See [Tauri 2 versus Electrobun 2](docs/desktop-framework-comparison.md) for the supporting comparison and unmeasured performance questions.

## Development with mise

Install [mise](https://mise.jdx.dev/getting-started.html) and the [Tauri system prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS. On macOS, the Xcode Command Line Tools are sufficient for desktop development.

```sh
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm desktop:dev
```

With mise activated in your shell, you can use `pnpm desktop:dev` directly. `mise exec` also works from terminals where mise is not activated. No global Node or pnpm version changes are needed. mise manages Rust through rustup.

| Command | Purpose |
| --- | --- |
| `mise exec -- pnpm dev` | Browser preview at localhost:1420; no native APIs. |
| `mise exec -- pnpm typecheck` | Check Vue, TypeScript, and Vite configuration. |
| `mise exec -- pnpm test` | Check sample transformations and the review gate. |
| `mise exec -- pnpm build` | Type check and build frontend assets. |
| `mise exec -- pnpm check:native` | Rust formatting and Clippy checks. |
| `mise exec -- pnpm desktop:build` | Build desktop release and platform bundles. |
| `mise exec -- pnpm tauri build --bundles app -- --locked` | Build a macOS app using the Cargo lockfile. |

Keep `pnpm-lock.yaml` and `src-tauri/Cargo.lock` in version control. Tool installation and initial dependency downloads require a network connection; this is separate from the application's offline runtime requirement.

# Decision 0001: Desktop application stack

Date: 9 September 2026

Status: **Accepted — ready for project initialization.**

## Decision

Build OfflineMask with **Tauri 2, Vue 3, TypeScript, and Vite**. Use **pnpm** for JavaScript dependencies and Cargo for the native application. Keep a single application repository initially; introduce separately published packages only when actual reuse requires them.

| Layer | Selected approach |
| --- | --- |
| Desktop shell | Tauri 2. |
| Frontend | Vue 3 single-file components, Composition API, and TypeScript. |
| Frontend tooling | Vite with strict TypeScript checking. |
| Native integration | Rust and suitable Tauri plugins behind a small, explicit application adapter. |
| Domain logic | Portable TypeScript modules for rules, profiles, review decisions, and transformation contracts. |
| Background work | Dedicated workers for suitable browser-compatible parsing and rule processing; batch native calls. |
| Dependencies | pnpm and Cargo, with their lockfiles checked into version control. |

Tauri officially supports Vue templates and Vite integration. [Project creation](https://v2.tauri.app/start/create-project/), [Vite configuration](https://v2.tauri.app/start/frontend/vite/).

This selects the foundation. Initialization does not need another desktop-framework comparison or an Electrobun prototype.

## Why this choice

The user works fastest in Vue and TypeScript and wants broader compatibility while pilot hardware is unknown. Tauri provides a Windows 10 path and Mac targets for both Intel and Apple Silicon. Electrobun's reviewed release matrix is narrower. This outweighs the potential convenience of a TypeScript main process for the current product. [Windows packaging](https://v2.tauri.app/distribute/windows-installer/), [universal Mac bundles](https://v2.tauri.app/distribute/app-store/), [comparison](../desktop-framework-comparison.md).

Tauri also provides a documented capability model for exposing native functionality to the UI. That model helps constrain frontend access; Rust and plugin code still have the application's system privileges. It does not establish complete application security or offline behavior by itself. [Trust boundaries](https://v2.tauri.app/security/).

Future mobile support is a secondary benefit. The mobile mini version remains deferred and will need adapted interactions and platform integration. The primary reason for this decision is the desktop product's compatibility and implementation needs.

No matched application benchmark has been run. We are not selecting Tauri on an asserted startup, memory, or processing-speed advantage. Validate the selected implementation against agreed budgets before release.

## Package manager

Use pnpm for the frontend dependency workflow. Its shared content-addressable store reduces repeated package storage and installation work across projects. This choice targets development efficiency; it does not imply a faster shipped application. [pnpm design](https://pnpm.io/motivation).

Keep Node.js for development tools and use pnpm consistently for installs and scripts. Commit `pnpm-lock.yaml` and `src-tauri/Cargo.lock`; record the exact pnpm version in the generated `package.json` `packageManager` field. Use `pnpm install --frozen-lockfile` in CI so dependency resolution cannot silently change. [Reproducible installs](https://pnpm.io/cli/install).

Bun remains an alternative package manager, but adopting it is unnecessary for the selected stack. Neither pnpm nor Node.js needs to ship inside the default Tauri application.

## Module boundaries

The following is a starting structure, not a requirement to create empty abstractions in advance:

```text
src/
  components/          Shared review and form components
  features/            Import, review, projects, profiles, and restoration
  core/                Domain types, pack/profile rules, and validation
  adapters/            Tauri boundary, format adapters, and detector adapters
  workers/             Cancellable background jobs
src-tauri/
  src/                 Native commands and private persistence integration
  capabilities/        Explicit frontend permissions and scopes
resources/
  packs/               Bundled, declarative starter packs
docs/
  decisions/           Accepted architecture decisions
```

- Vue components coordinate the review experience; reusable domain modules do not import Vue or Tauri.
- Format adapters report compatibility findings and source locations through a shared contract. Unsupported workbook content is handled explicitly or blocks export.
- Detector adapters return findings with types, locations, and explanations. Rules form the initial baseline; a pretrained local model is added only if evaluation justifies it. No custom training or mandatory Python runtime is selected.
- One project service owns alias scope and restoration behavior. Native persistence receives batched operations through a narrow interface; cryptographic key handling stays within the chosen vault boundary.
- User-installed packs remain versioned configuration data with bounded execution. They are available across the app but activated through profiles. They cannot introduce executable code or network behavior.

Browser-compatible npm packages can be used in the UI or workers. Node-only dependencies require an explicit native or runtime adapter and should not silently introduce an additional shipped runtime. Move processing into Rust when compatibility, resource use, or measurement requires it.

## Offline and data requirements

The released app and bundled components must initiate no external network requests: no telemetry, online licensing, remote UI assets, update checks, or model downloads. Build-time dependency acquisition is separate from this end-user requirement. Ship fonts, assets, starter packs, and any selected model resources locally.

Provide a complete offline installation procedure, including Windows WebView2 where necessary and Linux runtime prerequisites. Test first use on clean offline systems and inspect attempted connections. The smallest shell binary is not the complete distribution size. [Windows offline installation](https://v2.tauri.app/distribute/windows-installer/#webview2-installation-options).

Encrypt persisted private mappings and dictionaries with established cryptographic components. Keep source files unchanged and private values out of routine logs, shared profiles, and unencrypted temporary persistence. Vault unlocking, recovery, and deletion need an explicit design before storing real private data. Tauri Stronghold remains a candidate, not the selected vault implementation.

## Initialization handoff

The user will initialize the project. This decision adds documentation only.

1. Install the current [Tauri development prerequisites](https://v2.tauri.app/start/prerequisites/) and [pnpm](https://pnpm.io/installation) for the development machine.
2. Run `pnpm create tauri-app` in a temporary location. Choose a new scaffold directory, TypeScript/JavaScript, pnpm, Vue, and TypeScript. Verify the generated application uses Tauri 2 and Vue 3.
3. Merge the generated application files into the existing `offlinemask` repository. Preserve `.git`, `PRD.md`, `docs/`, and the project README; merge `.gitignore` entries. Set the package/product names to `offlinemask` / `OfflineMask` and choose the application's bundle identifier deliberately.
4. In the repository, run `pnpm install` and `pnpm tauri dev`. Keep `pnpm-lock.yaml` and `src-tauri/Cargo.lock`; pin the selected pnpm version in `package.json`. Record exact tool and dependency versions when the scaffold is created.
5. Verify type checking, a release build, and a Vietnamese UI smoke test. Then implement the first complete local text/table masking and restoration flow described in the PRD.

The official generator's [setup instructions](https://v2.tauri.app/start/create-project/) cover these frontend choices. Generating separately avoids replacing the existing product documentation during initialization.

## Decisions that remain open

These do not reopen the selected desktop stack or block scaffolding:

- The UI component library and application styling; PrimeVue remains the earlier suggestion.
- XLSX/CSV parser and writer choices, licenses, and the supported workbook feature matrix.
- Optional model/provider selection and Vietnamese banking detection thresholds.
- Vault implementation, password/key lifecycle, backups, retention, and recovery.
- Exact OS/CPU release matrix and performance budgets. Broader compatibility is an objective, not a promise that every old OS or dependency combination is supported.

Revisit the shell only if implementation evidence exposes a material unmet requirement. Keep the [PRD](../../PRD.md) as the source of product acceptance criteria.

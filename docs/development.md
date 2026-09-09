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

- `src/App.vue`: format home, sidebar history, text/table samples, explicit masking, original/masked views, individual choices, and copying.
- `src/components/AppIcon.vue`: local SVG icons.
- `src/core/review.ts`: portable fixture types, explicit decisions, tokenization, sample alias replacements, and the final-copy gate.
- `src/core/sessions.ts`: versioned sample-session records, validated persistence, and synthetic table transformations.
- `tests/sessions.test.mjs`: history round trips, independent choices, serialization boundaries, invalid history, and table preservation.
- `tests/review.test.mjs`: built-in Node test runner coverage for review gating, exact preservation, and consistent aliases.
- `src/adapters/desktop.ts`: the only frontend module importing Tauri APIs. It provides native version detection for future features; the simplified interface does not call it.
- `src/style.css`: local styles using system fonts, with keyboard focus and narrow-window layouts.
- `src-tauri/src/`: minimal Rust application entry points; no private-data commands or storage.
- `src-tauri/capabilities/default.json`: grants only `core:app:allow-version` to the main window.
- `src-tauri/tauri.conf.json`: desktop window, development hooks, local assets, and content security policy.

Add feature modules and workers when their first implementation exists, following [Decision 0001](decisions/0001-desktop-stack.md). UI libraries, parsers, models, and vault technology remain open decisions.

The development bundle identifier is `dev.offlinemask.desktop`. Review ownership and release identity before distributing signed builds. The scaffold's Tauri application icons are retained as placeholders.

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

The starter has no remote fonts, UI assets, external links, updater, telemetry, network plugin, or opener plugin. Production CSP limits connections to Tauri IPC. Development permits the local Vite server and HMR; browser preview does not receive Tauri's production CSP.

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

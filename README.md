<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/mark-paper.svg">
  <img src="brand/mark-ink.svg" width="72" height="72" alt="OfflineMask mark: a brush swipe with two eye holes">
</picture>

# OfflineMask

Mask and restore sensitive data, entirely on your device.

OfflineMask is a desktop app for preparing sensitive text before pasting it into an external AI tool. You paste text, the app replaces names, account numbers, phone numbers and other private values with consistent aliases on your machine, you review the result, copy it to the AI of your choice, and paste the reply back to restore the original values. Nothing leaves the device: there is no server, no telemetry and no automatic update check. The first language focus is Vietnamese banking workflows; the detection pipeline is designed so that other languages and models can be added as packs.

**Status: 2.0.0 is the first public release.** Pasted text, spreadsheets (XLSX, XLS, ODS, CSV), documents (DOCX, ODT) and plain-text files are masked, reviewed and restored. Once a passcode is set, history is kept in an encrypted vault on the device. On macOS and Windows, Ẩn nhanh masks or restores text selected in any application. PDF and image input are not implemented. Only macOS on Apple Silicon has been built and tested by hand; Windows x64 builds in CI and awaits manual qualification; Linux is untested. Builds are not yet signed or notarized. Detection is rule-based plus an optional model pack and has documented misses; always review the result before sharing it. See the [changelog](CHANGELOG.md) for what each release contains, the [product requirements](PRD.md) for the intended scope and [product direction](docs/product-direction.md) for the decisions behind the current experience.

## How it works

- **Built-in rules** recognise emails, phone numbers and labelled banking identifiers (accounts, national IDs, passports, tax codes, transaction and customer codes) without any model files. The app works offline from the first launch.
- **An optional recognition pack** adds contextual categories: names, addresses, organizations, birth dates, card and login details. The pack is downloaded on demand from Settings (712 MB transferred, 1.14 GB installed), verified by size and SHA-256, and runs locally through ONNX Runtime inside a web worker. Startup and processing never touch the network.
- **Review and aliases.** Every finding can be kept or hidden; a manual selection can be hidden too. Aliases are consistent within a session, so the AI's reply can be restored exactly. Without a passcode, private sessions live only in memory and disappear when the app closes; with one, they are sealed in a local vault (Argon2id-derived key, XChaCha20-Poly1305, [Decision 0062](docs/decisions/0062-passcode-vault.md)). A forgotten passcode cannot be recovered.
- **Files and other apps.** Spreadsheets and documents are masked with their formatting kept and a review of every hidden value before saving; the AI's returned file is restored the same way. Ẩn nhanh ([Decision 0096](docs/decisions/0096-selection-popover.md)) puts a small button beside text selected in any application and replaces it in place; it reads only the selection, on the user's click.

Detection quality is evidence-based and recorded, not promised: the shipping pack reproduces all 398 recorded synthetic outcomes of its evaluation, which still include known misses and over-masking. Read [the integration evidence](docs/evaluations/recognition-production-v1/README.md) before relying on it.

## Getting started

Builds for each release are attached to the [GitHub releases](https://github.com/fongfan999/offlinemask/releases); they are not yet signed or notarized ([release notes](docs/release/macos-arm64.md)). To build from source, install [mise](https://mise.jdx.dev/getting-started.html) and the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS (on macOS the Xcode Command Line Tools suffice), then:

```sh
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm desktop:dev
```

`mise.toml` pins Node, pnpm and Rust; `mise exec --` applies them even when mise is not activated in your shell. Downloading build dependencies needs a network connection; the application itself does not.

| Command | Purpose |
| --- | --- |
| `mise exec -- pnpm dev` | Browser preview at localhost:1420 without native APIs (no pack download, built-in rules only). |
| `mise exec -- pnpm desktop:dev` | The desktop app with hot reload. Recognition runs in WASM (slow on long input). |
| `mise exec -- pnpm desktop:dev:native` | The same with the native recognition helper (macOS arm64, Windows x64): release-speed masking while developing. |
| `mise exec -- pnpm lint` | ESLint and Prettier; `pnpm format` rewrites. |
| `mise exec -- pnpm typecheck` | Vue, TypeScript and Vite configuration. |
| `mise exec -- pnpm test` | Fast tests: detection rules, transformations, sessions, storage boundaries, the pack contract. No model files needed. |
| `mise exec -- pnpm build` | Production frontend without model weights. |
| `mise exec -- pnpm check:native` | rustfmt and Clippy for the Rust layer; `cargo test --manifest-path src-tauri/Cargo.toml --locked` runs its tests. |
| `mise exec -- pnpm test:models <pack root>` | Run the real recognition pack against the committed synthetic fixtures (see [packs/README.md](packs/README.md)). |
| `mise exec -- pnpm desktop:build` | Desktop bundle for the current platform. macOS arm64 uses the verified native-inference path. |
| `mise exec -- pnpm desktop:build:native` | Native-inference bundle on macOS arm64 or Windows x64 (Windows awaits qualification, [Decision 0077](docs/decisions/0077-native-recognition-windows.md)). |

Only macOS on Apple Silicon has been built and tested so far. The CI workflow compiles the native layer on Linux and Windows as an advisory check, and a separate workflow builds and smoke-tests the Windows native package; Windows becomes qualified after the manual checklist in Decision 0077.

## Replacing the models

Everything the app knows about its models is one file under [`packs/`](packs/). The TypeScript loaders, the Rust installer and the evaluation helpers all read it, so a different model, or a pack for another language, is a change to that file plus the files it pins. [packs/README.md](packs/README.md) walks through the contract (inputs, outputs, labels, offsets) and the checks a replacement has to pass: `pnpm test` for the code around the models and `pnpm test:models` for the models themselves.

## Repository layout

| Path | Contents |
| --- | --- |
| `src/core/` | Portable logic: detection rules, model policy, pack loading, aliases, sessions, restoration. No Vue or Tauri imports. |
| `src/core/detection/` | The detection pipeline. `pack.ts` reads the pack, `recognition.ts` loads it, `policy.ts` merges model and rule evidence. |
| `src/adapters/` | The only modules that talk to Tauri: the detection worker bridge, pack status and downloads, the website link. |
| `src/workers/` | The detection web worker. |
| `src/composables/`, `src/pages/`, `src/components/` | Vue state and screens. |
| `src-tauri/` | Rust: pack download and verification, exact tokenizer offsets, opt-in native inference. |
| `packs/` | Recognition pack definitions. |
| `tests/` | Node test runner suites and synthetic fixtures. |
| `scripts/` | Build tooling at the top level; frozen evaluation experiments in subdirectories ([index](scripts/README.md)). |
| `docs/decisions/` | Architecture decision records, numbered. |
| `docs/evaluations/` | Evaluation protocols and results; large raw outputs are kept out of git. |
| `brand/` | The mark (a brush swipe with two eye holes), its generator, sketches and icon sources. |

[docs/development.md](docs/development.md) has the detailed setup notes, module boundaries and the history of evaluation tooling.

## Privacy principles

Only synthetic data belongs in this repository, in issues and in screenshots. The app stores no private text, collects no corrections and sends nothing anywhere; the sample history on disk holds references to public fixtures and mask/keep choices only. Changes that would relax any of this need a recorded decision. Vulnerabilities are reported privately as described in [SECURITY.md](SECURITY.md).

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions and the checks to run, and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for expectations. Agents working in this repository follow [AGENTS.md](AGENTS.md).

OfflineMask is source available under the [O’Saasy License Agreement](LICENSE.md). Copyright © 2026, Phong Phan. Third-party code and the recognition models keep their own licenses, recorded under [`docs/licenses/`](docs/licenses/) and in the pack attribution. See the [license decision](docs/decisions/0050-osaasy-license.md).

# OfflineMask

Mask and restore sensitive data, entirely on your device.

OfflineMask is a planned cross-platform desktop tool for preparing sensitive information before using external AI. The initial focus is Vietnamese banking workflows, with an extensible design for other industries, languages, and file formats.

The MVP covers pasted text, CSV, supported Excel workbooks, user review, consistent aliases, encrypted local restoration mappings, and reusable rule packs and profiles. Required resources can be supplied locally, and the application operates without external network requests.

## Project status

The owner accepted the current UI as **good enough for the boilerplate**, with page-by-page feedback to follow. See [product direction and acceptance notes](docs/product-direction.md) before changing the experience. This is not final design or MVP acceptance.

The desktop boilerplate uses **Tauri 2 + Vue 3 + TypeScript + Vite**, with pnpm for frontend dependencies and a focused Rust layer for native integration. Node, pnpm, and Rust versions are pinned in `mise.toml`.

The home page offers **real text processing and an Excel sample workspace**, with other formats marked coming soon. Type or paste text, process it locally, review the original and masked preview, adjust mask/keep choices, and copy the result. Each conversion creates a separate sidebar session. Private text stays in memory and clears on close/reload; only synthetic sample sessions persist. Excel provides a sample table with tab-separated clipboard output, not XLSX import/export. See [text detection and model setup](docs/decisions/0005-library-text-detection.md) and [session storage boundaries](docs/decisions/0004-text-processing.md).

The interface uses standard CSS glass surfaces with shared tokens and a blue/white palette. No glass library or remote UI assets are required. Text detection uses contact-parsing libraries and optional Vietnamese models downloaded through Settings, with documented gaps; it is not comprehensive detection. File adapters, encrypted storage, and restoration remain unimplemented.

The owner has selected the **O’Saasy License Agreement** for source-available publication. The final license file and copyright attribution remain pending. Third-party code and recognition resources retain their own licenses. See the [license decision](docs/decisions/0050-osaasy-license.md) and [contribution guidance](CONTRIBUTING.md).

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
| `mise exec -- pnpm test` | Check text detection, transformations, session isolation, storage boundaries, and sample review. |
| `mise exec -- pnpm models:download` | Optional developer download of pinned model assets for model evaluations. |
| `mise exec -- pnpm models:check` | Verify local model hashes; no downloads. |
| `mise exec -- pnpm test:models` | Run synthetic regressions against real local model weights. |
| `mise exec -- pnpm compare:models` | Compare each pinned model and the pair on 66 synthetic cases; write coverage, failure, CPU timing and peak-memory reports locally. |
| `mise exec -- pnpm build` | Prepare local WASM, type check, and build frontend assets without model weights. |
| `mise exec -- pnpm check:native` | Rust formatting and Clippy checks. |
| `mise exec -- pnpm desktop:build` | Build desktop release and platform bundles. |
| `mise exec -- pnpm tauri build --bundles app -- --locked` | Build a macOS app using the Cargo lockfile. |

The default app includes **no model weights**. Email, phone, and labelled banking identifiers work immediately. Settings explicitly downloads one optional **Vietnamese recognition pack: 712 MB transferred, 1.14 GB installed**. It contains Underthesea INT8 + OpenMed mSuperClinical INT8. Downloads support pause/resume; transport and restored files are verified before the complete pack becomes ready. Startup and text processing do not access the Internet. See [pack delivery](docs/decisions/0041-compressed-pack-installer-and-r2.md) and [production integration](docs/decisions/0042-production-recognition-pair.md).

The production adapter matches the selected pair’s **398 recorded synthetic outcomes** on CPU, including category-specific masking; 386 independent records cover 500 annotated values, of which 495 are fully covered under their correct category. Known misses and unwanted masking remain. This is integration parity, not 100% detection, real banking accuracy, or completion of the previous quality gates. Review results before sharing. See [evidence and platform limitations](docs/evaluations/recognition-production-v1/README.md).

Developers can run `mise exec -- pnpm models:download` for the historical OpenMed evaluation baseline. The shipping pack is pinned separately in `scripts/release-pack-v1.json`. These assets stay in ignored `public/models/` and are excluded from both frontend and desktop production builds. They are not required to build or test the lightweight flow.

Keep `pnpm-lock.yaml` and `src-tauri/Cargo.lock` in version control. Tool installation and initial dependency downloads require a network connection; this is separate from the application's offline runtime requirement.

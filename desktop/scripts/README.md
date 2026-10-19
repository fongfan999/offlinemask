# Scripts

Two kinds of files live here. Only the first kind is needed to build, run or check OfflineMask.

## Build, release and pack tooling

| Script | Used by |
| --- | --- |
| `prepare-runtime.mjs` | `pnpm build`: copies the pinned ONNX Runtime WASM into `public/runtime/` for `vite dev` and evaluation scripts. The production bundle emits its own copy at `dist/runtime/`. |
| `prepare-assets.mjs` | `pnpm build`: copies static assets into `dist/`, excluding development models and the runtime copy above. |
| `prepare-desktop.mjs` | `tauri build`: stages `dist/` into `dist-desktop/` without model weights. |
| `build-desktop.mjs`, `build-macos-release.mjs`, `check-macos-release.mjs` | Desktop bundling and the macOS signing/notarization gate ([release notes](../../docs/release/macos-arm64.md)). |
| `prepare-native-desktop.mjs`, `verify-native-desktop.mjs` | Opt-in native recognition packaging ([Decision 0049](../../docs/decisions/0049-native-release-packaging.md)). |
| `check-pack.mjs` | `pnpm test:models`: verifies the pinned pack files and masks the synthetic fixtures with the real models, offline ([packs/README.md](../packs/README.md)). |
| `prepare-pack.mjs` | `pnpm pack:prepare`: pins local model files into a pack definition's `assets`. |
| `build-r2-pack.mjs`, `verify-r2-pack.mjs` | Compressed pack publication for the shipping pack ([Decision 0041](../../docs/decisions/0041-compressed-pack-installer-and-r2.md)). |
| `prepare-models.mjs`, `model-manifest.json` | Developer download and hash check of the historical OpenMed evaluation models (`pnpm models:download`, `pnpm test:models:legacy`). These are not the shipping pack. |

The shipping pack definition itself lives in [`packs/vietnamese-pii-v1.json`](../packs/vietnamese-pii-v1.json); it was `scripts/release-pack-v1.json` until [Decision 0054](../../docs/decisions/0054-replaceable-recognition-packs.md).

## Frozen evaluation experiments

Every other file and directory (for example `shared-core/`, `challenge-core/`, `minilm-*`, `recognition-*-v1/`, `policy-hardening*`, `*.py`) is a versioned experiment referenced from `docs/evaluations/` and `docs/decisions/`. Those protocols pin SHA-256 fingerprints of the sources they ran against, so these directories are intentionally excluded from formatting and linting and are not edited retroactively. They import application modules and read `scripts/release-pack-v1.json` as those existed at the time; reproduce a historical result from its recorded sources in an isolated copy (`git show <commit>:<path>`), and start a new versioned experiment for new work. See [development notes](../../docs/development.md) for the reproduction commands.

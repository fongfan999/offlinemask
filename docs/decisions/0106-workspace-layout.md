# 0106 — One repository, two packages: `desktop/` and `landing/`

Date: 20 October 2026. Status: requested by the owner ("we have a new folder for landing, so re-structure this repo as mono repo, that mean the CI needs to be updated"; layout: "just desktop and landing at the root path normally").

## Problem

The product landing page ([0105](0105-portable-product-landing.md)) arrived as a folder beside the app, with its Vite, GSAP and Wrangler dependencies and its `landing:*` scripts added to the app's `package.json`, its output in a root `dist-landing/`, and its theme imported from `src/theme.css` inside the app. Two deployables shared one manifest, one dependency list and one set of lint ignores.

## Decision

- **A pnpm workspace with two packages.** `desktop/` holds everything that was the app: `src/`, `src-tauri/`, `tests/`, `scripts/`, `public/`, `packs/`, `.cargo/`, the HTML entry points and the Vite and TypeScript configs, with its own `package.json` (`offlinemask-desktop`, version 2.0.0, the Tauri dependencies). `landing/` holds the website with its own `package.json` (`offlinemask-landing`: gsap, vite, wrangler) and builds into `landing/dist/`. The root `package.json` carries only the shared tooling (ESLint, Prettier, TypeScript) and four scripts: `lint`, `format`, `test` and `build` (the last two fan out with `pnpm -r`).
- **`docs/`, `brand/`, `LICENSE.md` and the policies stay at the root**: they describe the project, not one package. `packs/` moves with the app because the Rust crate embeds it and the scripts and tests reach it by relative path; those paths are unchanged. `brand/theme.css` (formerly `src/theme.css`) is the one file both packages import.
- **Commands change prefix, not name.** `pnpm -C desktop desktop:dev`, `pnpm -C desktop test`, `pnpm -C landing deploy:check`; `pnpm lint` at the root covers both packages. A new `test:native` script runs the Rust tests from `desktop/`, so `desktop/.cargo/config.toml` (Windows static CRT, [0077](0077-native-recognition-windows.md)) applies; CI runs every Cargo command with `working-directory: desktop` for the same reason.
- **CI and release workflows follow.** `ci.yml` lints at the root and runs the app's build, tests and native checks in `desktop/`; `windows-native.yml` and `release.yml` read the manifests, caches and bundle paths under `desktop/`; `landing.yml` builds `landing/dist` and deploys from `landing/`.
- **Frozen experiments keep their place** under `desktop/scripts/`, unedited. The few that read `docs/` by a path relative to the old root no longer run in place, which [scripts/README.md](../../desktop/scripts/README.md) already prescribes for them: reproduce from git history. The maintained build scripts, three tests and one Rust `include_bytes!` that read `docs/licenses` or `docs/evaluations` were pointed one directory further up.

## Not done

Moving `docs/` into the app, a shared package for the theme (one CSS file does not need one), and renaming the `desktop:*` scripts: earlier decisions and evaluation reports cite them by name.

## Checked

Recorded below after the move: `pnpm lint`, `pnpm -C desktop typecheck`, `pnpm -C desktop test`, `pnpm -C desktop build`, `cargo check` in `desktop/`, `pnpm -C landing deploy:check`, and the first CI run on the restructured `main`.

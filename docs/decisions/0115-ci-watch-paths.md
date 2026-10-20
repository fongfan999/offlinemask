# 0115 — One deploy path and narrower CI triggers

Date: 2026-10-20

## Context

The owner noticed redundant GitHub Actions runs and wrong watch paths:

- **CI ran on every push.** That included landing-only and docs-only commits, each of which started a macOS build plus Linux and Windows compile checks.
- **Windows was compiled twice.** CI's portability matrix ran `cargo check` on Windows, while `windows-native.yml` already builds, tests and packages the crate on Windows whenever native code changes.
- **The landing page had two deploy paths.** `landing.yml` kept a manual Wrangler deploy job after Cloudflare's GitHub integration began deploying offlinemask.com from `main` (0113).
- **Watch paths were missing.** The landing build reads `desktop/package.json` for the release version, plus `pnpm-workspace.yaml`, `mise.toml` and `eslint.config.js`, none of which `landing.yml` watched. The Windows native build did not watch `mise.toml`, `pnpm-lock.yaml` or `desktop/package.json`.

## Decision

- **CI** (`ci.yml`) ignores `landing/**`, `docs/**` and root Markdown files, but still runs for `docs/licenses/**`, which native builds bundle. The portability matrix keeps Linux only. Branch protection is not configured, so a skipped workflow blocks nothing.
- **Landing page** (`landing.yml`) only verifies: lint, build and a Wrangler dry run. The deploy job, its artifact upload and the `deploy` dispatch input are removed. Cloudflare's integration is the single deploy path. Its watch list adds the files the build reads.
- **Windows native build** (`windows-native.yml`) also watches the toolchain pin, the lockfile and the desktop package scripts.
- Release (`release.yml`) is unchanged: tags and manual dispatch only.

The `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets and the `production` environment in GitHub are no longer used by any workflow. The owner may remove them.

---
name: release
description: Release a new OfflineMask desktop version — choose the commit and version, bump the four manifests, write the changelog and Microsoft Store "what's new", run the gates, tag locally, then hand the owner the push commands and follow the build to the website and Partner Center. Use when the owner says "release", "ship", "cut a version" or names a version, optionally leaving unfinished features out.
---

# Release OfflineMask

The process behind [docs/release/github-actions.md](../../../docs/release/github-actions.md) and [docs/release/microsoft-store.md](../../../docs/release/microsoft-store.md), as done for 2.2.0 on 25 October 2026. Commit locally; **the owner pushes** (never `git push` yourself). Stage only the files you changed: others leave uncommitted work in this checkout, so never `git add -A`.

## 1. What goes out

1. Last release: `git describe --tags --abbrev=0`. App changes since: `git log --oneline <tag>..HEAD -- desktop/src desktop/src-tauri desktop/store desktop/packs`.
2. If the owner wants something left out (a feature not production-ready), do **not** hide it behind a flag. Pick the last commit before that work, and check that nothing wanted after it depends on it (`git show --stat` each later commit). Say which commit, and what else falls out with it.
3. Version (semver from 2.0.0, decision 0102; never 1.x): major when a stored or exchanged format breaks (vault file, pack contract, alias codes, masked-file layout), minor for new user-visible features, patch for fixes only.

## 2. Release commit

If the release commit is `HEAD` of `main`, work in the checkout. Otherwise make a worktree in the scratchpad: `git worktree add -b release/X.Y <scratchpad>/rel <commit>`, then `mise trust -q mise.toml` there (same file as the repo's) and `mise exec -- pnpm install --frozen-lockfile --offline`.

1. Set `X.Y.Z` in `desktop/package.json`, `desktop/src-tauri/tauri.conf.json` and `desktop/src-tauri/Cargo.toml` (the `[workspace.package]` version), then in `desktop/src-tauri` run `mise exec -- cargo metadata --format-version 1 --offline >/dev/null` so `Cargo.lock` follows (two lines change).
2. `CHANGELOG.md`: under `## [Unreleased]` insert `## [X.Y.Z] — YYYY-MM-DD`, a one-line summary, and the `### Added / Changed / Fixed` entries, leaving `## [Unreleased]` empty above it. Compare the decisions the shipped commits name with what Unreleased already lists and add the missing ones. Write for users, link each decision (`[0143](docs/decisions/0143-….md)`), and leave website-only changes where they are.
3. Gates, all from the release tree:
   - `mise exec -- pnpm -C desktop test`
   - `mise exec -- pnpm lint`
   - `mise exec -- pnpm -C desktop typecheck`
   - `mise exec -- pnpm -C desktop test:models` needs the assembled pack in `artifacts/packs/`, which is often missing locally. If it is missing, check `git diff --stat <last tag> <commit> -- desktop/packs desktop/src/core/detection desktop/scripts desktop/src-tauri/src`. If that is empty, the last release's result stands; say so. Otherwise ask the owner to run `pnpm -C desktop pack:prepare` first.
4. Commit `release: X.Y.Z`. In the body, say what ships (decision numbers) and, when you used an older commit, which commit and what was left out. Then tag: `git tag -a vX.Y.Z -m "OfflineMask X.Y.Z"`.
5. Released from a branch: `git cherry-pick release/X.Y` onto `main` so main carries the same version and changelog, then `git worktree remove <scratchpad>/rel`.

## 3. Microsoft Store text

In `docs/release/microsoft-store.md`, replace the **What's new in this version** block with Vietnamese bullets for this version (plain, friendly, no decision numbers; at most three or four). Re-read the description, product features and the personal-information answer, and correct anything this release changed (a new network use, a feature that went or arrived). Commit on `main`.

## 4. Hand over, then follow up

Give the owner one command per code block:

```bash
git push origin vX.Y.Z
```

From a release branch, use `git push origin release/X.Y vX.Y.Z` instead. Then:

```bash
git push origin main
```

After the tag is pushed:

1. `gh run list --workflow release.yml --limit 1` — the build takes about 11 minutes. Wait for it in the background (a `Monitor` or a background `gh run watch <id> --exit-status`), not by polling.
2. The run creates a **draft** release. Publishing it makes it public, so ask the owner first, or let them press Publish on GitHub. With their yes: `gh release edit vX.Y.Z --draft=false --latest`.
3. The website switches by itself within 5 minutes of publishing; there is no deploy (decision 0140). Check with `curl -s https://offlinemask.com/ | grep -o -E '\b2\.[0-9]+\.[0-9]+\b' | sort -u`.
4. Windows: `gh run download <run id> -n msix-windows-x64 -D <scratchpad>/msix`. The owner uploads the **unsigned** `OfflineMask_X.Y.Z_x64.msix` (never `_test-signed`) in Partner Center with the What's new text, together with any listing change such as the logos in `desktop/store/listing/`. Certification takes up to three business days.

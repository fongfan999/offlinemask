# Working on OfflineMask

Read [docs/product-direction.md](docs/product-direction.md) before product or UI work. It records the owner's accepted boilerplate and feedback; preserve that baseline and apply subsequent feedback page by page. Read [CONTRIBUTING.md](CONTRIBUTING.md) for engineering conventions and the [PRD](PRD.md) for feature scope. Model or pack work starts at [packs/README.md](packs/README.md).

- Keep the experience straightforward, with secondary controls revealed only when needed.
- Use the owner's personal brand theme (warm paper, ink, cobalt accent; light and dark via shared tokens in `src/style.css`); do not reintroduce purple/lavender or a dark-green primary palette.
- Preserve Text/Excel entry points and reopenable conversion sessions in the left sidebar.
- Use mise-managed versions and `mise exec --` when running project tools. Keep both dependency lockfiles.
- Follow standard Vue/TypeScript patterns and shared CSS tokens. The project is open source; document substantial choices and dependency provenance in `docs/decisions/`.
- The recognition models are data: everything about them is in `packs/<id>.json`. Change the pack file rather than hard-coding model names, directories or labels in code, and keep `pnpm test` and `pnpm test:models` green.
- `src/` is formatted and linted (`pnpm lint`); the frozen experiments under `scripts/` subdirectories are not edited retroactively.
- Clearly distinguish sample behavior from production capabilities. Never persist real private input through sample history storage. Never add telemetry, automatic network access or input logging.
- Do not broadly redesign the accepted boilerplate without new direction. Later explicit user instructions take precedence over these notes.

## Current documentation with Context7

Use Context7 for library/framework/SDK/API/CLI/cloud-specific setup, syntax, configuration, migrations, and debugging, even for familiar tools. General programming, business-logic debugging, refactoring, and code review alone do not require it.

1. Start with `resolve-library-id`, unless an exact `/org/project` ID was provided.
2. Choose the relevant official/high-reputation match, using a requested version when available.
3. Use `query-docs` for a specific concept; separate unrelated concepts into separate queries.
4. Apply the fetched documentation and record consequential decisions.

# Working on OfflineMask

Read [docs/product-direction.md](docs/product-direction.md) before product or UI work. It records the owner's accepted boilerplate and feedback; preserve that baseline and apply subsequent feedback page by page. Read [CONTRIBUTING.md](CONTRIBUTING.md) for engineering conventions and the [PRD](PRD.md) for feature scope. Model or pack work starts at [desktop/packs/README.md](desktop/packs/README.md). The repository is a pnpm workspace: `desktop/` is the Tauri app, `landing/` the product website; run a package's scripts with `pnpm -C desktop …` or `pnpm -C landing …`, and `pnpm lint` at the root.

- Keep the experience straightforward, with secondary controls revealed only when needed.
- Use the owner's personal brand theme (warm paper, ink, cobalt accent; light and dark via shared tokens in `brand/theme.css`, imported by `desktop/src/style.css` and the landing page); do not reintroduce purple/lavender or a dark-green primary palette.
- The left sidebar starts with "+ Ẩn thông tin mới", not one entry per file format (decision 0172); home holds both halves of the job as two tabs, "Ẩn thông tin riêng" (files, folders, text) and "Nhận lại bản đầy đủ", the website's step names. Below them, reopenable history once a passcode is set; without one, "Gần đây": what was opened or hidden in this launch (RAM, the latest per kind), with an "i" whose note says it lasts until the app closes and offers "Đặt mật mã" in Cài đặt; nothing else talks about saving (decisions 0071, 0172).
- Use mise-managed versions and `mise exec --` when running project tools. Keep both dependency lockfiles.
- Follow standard Vue/TypeScript patterns and shared CSS tokens. The project is open source; document substantial choices and dependency provenance in `docs/decisions/`.
- The recognition models are data: everything about them is in `desktop/packs/<id>.json`. Change the pack file rather than hard-coding model names, directories or labels in code, and keep `pnpm test` and `pnpm test:models` green.
- `desktop/src/`, `desktop/tests/` and `landing/` are formatted and linted (`pnpm lint` at the root); the frozen experiments under `desktop/scripts/` subdirectories are not edited retroactively.
- `landing/privacy.html` is a promise to users. Any change to networking, what is stored or where, system permissions, input observation or Ẩn nhanh must update that page and its "Cập nhật ngày …" line in the same change. `desktop/tests/privacy-contract.test.mjs` (part of `pnpm test`) fails when those facts change; update the page first, then the expectation.
- Clearly distinguish sample behavior from production capabilities. Never persist real private input through sample history storage. Never add telemetry, automatic network access or input logging.
- Do not broadly redesign the accepted boilerplate without new direction. Later explicit user instructions take precedence over these notes.

## Current documentation with Context7

Use Context7 for library/framework/SDK/API/CLI/cloud-specific setup, syntax, configuration, migrations, and debugging, even for familiar tools. General programming, business-logic debugging, refactoring, and code review alone do not require it.

1. Start with `resolve-library-id`, unless an exact `/org/project` ID was provided.
2. Choose the relevant official/high-reputation match, using a requested version when available.
3. Use `query-docs` for a specific concept; separate unrelated concepts into separate queries.
4. Apply the fetched documentation and record consequential decisions.

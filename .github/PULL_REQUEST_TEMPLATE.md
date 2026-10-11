<!-- Synthetic data only. Never include real customer text, identifiers or private sessions. -->

**What this changes and why**

**How it was verified**

- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm check:native` and `cargo test` (when touching `src-tauri/`)
- [ ] `pnpm test:models` (when touching `packs/` or the detection pipeline)

**Documentation**

- [ ] Decisions with lasting consequences are recorded under `docs/decisions/`.
- [ ] No new network access, persistence of private data, or telemetry; or the decision above explains why.

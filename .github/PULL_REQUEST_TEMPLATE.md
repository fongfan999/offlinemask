<!-- Synthetic data only. Never include real customer text, identifiers or private sessions. -->

**What this changes and why**

**How it was verified**

- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm -C desktop check:native` and `pnpm -C desktop test:native` (when touching `desktop/src-tauri/`)
- [ ] `pnpm -C desktop test:models` (when touching `desktop/packs/` or the detection pipeline)

**Documentation**

- [ ] Decisions with lasting consequences are recorded under `docs/decisions/`.
- [ ] No new network access, persistence of private data, or telemetry; or the decision above explains why.

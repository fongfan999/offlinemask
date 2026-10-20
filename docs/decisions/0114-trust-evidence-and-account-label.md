# 0114 — Trust evidence on the site, and “tài khoản số” accounts

Date: 2026-10-20

## Context

Asked whether the Dia-inspired page is trustworthy enough, the review concluded that the look is fine but trust has to come from evidence. Five gaps came up: unsigned builds, no proof of the offline claim, no privacy statement, no visible maker, and a detection gap visible in the app's own sample contract ("thanh toán vào tài khoản số 0071000123456" stayed unmasked). The owner asked to fix them all and to be shown how to sign releases.

## Decision

- **Detection.** Account labels may be followed by "số" before the number. This covers "tài khoản số …", "Tài khoản số: …" and "STK số …" in both the banking rule (`banking.ts`) and the labelled structured values (`structured-values.ts`). A number of at least six digits is still required, so "tài khoản số dư" and "Tài khoản số 2" stay untouched. Regression cases are in `tests/structured-gaps.test.mjs`.
- **Offline proof on the page.** "Đừng tin lời chúng tôi. Hãy kiểm chứng." lists four facts, each checked against the code:
  - the webview CSP allows only local connections (`tauri.conf.json`);
  - the only network code is the user-started download of the recognition pack, from fixed URLs with SHA-256 per file (`packs/vietnamese-pii-v1.json`, `models.rs`);
  - there is no updater and no telemetry;
  - users can disconnect, or watch with Little Snitch or LuLu.

  Links go to the files on GitHub.
- **Privacy statement** at `/privacy` (`landing/privacy.html`). It covers:
  - processing on the device;
  - what is stored: the in-memory default, the Argon2id + XChaCha20-Poly1305 vault behind a six-digit passcode (decisions 0062 and 0065), the recognition pack, theme and quick-action preferences, and sample data;
  - when the network is used;
  - clipboard access only on the shortcut or the panel button;
  - the website: static on Cloudflare, no cookies, no analytics, no third-party assets, with Cloudflare processing IPs as the host.
- **Maker section** with the owner's own public self-description and quote from wotdafong.dev, and a monogram. The page loads no remote assets, so a portrait would need to be added as a local file.
- **Signing.** `docs/release/signing.md` is the owner checklist. macOS is already wired in the release workflow and needs only the Apple Developer ID certificate and an App Store Connect key as secrets. For Windows:
  - Azure Artifact Signing is not available to an individual in Vietnam;
  - SignPath Foundation needs an OSI licence;
  - an OV certificate with cloud signing (for example SSL.com eSigner) is recommended, and the workflow will get a conditional `signCommand` once a provider is chosen.

## Verification

`pnpm test` passes (300). `pnpm test:models` could not run because the model files are not present locally; it fails identically on the unmodified tree, and the change touches no model or pack data. `pnpm lint` and `pnpm -C landing build` pass with both pages. The page and privacy page were reviewed in browser captures.

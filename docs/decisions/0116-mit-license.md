# 0116 — MIT License

Date: 20 October 2026. Status: implemented. Supersedes [0050](0050-osaasy-license.md).

## Context

Windows warns about unsigned installers, and macOS signing costs a yearly fee. The free route for Windows is [SignPath Foundation](https://signpath.org/), which signs releases for projects under an OSI-approved license built in public CI. The O’Saasy agreement is source available, not OSI open source, because of its restriction on competing hosted services, so the project did not qualify.

## Decision

- The owner relicensed OfflineMask under the **MIT License**. It is the O’Saasy text without its SaaS clause, so the grant, notice condition and warranty disclaimer are unchanged. Copyright stays “© 2026, Phong Phan.”
- Phong Phan is the only author in the history, so no other contributor's consent was needed.
- The project may now be described as open source; the landing page already said “Mã nguồn mở”. `package.json` and `desktop/package.json` declare `"license": "MIT"`.
- Dependencies, model weights, tokenizer resources and runtime libraries keep their upstream licenses and notices under [`docs/licenses/`](../licenses/), as before.

## Consequence

The restriction on offering OfflineMask as a competing hosted service is gone. For an offline desktop app the owner judged free Windows signing worth more. Releases published before this change remain under O’Saasy for anyone who obtained them then.

## SignPath application (same day)

The owner applied to SignPath Foundation. Its [conditions](https://signpath.org/terms) require a page titled “Code signing policy” on the home and download/release pages with the sponsor line, team roles and a privacy statement, plus uninstall instructions. Those are [`landing/code-signing.html`](../../landing/code-signing.html) (served at `/code-signing`, linked from the home page footer, download section and FAQ), a matching section in the README, a link in each release's notes, and an uninstall section in [`docs/install.md`](../install.md). The page states that releases up to 2.0.0 are unsigned and the application is pending; update it when the first signed release ships.

Still to do once accepted: add SignPath's signing step to the Windows job in [`release.yml`](../../.github/workflows/release.yml), with product name and version metadata enforced as SignPath requires.

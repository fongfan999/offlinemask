# 0116 — MIT License

Date: 20 October 2026. Status: reverted the same day; [0050](0050-osaasy-license.md) (O’Saasy) applies again.

## Context

Windows warns about unsigned installers, and macOS signing costs a yearly fee. The free route for Windows is [SignPath Foundation](https://signpath.org/), which signs releases for projects under an OSI-approved license built in public CI. The O’Saasy agreement is source available, not OSI open source, because of its restriction on competing hosted services, so the project did not qualify.

## Decision

- The owner relicensed OfflineMask under the **MIT License**. It is the O’Saasy text without its SaaS clause, so the grant, notice condition and warranty disclaimer are unchanged. Copyright stays “© 2026, Phong Phan.”
- Phong Phan is the only author in the history, so no other contributor's consent was needed.
- The project may now be described as open source; the landing page already said “Mã nguồn mở”. `package.json` and `desktop/package.json` declare `"license": "MIT"`.
- Dependencies, model weights, tokenizer resources and runtime libraries keep their upstream licenses and notices under [`docs/licenses/`](../licenses/), as before.

## Consequence

The restriction on offering OfflineMask as a competing hosted service is gone. For an offline desktop app the owner judged free Windows signing worth more. Releases published before this change remain under O’Saasy for anyone who obtained them then.

## Outcome (same day)

The owner applied to SignPath Foundation. The application was declined for lack of public adoption signals, with an invitation to reapply later. The code-signing policy page added for the application was withdrawn. The owner kept the MIT License.

## Reverted

With SignPath declined, the owner returned the project to the O’Saasy License Agreement ([0050](0050-osaasy-license.md)): `LICENSE.md`, the manifests, README, CONTRIBUTING, PRD and the site footers are back to their earlier text. Contributions are all the owner's, so no third-party code was received under MIT. Windows distribution without a paid certificate is being looked at through the Microsoft Store instead.

# 0110 — Landing page clarity and download trust

Date: 2026-10-20

## Context

An audit of the landing page found that it did not name the problem it solves or who it is for, repeated "offline" in several places, never listed what the app detects, sent every visitor to a generic GitHub release page, and paired its unsigned-build warning with no guidance. The owner chose to fix clarity and trust first and to defer richer motion (a scroll-driven "your machine / AI" boundary and morphing values) to a follow-up.

## Decision

- The hero states the problem directly: use AI with real documents (payroll, contracts, statements) without exposing the identifying values. One explanatory paragraph replaces the separate lead and description.
- A "Thường dùng cho" strip of everyday documents replaces the principles strip, which repeated the hero notes.
- A new section lists what is suggested for masking, split by source: rules built into the app (email, phone, account, card/CVV/PIN, CCCD/CMND, passport, tax code, passwords and API keys, transaction and customer codes) and the optional Vietnamese recognition pack (names, addresses, organisations). The list follows `desktop/src/core/detection/` and `desktop/packs/vietnamese-pii-v1.json`; it says that many matches rely on an accompanying label and that the user masks anything missed. Update it when detection changes.
- Privacy gains a fourth point inviting visitors to verify offline behaviour by disconnecting, with a link to the source.
- Download shows the release version, a main button that targets the visitor's installer on macOS (Apple Silicon unless Chromium reports an x86 Mac) and Windows, and an expandable list of every installer plus `SHA256SUMS.txt`. Links are built from the version in `desktop/package.json` at build time, so the page is deployed after the matching release is published. Without JavaScript the button still opens the latest release.
- `docs/install.md` explains checksum verification and first launch of unsigned builds on macOS, Windows and Linux; the download section and a new FAQ entry link to it.
- A 1200×630 share image (`landing/og/og.png`, rendered from `landing/og/card.html` with the pinned fonts) is referenced by `og:image`. It needs an absolute URL once the production domain is chosen.
- File-type labels in the formats list read horizontally; headings use balanced wrapping.

No dependencies, storage, telemetry or runtime network requests are added. Platform detection reads `navigator.userAgentData` locally and sends nothing.

## Verification

`pnpm lint` and `pnpm -C landing build` pass. In the in-app browser at 1440 px and 375 px (light, and dark at 1440 px): no horizontal overflow, the macOS button resolves to the 2.0.0 Apple Silicon `.dmg`, every installer link matches an asset name in the v2.0.0 release, no `__OM_VERSION__` placeholder remains, and no console errors. Windows and Intel-Mac detection were not exercised in a browser, and the share image was not checked in a real Zalo or Facebook preview.

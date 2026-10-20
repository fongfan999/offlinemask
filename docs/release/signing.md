# Signing OfflineMask releases

Unsigned builds make macOS and Windows warn before the first launch, which is the largest trust gap on offlinemask.com. This guide is the owner's checklist. The release workflow (`.github/workflows/release.yml`) already signs and notarizes macOS builds when the secrets below exist. Windows signing needs a certificate choice first (see below).

## macOS: Developer ID and notarization

What you get: no Gatekeeper prompt. The app opens with a double-click, and the publisher shows as your name.

1. **Join the Apple Developer Program** as an individual at <https://developer.apple.com/programs/enroll/> (USD 99 a year). Use an Apple ID with two-factor authentication. The certificate will show your legal name, for example "Developer ID Application: Phong Phan (TEAMID)".
2. **Create a Developer ID Application certificate.** Only the Account Holder can do this. In Xcode open Settings, then Accounts, then Manage Certificates, choose **+** and **Developer ID Application**. Or upload a CSR from Keychain Access at <https://developer.apple.com/account/resources/certificates>.
3. **Export it** from Keychain Access (My Certificates, right-click, Export) as a `.p12` with a strong password, then copy it as base64:

   ```sh
   base64 -i DeveloperID.p12 | pbcopy
   ```

4. **Note the signing identity:**

   ```sh
   security find-identity -v -p codesigning
   ```

5. **Create a notarization key.** In App Store Connect open Users and Access, then Integrations, then App Store Connect API. Generate a team key with the Developer role and download the `.p8` (it downloads only once). Note its Key ID and the Issuer ID.
6. **Add the repository secrets:**

   ```sh
   gh secret set APPLE_CERTIFICATE            # paste the base64 from step 3
   gh secret set APPLE_CERTIFICATE_PASSWORD
   gh secret set APPLE_SIGNING_IDENTITY       # "Developer ID Application: Phong Phan (TEAMID)"
   gh secret set APPLE_API_ISSUER             # Issuer ID
   gh secret set APPLE_API_KEY                # Key ID
   gh secret set APPLE_API_KEY_CONTENT < AuthKey_XXXXXXXXXX.p8
   ```

   An Apple ID with an app-specific password also works (`APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`), but an API key does not expire with a password change.

7. **Rehearse before tagging.** Run the **Release** workflow manually without a tag; it builds and signs without attaching anything. Download the macOS artifact and check it:

   ```sh
   codesign --verify --deep --strict --verbose=2 OfflineMask.app
   spctl --assess --type execute --verbose OfflineMask.app
   xcrun stapler validate OfflineMask.app
   ```

   `spctl` should report `source=Notarized Developer ID`.

8. **Release:** push the `vX.Y.Z` tag as usual. Then remove the "chưa được ký số" wording from the landing page, the install guide and the release notes for macOS.

The native recognition helper is signed before the Tauri CLI runs (the workflow imports the certificate into a temporary keychain for that). If notarization rejects a nested binary, the log names it, so start with the rehearsal run.

## Windows: choose a certificate

Signed installers show your name instead of "Unknown publisher". Windows SmartScreen may still warn on a new release until enough people have downloaded it. Since 2024 even EV certificates no longer skip that reputation step.

| Option | Fits OfflineMask? |
| --- | --- |
| **Azure Artifact Signing** (formerly Trusted Signing; cheap, works well with Tauri) | **Not available.** Microsoft accepts individual developers only from the United States and Canada, and organizations only from a short list of countries that excludes Vietnam. |
| **SignPath Foundation** (free signing for open-source projects) | **Not available.** It requires an OSI-approved license, and the O’Saasy license is not one. A brief MIT relicense to apply was declined for lack of public adoption signals and then reverted (decision 0116). |
| **OV code-signing certificate with cloud signing**, such as SSL.com eSigner | **Recommended** if paying. Since June 2023 private keys must live in hardware, and a cloud signing service is the way to use one from GitHub Actions. Individual validation needs a government ID. |
| **Certum Open Source Code Signing** | Cheapest for open-source developers, but its SimplySign cloud key needs an interactive login, so signing would be a manual step on a Windows machine rather than CI. |

Once you have chosen and been validated, the workflow needs one addition. Set a `signCommand` for Windows through `tauri build --config` only when the signing secrets exist, so unsigned dry runs keep working. Tauri's guide covers custom sign commands: <https://v2.tauri.app/distribute/sign/windows/>. Share the provider and the secret names, and the workflow change is a small, reviewable diff.

## After signing

- Update `docs/install.md`, the landing page download note and the FAQ answer about unverified apps for whichever platforms are signed.
- Keep publishing `SHA256SUMS.txt`; signing proves the publisher, and checksums still let anyone verify the exact file.

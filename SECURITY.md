# Security policy

OfflineMask processes sensitive text on the user's device. Reports that show private data leaving the device, reaching disk unexpectedly, or being exposed through a masked result are the highest priority.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private vulnerability reporting on this repository (**Security → Report a vulnerability**). You will get an acknowledgement, and the fix and advisory are coordinated with you before anything is published.

Include the steps to reproduce, the platform and app version, and, if the problem concerns detection or masking, a **synthetic** example that triggers it. Never send real customer data, real identifiers or real documents, and do not attach private sessions from your own use of the app.

## Scope

- The desktop application (`src/`, `src-tauri/`) and the optional recognition pack installer.
- Build and release scripts that produce the distributed artifacts.

Out of scope: the frozen evaluation experiments under `scripts/` and `docs/evaluations/`, which are not part of the application, and the quality of model detection itself (a missed name is a known limitation, not a vulnerability; report it as an ordinary issue with a synthetic example).

## Design commitments

- No telemetry, crash reporting, analytics or update checks. The only network activity is the user-initiated recognition pack download from pinned HTTPS URLs, verified by size and SHA-256 before use.
- Private text and findings stay in memory and are gone when the app closes, unless the user sets a passcode; then they are stored only in a locally encrypted vault (Argon2id-derived key, XChaCha20-Poly1305, no recovery). Synthetic sample sessions are the only history stored in plain form.
- Model loading is restricted to the verified local pack; remote models and browser or filesystem model caches are disabled.

Changes that weaken any of these need a documented decision, not just a pull request.

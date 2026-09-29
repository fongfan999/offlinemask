# 0006 — Lightweight installation, optional models, explicit detection scope

**Model selection update:** Optional delivery remains the accepted product direction. [Decision 0010](0010-vietnamese-model-selection.md) rejects the current pack's individual checkpoints and combination as the final release detector; the existing installation is retained for development only.

Date: 2026-09-09. Status: accepted owner direction, implemented.

The owner rejected a roughly 1.4 GB initial application and asked for Settings downloads and checkboxes showing which detection options need models. This supersedes model bundling in Decision 0005 and the former prohibition on all runtime model downloads. Offline processing remains required.

## Behavior

A fresh install selects email, phone, and labelled banking/identity identifiers. Their providers run in a worker without initializing the model runtime. Names, addresses, and other contextual private information remain selectable with “Cần mô hình”. Selecting one routes the processing action to Settings until its model pack is installed. Unavailable selected categories are never silently skipped. Drafts and choices survive navigation, and each temporary session records its chosen categories so preview can disclose unchecked scope.

Settings offers one Vietnamese pack containing the two complementary, pinned INT8 models selected in Decision 0005 (1,407,678,316 bytes including metadata). The size and optional nature are visible before download. Progress, pause, resume, error/retry, startup verification, and installed state are provided. Downloading continues across page navigation while the app is open. Interrupted bytes remain resumable across restarts. Model processing stays local; source text and mappings stay in RAM.

## Implementation and provenance

- `scripts/model-manifest.json` pins repository revisions, byte sizes, and SHA-256 digests. Both OpenMed model cards declare Apache 2.0; their README metadata and a full license are retained with installed assets.
- Rust `reqwest` 0.12 (MIT/Apache-2.0), with blocking I/O and rustls TLS, downloads on a separate thread. No frontend URL, path, or text is accepted by the download commands. The native client requests only fixed public Hugging Face assets and follows HTTPS redirects to asset hosting. Connection and request timeouts bound failures.
- `sha2` 0.10 (MIT/Apache-2.0) verifies complete files before activation. Exact byte ranges support resumption; incorrect ranges, truncated responses, and checksum failures cannot produce a ready model pack. Files live under the Tauri app-local data directory and survive app updates.
- App startup verifies installed hashes without networking. The Tauri asset scope is restricted to `$APPLOCALDATA/models/**`. Frontend CSP still excludes remote services; Transformers.js allows only local model files and bundled WASM.
- Normal Vite and desktop builds exclude the entire developer model directory, including when cached weights exist locally. Developer downloads and full CPU model evaluations remain explicit commands. Both lockfiles are retained.

Current Tauri managed-state/command/path and reqwest blocking-client documentation was checked through Context7. Registry licenses and pinned model provenance remain recorded in Decision 0005 and the manifest.

## Limits and validation

Model removal, model import UI, alternative language packs, and automatic updates are not implemented. A fully offline computer can use the built-in categories; optional models need the explicit initial download or a provisioned app-local model directory. Pause can wait for an in-flight network read to return (bounded by the request timeout). Interrupted files consume disk space so they can resume. Recognition remains approximate and must be reviewed.

Fast tests cover local-only routing, filtering before masking, category isolation across sessions, and exclusion from persisted sample history. Native loopback tests cover partial resume, rejecting full responses during resume, corrupt files, cancellation, and missing installations. Packaged macOS smoke results are recorded in `docs/review-design.md`.

## Follow-up direction — 2026-09-10

Model updates should be distributed as tested, versioned recognition packs. Users do not select upstream checkpoints. A future manual, app-wide check must cover both the application version and recognition packs; there must be no startup, scheduled, navigation-triggered, or background Internet check. The existing `model_status` polling inspects local installation/download state only and must remain distinct from update discovery.

The current Settings update/file-install controls are explicitly disabled placeholders. The release catalog, app updater, downloaded-file installer, and offlinemask.com download page are deferred. Future checks must distinguish unavailable checks from an up-to-date result, verify update assets before activation, and preserve the working installation on failure. An offline file installation should use the same verification boundary as downloads.

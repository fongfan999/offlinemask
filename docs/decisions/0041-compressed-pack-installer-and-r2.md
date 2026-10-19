# 0041 — Compressed pack installation and public R2 artifacts

Date: 20 September 2026. Status: transport/installation implemented; selected-pair production inference integration remains unfinished.

## Result

The owner authorized publishing the selected Underthesea INT8 + mSuperClinical INT8 files to their `offline-mask` R2 bucket. The exact 11 evaluated files are published as 13 content-addressed compressed objects, plus Apache license, provenance notice and a data-only catalog. The largest compressed file is split into three parts of at most 256 MiB to fit the dashboard's 300 MB per-file upload limit. These are transport parts, not extra models.

The pack transfers **712,190,910 bytes** and restores **1,137,855,937 bytes** of graph/tokenizer/configuration files. Compression does not change model quality, memory use or installed graph size. Public metadata/license/notice objects add a small separate overhead. See [public verification receipt](../evaluations/pack-compression-v1/r2-public-verification.json) for exact published bytes, hashes and verification time.

The [pinned catalog](../../desktop/packs/vietnamese-pii-v1.json) (then `scripts/release-pack-v1.json`) uses the owner-provided `https://pub-5b0280497d774b8f99417b3438d8bce8.r2.dev` base. Each compressed object has a SHA-256 name, length and hash; split streams also pin their combined hash. No private text, corrections, evaluation examples, account credentials or telemetry were uploaded.

## Installation contract

`src-tauri/src/model_pack.rs` implements:

- Explicit download only; discovery and startup inspect local files without requesting a catalog or checking updates.
- Existing range-resume downloader for each compressed file/part. Completed parts survive cancellation and network errors.
- Verification of part hashes, assembled compressed hashes and final installed hashes. Bounded output length and Zstandard decoder window prevent uncontrolled expansion.
- Free-space preflight, staging outside the active pack, per-file flush and complete-pack verification before a whole-directory rename exposes the new pack.
- Previous version directories remain intact. Only a damaged copy of the same version can be replaced; successful activation removes its temporary download cache. Verified legacy installations remain discoverable.
- Separate download and installation progress. A completed transfer is not reported as a ready installation.

Catalogs are compiled-in trusted data. The app does **not** fetch and execute a mutable remote manifest. An eventual general manual update checker and file-import flow are still separate features; their Settings controls remain placeholders.

## Dependencies

`zstd` 0.14.0 / zstd-safe 8 / zstd-sys 2.1.0 (Zstandard 1.5.7) provide streaming decompression. Rust wrappers are MIT; upstream Zstandard is BSD-3-Clause or GPL-2.0, using the BSD option. The locked build uses the native bundled implementation, not an external user-installed executable. `fs2` 0.4.3 (MIT/Apache-2.0) supplies available-disk-space reporting. Both run locally; neither adds background network access. Existing reqwest and SHA-256 code handle transport and integrity. Streaming decompression avoids a Python runtime or shell extraction dependency. A filesystem directory rename was chosen over unpacking a general-purpose archive: only individually named, pinned data files are installed.

Official references consulted: [Zstandard Rust decoder](https://docs.rs/zstd/0.14.0/zstd/stream/read/struct.Decoder.html), [fs2 available space](https://docs.rs/fs2/0.4.3/fs2/fn.available_space.html), and [Cloudflare public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).

Cloudflare describes `r2.dev` as a development endpoint with request and bandwidth throttling. The owner-provided endpoint is usable for verification; a custom download domain remains a public-release infrastructure requirement. No domain, DNS, access permissions or credentials were changed.

## Verification and limits

- 12 native unit tests passed: resume, cancellation, corruption, truncated/oversized expansion, output-hash mismatch, multipart ordering, atomic publication, previous-version preservation, legacy discovery, unsafe catalogs and insufficient disk space.
- The explicit real-file round-trip installed all 11 files from the prepared compressed objects and verified all output hashes. It passed in a **debug** build in 307 seconds; that is not a release-build installation timing claim.
- All 16 uploaded objects passed full public HTTPS SHA-256/length checks and nonzero-offset `206 Content-Range` checks.
- The explicit optimized native R2 test downloaded the complete 712 MB pack from an empty temporary directory, joined the split stream, installed all files, verified output hashes and removed the transfer cache. It passed in 88.44 seconds on this Mac/network; this is a single observed run, not a download-speed promise.
- 151 JavaScript tests, frontend production build, Rust formatting and Clippy passed. A macOS app bundle was produced.
- Settings disclosure worked by keyboard at a 760 × 740 browser viewport without horizontal clipping. The browser preview correctly disables native downloading. A separate packaged `OfflineMask Pack QA` build with its own bundle identifier/data directory opened successfully at 1000 × 740, showed the fresh missing-pack state and functional details disclosure, and was closed after inspection. The owner’s running app and temporary sessions were left intact. Download/installation states were verified in the native engine tests, not through the packaged UI. Windows/Linux and an end-to-end selected-pair desktop inference run remain unverified.

**The active app model manifest has deliberately not changed:** its inference adapter still targets the legacy development models. Publishing the selected pair does not make it compatible with that adapter. Do not display 712 MB for the active legacy pack or claim the selected pair is ready in the app. Connect and verify the production tokenizer/offset mapping and contextual label policy before atomically switching both the inference manifest and its transport catalog. Frozen model-quality reports remain unchanged and do not become passing release gates through packaging work.

Developer reproduction:

```sh
mise exec -- cargo test --manifest-path src-tauri/Cargo.toml --locked --lib
mise exec -- cargo test --manifest-path src-tauri/Cargo.toml --locked --lib actual_release_pack_round_trip -- --ignored
mise exec -- node scripts/verify-r2-pack.mjs
mise exec -- cargo test --manifest-path src-tauri/Cargo.toml --locked --release --lib public_release_pack_installs_from_r2 -- --ignored
```

The last two commands intentionally access the public bucket. Neither is part of app startup, normal tests or the build. The local round-trip needs ignored `artifacts/r2-v1-upload` files. `scripts/build-r2-pack.mjs` prepares a fresh upload directory from frozen compression evidence and refuses to overwrite existing model objects/catalogs.

## Follow-up — production integration

[Decision 0042](0042-production-recognition-pair.md) connects the selected pack and detector together. It supersedes this decision's earlier active-legacy-manifest limitation. Model quality limits and the development-endpoint caveat remain unchanged.

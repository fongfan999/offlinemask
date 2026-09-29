# Lossless download packaging for the selected v1 pair

20 September 2026. **The exact Underthesea INT8 + mSuperClinical INT8 evaluation assets compress from 1,137,855,937 bytes to 712,190,910 bytes with Zstandard level 9: a 37.4% reduction.** Every restored file matches its original SHA-256. This is a local packaging measurement, not an implemented app downloader or a published download.

The owner selected this pair for v1 in [Decision 0040](../../decisions/0040-v1-pair-and-compressed-download.md). The default installer remains small; one optional Vietnamese recognition pack contains both models. No extra model accuracy evaluation is needed merely to prove lossless restoration; existing model quality limitations still apply.

## Actual file measurements

| Component | Original evaluated assets | Compressed level 9 |
| --- | ---: | ---: |
| Underthesea INT8 and support files | 205,505,260 bytes | 158,476,988 bytes |
| mSuperClinical INT8 and support files | 932,350,677 bytes | 553,713,922 bytes |
| **Total** | **1,137,855,937 bytes (~1.14 GB)** | **712,190,910 bytes (~712 MB)** |

| Compression setting | Transfer bytes | Saving | Local extraction | Restored SHA-256 verification |
| --- | ---: | ---: | ---: | ---: |
| Zstandard level 3 | 774,248,369 | 32.0% | 2.14 s | 0.97 s |
| **Zstandard level 9** | **712,190,910** | **37.4%** | **1.93 s** | **1.02 s** |

Compression took 12.45 seconds at level 9 on the developer machine; that work happens before publishing, not on the user's device. Extraction/verification figures sum sequential per-file runs on the owner's Apple M1 Pro and warm local filesystem. They exclude network, app overhead, installation activation and guaranteed durable disk flush. They are not a promise that every user will install in three seconds.

Only the 11 files in the existing evaluation asset manifests are included. Final pack headers, signatures, licenses/notices and any extra production-runtime files can change final totals. The app runtime and installer are not included. The developer-generated Underthesea graph still needs verified distribution; no URL was invented or file published.

## Recommended delivery

Use [Zstandard](https://facebook.github.io/zstd/) level 9 as the first packaging candidate, compressing each file independently and extracting once during installation. Level 9 saved another ~62 MB over level 3 in this measurement without a measured extraction penalty. This does not establish it as optimal among every compression format/level.

The visible UI can remain simple:

> **Gói nhận diện tiếng Việt**  
> Tải khoảng 712 MB · Sau khi cài khoảng 1,14 GB  
> **Tải về**

Progress: **Đang tải → Đang cài đặt → Sẵn sàng**. Keep pause/resume and retry. Show actual transfer progress; do not declare the pair ready after downloading only Underthesea. Download size is genuinely smaller, while installed size and inference memory remain unchanged. Do not re-extract on each startup.

Production work still required: compressed-asset distribution, pinned transport/output hashes and size limits, resumable compressed ranges, disk-space checks, complete-pack staging and atomic activation, and failure/cancellation recovery. Use immutable release assets and preserve an existing working installation until the new pack is fully verified. Only explicit user actions may access the network; manual file installation and website publishing remain future work.

## Evidence

- [Frozen source files, hashes and settings](protocol.json)
- [Owner-selected pair and exact source provenance](selection.json)
- [Per-file sizes and timing results](results.json)
- [Independent decompression/hash replay](verification.json)
- Ignored local compressed files: `artifacts/pack-compression-v1/zstd-{3,9}/`

The measurement uses Zstandard CLI **1.5.7**, two compression threads, and the exact assets pinned in `shared-core-protocol-v2.json`. Each file was restored to a temporary disk file, its size and SHA-256 verified, and only that newly generated restored copy removed. A separate replay streams every compressed file through SHA-256 and rechecks original and compressed hashes. Original models, app dependencies and earlier evaluation evidence remain unchanged.

```sh
mise exec -- artifacts/minilm-admission/env/bin/python scripts/pack-compression-v1/verify.py
```

The reproduction command uses the existing local developer Python environment and installed `zstd`; neither is a dependency added to the application. For a new measurement, use a new evidence directory rather than overwriting the frozen results.

## Publication and installer follow-up — 20 September 2026

The measurements above remain frozen. The selected compressed files have now been published to the owner-authorized R2 bucket, and a resumable, hash-verified native installer has been implemented. See [Decision 0041](../../decisions/0041-compressed-pack-installer-and-r2.md) and the [public verification receipt](r2-public-verification.json). These supersede the earlier publication/installer status in this report. The app's active legacy inference manifest has not been switched to the selected pair; production inference integration remains outstanding.

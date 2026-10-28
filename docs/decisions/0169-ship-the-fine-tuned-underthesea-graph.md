# 0169 — The fine-tuned Underthesea graph of run 2 ships as the pack's new version

Date: 28 October 2026. Status: published and verified; the pack definition pins the new version and the gates pass on it. A release carries it to users. Owner: "Yes, ship it" (after decision 0168).

## What ships

One file of the recognition pack changes: `underthesea/model_int8.onnx`, the INT8 ONNX graph exported from epoch 1 of run 2 (decision 0168; evaluation [2026-10-28-candidate-run-2.md](../evaluations/2026-10-28-candidate-run-2.md)). `config.json`, `tokenizer.json` and `tokenizer_config.json` of the Underthesea model, and every OpenMed file, are byte for byte the ones already published, so their entries and objects stay as they are.

| | Previous (0041, 0096) | Now |
| --- | --- | --- |
| Graph size | 204 645 861 bytes | 204 645 753 bytes |
| Graph SHA-256 | `9e95f354…` | `6c4feff9…38f0214d` |
| Object (Zstandard level 9) | `bbe0438a….zst`, 158 225 764 bytes | `d17970b2cec0b9e12b6f31631c1c6731646777e98ac307660a4a3cc1c3ceab85.zst`, 158 305 504 bytes |
| Pack transfer total | 712 190 910 bytes | 712 270 650 bytes (still "712 MB" everywhere the app and the site say it) |
| Pack installed total | 1 137 855 937 bytes | 1 137 855 829 bytes (still "1.14 GB") |
| Install directory (digest of `assets`) | `65245d3f…` | `e562a9b38c4bc14f14a2187f78fe5fd0a213d36ad0012c8d7144c0cac5af9a10` |

The install directory is the digest of the `assets` array (packs/README.md), so an installation that has the previous version keeps it on disk and the app downloads only what changed: the one 158 MB object. The pack's `id`, `name`, `attribution` and `models` are unchanged; the privacy page is unchanged, since the download still comes from the same public bucket on the user's request and nothing else about networking, storage or permissions moves.

## Provenance

Base `undertheseanlp/vietnamese-ner-v1.4.0a2` at revision `a51e05fc09e1b1f0800dbad8ae84e86ad311debd` (Apache-2.0), fine-tuned by the pipeline of decisions 0163 and 0167 at commit a0ee489 on the synthetic document set of decisions 0153 and 0160 (seeds 100–131 as train, 132–135 as dev, two variants; generated documents only, no real document and no user input), three epochs on a CPU, seed 20261027, epoch 1 kept; exported to ONNX at opset 18 and dynamically quantized to INT8 as the previous graph was (`scripts/export-underthesea.py`, now `scripts/train/export_pack.py`). The tokenizer files are the source's, unchanged. A fine-tuned graph is a derivative under the same licence (0163 §Licence and hosting); the pack's attribution and the installer's `LICENSE` file stay as they are, and the bucket's provenance notice is updated to say the graph is fine-tuned (`artifacts/r2-v2-upload/NOTICE-vietnamese-pii-v1.txt`). No Wikipedia text is in the graph or redistributed.

## What was checked on this Mac

- `pnpm test` 430/430 after the pack test's two pinned totals moved to the new figures; `pnpm typecheck` and `pnpm lint` clean.
- The new version installed by hand under its digest beside the current one (the OpenMed files cloned, the four Underthesea files from run 2's pack, the installer's `LICENSE` copied), and `pnpm test:models <that root>` 23/23: every pinned file verified by size and digest, both models loaded offline, the fixtures masked.
- The Rust library tests 27/27 after the fingerprint test moved to the new digest and the ignored round-trip test's totals to the new figures; `pnpm check:native` (formatting, Clippy) clean.
- `pnpm compare:packs --pack <that root> --seeds 1-7`: the installed version measured on seeds 1–7 and the owner's sets (`desktop/artifacts/compare/2026-10-28-shipped-e562a9b3/`), the shipped baseline for every later change: the same counts as the candidate in 0168.
- The compressed object decompresses to the pinned graph (digest `6c4feff9…` both ways).

## Publication

The bucket is the owner's; this Mac holds no credentials for it, as in 0041, so the owner uploads through the Cloudflare dashboard, as the first publication was done:

1. `desktop/artifacts/r2-v2-upload/d17970b2cec0b9e12b6f31631c1c6731646777e98ac307660a4a3cc1c3ceab85.zst` into the `offline-mask` bucket under exactly that key (158 MB, under the dashboard's limit, no split needed).
2. `desktop/artifacts/r2-v2-upload/NOTICE-vietnamese-pii-v1.txt` over the existing `NOTICE-vietnamese-pii-v1.txt`.

Then, on this Mac: `node scripts/verify-r2-pack.mjs artifacts/r2-v2-objects.json ../docs/evaluations/pack-compression-v1/r2-public-verification-v2.json` (full public download, exact length and digest, a nonzero-offset range request, the receipt beside 0041's) and the ignored Rust test `public_release_pack_installs_from_r2` in release mode (the installer downloads the whole pack from the bucket into a temporary directory and installs it). The previous object stays in the bucket: an older app build still pins it.

**Done on 28 October.** The owner uploaded both files through the dashboard. `verify-r2-pack.mjs` downloaded the object in full from the public base: 158 305 504 bytes, digest `d17970b2…`, status 200, a nonzero-offset range request answered 206 ([receipt](../evaluations/pack-compression-v1/r2-public-verification-v2.json)); the published notice has the prepared file's digest. `public_release_pack_installs_from_r2` (release build) downloaded the whole pack from the bucket into a temporary directory, installed it and left no cache: passed in 146 s on this Mac and network, one observed run.

Users receive the new version with the next release (the `release` skill); the app embeds the pack definition, so a release is what changes what an installation downloads.

## What follows, separately

Decision 0168's ablation says `transactionCells` and `trims` bring nothing back for this graph. They retire in their own measured change, as 0165 retired two mechanisms, against the shipped baseline above.

# 0176 — Recognition packs download from packs.offlinemask.com

Date: 31 October 2026. The owner moved the app off temporary addresses now that offlinemask.com is the app's domain, created a new R2 bucket with the custom domain `packs.offlinemask.com`, and uploaded the pack files to it.

## Why

Since decision 0041 the pack files came from the first bucket's public development address, `pub-5b0280497d774b8f99417b3438d8bce8.r2.dev`. Cloudflare rate-limits those addresses and recommends a custom domain for anything users rely on, and the address says nothing about who serves the files.

## What

- **The 13 objects of `vietnamese-pii-v1`** (712 MB, named by their SHA-256) were copied unchanged to the new bucket. Before switching, each was downloaded from `https://packs.offlinemask.com/` and its digest checked against its name. The pack file, `desktop/scripts/build-r2-pack.mjs` and the privacy contract now name only that host. The privacy page names it too, and its date moved.
- **The old bucket stays up.** Released apps carry the old addresses and keep downloading from it; nothing is deleted there.
- **The fingerprint covers the installed files only.** It named the version folder (`packs/<fingerprint>`) by hashing each asset including its `transport`, so changing a download address would have made every installed pack look missing and downloaded 712 MB again, contrary to the comment on `Catalog`. It now hashes each file's directory, name, size and digest, so moving downloads never changes it (`moving_downloads_keeps_the_fingerprint`). The shipping pack's fingerprint changes once, from `e562a9b3…` to `23ce8542…`.
- **Installs under an earlier fingerprint stay in use.** When the current folder is absent, `discovered_root` accepts another folder under `packs/` that holds exactly these files and whose `.verified` stamp matches them. Only the stamp is compared, so other versions are never hashed, and nothing is moved or deleted. An install made by an earlier release is therefore used as is, without network (`install_under_an_earlier_fingerprint_stays_in_use`).

## Not done

- A download interrupted before updating loses its cached parts (they sit under the old fingerprint in `downloads/`) and starts again.

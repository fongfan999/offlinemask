# 0055 — Fast recognition pack check at launch

Date: 11 October 2026. Status: accepted by the owner, who found "Đang kiểm tra" on first opening Settings confusing.

## Context

On every launch the native `Models` manager started in the `checking` stage and SHA-256 hashed every installed pack file (about 1.14 GB), first in the release directory and then in the legacy directory, before reporting `ready` or `missing`. When the pack was absent it also hashed every cached download. Until this finished, Settings showed a "Đang kiểm tra" badge and a disabled "Đang kiểm tra…" download button next to the download size, which read as a stalled download rather than a disk check.

## Decisions

- After a pack root passes the full digest check, `Pack::installed` writes `.verified` into it, recording each asset's digest, path, size and modification time. Later checks compare this stamp with the files' current metadata and skip hashing when it matches. A missing, unreadable or different stamp falls back to the full check, which rewrites the stamp on success. The stamp is written in staging during install and moves with the directory, so a fresh install never hashes again on the next launch.
- `Pack::cached_bytes` uses file sizes only. It feeds the progress display; `install` still verifies every cached file's digest before using it.
- Settings shows no badge while checking and replaces the size and download button with a muted "Đang tìm gói trên máy…" line.

## Trade-off

The stamp trusts that a file with unchanged size and modification time has unchanged content. It does not detect silent disk corruption or a deliberate edit that restores the timestamp; the previous per-launch hash did. Anyone able to do the latter can already write the app data directory. Deleting `.verified` forces a full check on the next launch.

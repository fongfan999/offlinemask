# 0062 — Passcode vault: private sessions survive a restart

Date: 12 October 2026. Status: accepted by the owner ("implement something like passcode, if they forgot passcode, start with empty sessions").

## Problem

Private text sessions lived only in memory; the review screen said so and the owner found that at odds with the product's promise of sessions one can come back to. The PRD (FR-06) requires original values and restore mappings to be stored encrypted locally, and the project rules forbid writing real input through the plain sample-history store. So persistence needed its own encrypted store with a user-held secret.

## Decisions

- **One encrypted file, one passcode.** `src-tauri/src/vault.rs` keeps `sessions.vault` in the app's local data directory. The content key is derived from the passcode with Argon2id (64 MiB, 3 passes, 1 lane, 16-byte random salt) and the payload is sealed with XChaCha20-Poly1305 under a fresh 24-byte nonce on every save. The header (`OMV1`, Argon2 cost, salt, nonce) is authenticated as associated data. Writes go to a temp file and are renamed into place, so a crash mid-save leaves the previous vault intact. The key lives in native memory for the launch and is zeroized on drop; the passcode is never stored.
- **Forgotten passcode means an empty start.** There is no recovery question, hint or escrow. The lock screen's "Quên mật mã?" explains this and offers "Xóa và bắt đầu lại", which deletes the file; the app then opens with no private sessions and no passcode. Settings has the same wipe ("Xóa tất cả phiên đã lưu").
- **Opt-in, then automatic.** Without a vault, sessions stay in memory as before and the review footer says so with a link to Settings, where the user sets a passcode of at least four characters. From then on every change to a private session (new session, deleted session, choices, manual masks) mirrors into the vault, debounced and serialized, and the sidebar labels sessions "Đã lưu" instead of "Tạm thời". At launch a vault means the lock screen comes first; nothing else renders until it is opened or wiped.
- **What is stored.** `encodePrivateSessions` in `src/core/sessions.ts` serializes id, number, time, original text, chosen categories, analysis (findings and spans), manual-mask count and decisions. The undo buffer is not stored. `decodePrivateSessions` validates every record and rejects the whole vault on the first bad one, reported as "corrupt" with the wipe as the way out. Sample sessions keep their plain store.
- **Dependencies** (all RustCrypto, MIT or Apache-2.0, no network use): `argon2` 0.6, `chacha20poly1305` 0.11, `getrandom` 0.3 for salts and nonces, `zeroize` 1. `argon2` and `blake2` are built at `opt-level = 3` in dev profiles like `sha2`, because an unoptimized Argon2 at 64 MiB takes seconds.

## Limits

- The vault is only as strong as the passcode; a four-character minimum is a floor for usability, not a recommendation. The Settings copy says a forgotten passcode cannot be recovered.
- There is no auto-lock while the app is open and no per-session encryption; the whole list is one sealed blob rewritten on each change (bounded by the 50,000-character text limit per session).
- The browser preview has no native layer, so it reports the vault as unavailable and keeps the old in-memory behaviour.
- Cross-instance alias uniqueness is unchanged from decision 0059; stored sessions make an alias scope live longer, which is why the scope is still part of the alias.

## Verification

`cargo test --lib vault` passes three native tests: create, unlock, wrong passcode, save, change passcode and reopen; short passcodes, duplicate creation, locked saves, a flipped ciphertext byte and a truncated file; reset. `pnpm test` passes 204 tests including the private-session encoding and the composable against a fake adapter. `pnpm lint`, `pnpm typecheck` and `pnpm check:native` pass. The lock screen, the Settings card and the automatic saving were not driven in the in-app browser, which has no native vault; they need a run of the packaged or `tauri dev` app.

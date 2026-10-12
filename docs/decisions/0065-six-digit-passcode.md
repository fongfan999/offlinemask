# 0065 — The passcode is six digits, like a phone

Date: 12 October 2026. Status: accepted by the owner ("passcode is like iPhone passcode, numbers only").

## Decisions

- **Exactly six digits.** The native `vault` module rejects anything else with `passcode-invalid` ("Mật mã gồm đúng 6 chữ số."); this replaces the four-character minimum of decision 0062. Argon2id at 64 MiB and three passes is what makes a one-in-a-million passcode cost an attacker real time per guess on the file itself; the vault still assumes the machine's own account is the real boundary.
- **Phone-style entry.** `PasscodeField.vue` is a masked numeric field (`inputmode="numeric"`, six characters, non-digits dropped) shown centred with wide letter spacing. It emits `complete` on the sixth digit: the lock screen unlocks, the setup form moves to the confirmation field and then submits, so a user can type the code twice and never reach for a button. Settings uses the same field for current, new and confirmed codes.

## Verification

`pnpm lint`, `pnpm typecheck` and `pnpm test` (204) pass with six-digit codes in the composable tests; `cargo test --lib vault` and `pnpm check:native` pass with the new rule and tests for a five-digit and a mixed code. The entry screens need the desktop app.

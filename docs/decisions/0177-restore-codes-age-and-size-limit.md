# 0177 — Restore codes of replaced texts are kept a week, within 32 MB

Date: 31 October 2026. The owner asked whether a whole day of Ẩn nhanh grows memory, and chose to forget old restore codes after a week or past a size limit.

## Why

Quick restore searches the alias table of every private session seen in this launch, so an AI reply to text A still restores after text B was masked. Without a passcode the one-screen flow (decision 0072) drops each replaced session but kept its table until the app quit. A day of text masking adds about a megabyte, but the app can sit in the tray for weeks, and a replaced spreadsheet or document can hold tens of thousands of findings.

## What

- **Only tables of sessions no longer listed are limited.** Something open, in "Gần đây" or in history is never pruned here; history keeps its own keep period (decision 0143).
- **A week.** Those tables go seven days after their session was made.
- **32 MB.** Past that, the oldest of them go first until all tables fit. Size is estimated as two bytes per UTF-16 unit of each finding's strings plus 64 bytes per finding (`tableBytes`), computed once per table.
- **When.** Pruning runs whenever the session list changes, hourly, and when the window comes back (`expireHistory` in `App.vue`). The rules are `staleTables` in `src/core/quick-actions.ts`.
- **Effect.** Codes from a forgotten table read as unknown ("Không tìm thấy bản gốc"), as after quitting. The privacy page's storage table says so.

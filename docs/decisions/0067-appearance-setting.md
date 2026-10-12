# 0067 — Appearance setting: automatic, light or dark

Date: 12 October 2026. Status: requested by the owner ("the settings screen should have an option to switch light/dark mode and the auto one").

## Decision

Settings has a "Giao diện" row between the passcode card and the update tools (a move to the top of the page was tried and undone at the owner's request): a three-way segmented radio group, **Tự động** (default, follows the system as before), **Sáng** and **Tối**, with one line explaining Tự động.

- `src/composables/useTheme.ts` holds the choice. A pinned choice sets `data-theme` on `<html>`; Tự động removes it. `main.ts` applies the stored choice before mounting so the first paint already matches.
- `src/style.css` keeps the brand-kit tokens unchanged ([0052](0052-brand-theme-and-restoration.md)). The dark tokens apply under `prefers-color-scheme: dark` unless `data-theme="light"`, and always under `data-theme="dark"`; each pinned choice also sets `color-scheme` for native controls. The dark block is duplicated for the two selectors because plain CSS cannot share it.
- The choice is stored as `offlinemask.theme.v1` in `localStorage` (Tự động removes the key). It is an app preference with no user content, so it does not touch the sample-history or vault boundaries. Unreadable or unwritable storage falls back to Tự động for that launch.
- In the desktop app the native title bar follows through Tauri's `getCurrentWindow().setTheme()` (`null` returns it to the system), allowed by `core:window:allow-set-theme` in the default capability. On Linux and macOS Tauri applies the theme app-wide. No network access is involved.

Context7 was not available in this session; the Tauri API was checked against the installed `@tauri-apps/api` 2 type definitions and the generated capability schema.

## Verification

`pnpm lint`, `pnpm typecheck` and `pnpm test` passed. In the in-app browser at 1280 × 820: Tối under a light system turned the page dark and survived a reload; Sáng under a dark system turned it light; Tự động removed the attribute and the stored key and followed the dark system again. The radio group is keyboard-operable with the shared focus ring. The packaged app and its title-bar switch were not exercised.

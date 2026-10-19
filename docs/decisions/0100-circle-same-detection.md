# 0100 — The circle appears exactly when a click would hide something

Date: 19 October 2026. Status: requested by the owner. Asked whether showing the circle in every app makes sense for a tool meant for sharing with AI, then "how do we guarantee the built-in rules are exact with the actual models, then it wont show the circle", and finally: "the circle's check runs the same detection as the click (rules and models), reuses the result, shows the circle when slow, and applies to editable fields too."

## Problem

Ẩn nhanh ([0096](0096-selection-popover.md)) stays available in every application. The text worth hiding starts in mail, chat, documents and web pages, and the AI's answer comes back in a browser, which cannot be told apart from other sites from the outside. But two things were wrong:

- In editable fields every selection got a circle, "ok" in a chat included.
- Read-only text got a circle only when the **built-in rules** found something, while a click on it runs **every category the machine has**, the pack's models included. With the pack installed, a selection holding only a name (found by the models, not the rules) got no circle although a click would have hidden it.

## Decision

- **One detection for the check and the click.** `useMaskingRun().probe` now runs exactly what `maskText` runs: the same categories (all of them with the pack, the built-in ones without), the same model root, through one helper (`quickRun`). So "a circle appears" and "a click hides something" cannot disagree. A unit test pins both to the same call.
- **The click reuses the check.** The check's detections are kept in memory (the last one only, keyed by text, categories and model root) and the click that follows uses them instead of detecting again. Nothing is stored.
- **Every application, editable or not**: a masking circle only when that detection finds at least one value. Text holding OfflineMask codes still always gets its circle (restore, or the muted one for codes of an earlier launch). ⌘⇧M still acts on any selection.
- **Slow means show.** A check that has not answered within 1.5 s (models still loading, a long selection) shows the circle anyway; at worst the click reports there was nothing to hide, which beats a circle that silently never came. The "why no circle" note in Cài đặt therefore no longer has a "too slow" reason.
- **A check never outlives its selection.** Each selection and each clearing (a new mouse press) bumps a counter; a check that finishes for an older selection shows nothing.
- Turning Ẩn nhanh on still runs one throwaway check on synthetic text, which now also wakes the pack's models.

## Cost

With the pack installed, each selection runs the models on the machine, a fraction of a second for typical selections; without it, the same fast rules as before. Nothing leaves the machine.

## Checked

`pnpm test` (298: the check and the click share one detection with the models' options and root, and the click reuses it; plain text in editable and read-only fields shows no circle; a slow check shows it; a cleared selection's late check shows nothing), `pnpm typecheck`, `pnpm lint`; tried by the owner in the macOS desktop app ("it works").

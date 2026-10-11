# 0056 — Uninstall the recognition pack from Settings

Date: 11 October 2026. Status: accepted by the owner's request for an uninstall button under "Thông tin gói".

## Decisions

- The control lives inside the collapsed "Thông tin gói" section and appears only when the pack is ready, keeping the card's primary action unchanged. It asks for an inline confirmation that names the space freed and the size to download again; there is no system dialog.
- The `uninstall_models` command removes the app-local `models/<pack id>` directory: every installed version, the legacy development layout, staging and any cached download. It refuses unless the stage is `ready` and holds the status lock while removing, so a download cannot start into a half-removed directory. It clears the cached tokenizers. On failure it reports an action error and re-checks the disk in the background.
- The frontend releases the detector's loaded models when the ready root disappears. Uninstalling is disabled while a masking run is in progress rather than cancelling that run.

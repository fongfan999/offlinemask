# Product direction and accepted boilerplate

Recorded: 9 September 2026. These notes capture the owner's feedback and guide future implementation. Later explicit feedback can revise this direction.

## Current acceptance

> It's not perfect, but I think it's good enough for boilerplate, I'll feedback every page later

The current interface is accepted as the boilerplate baseline. This does not mean every page is final, that the design has been validated with users, or that the MVP is complete. Preserve this baseline while the owner supplies page-by-page feedback. Apply future feedback to the relevant page and update these notes when a shared decision changes. Do not initiate another broad visual redesign or reopen accepted choices without a new request or concrete implementation problem. Necessary bug fixes and explicitly requested features can proceed.

## Requirements to carry forward

- **Straightforward use:** the earlier dense three-panel review experience felt overwhelming. Keep the primary workflow obvious and secondary controls tucked away until needed. Do not add dashboards, review gates, dialogs, or technical controls without a clear user need.
- **Visual direction:** restrained, high-end liquid glass with readable text and a blue, white, and neutral palette. The owner explicitly dislikes purple/lavender. The earlier dark-green choice was not grounded in the owner's preference; do not restore it as the primary color.
- **Glass implementation:** consistency and speed matter. The current approach uses shared CSS tokens and one glass surface rule, with fallbacks. No dedicated glass library was requested or installed. Evaluate dependencies against demonstrated needs and measured behavior; do not claim that a library or CSS alone guarantees performance.
- **Home and navigation:** provide Text and Excel choices on the home page and left sidebar. Other file formats should be visibly coming soon until implemented.
- **Sessions:** each masking/redaction conversion should create a distinct session, comparable to conversation history in chat apps. Users must be able to return to earlier conversions and their choices. Starting a new conversion must not overwrite an earlier one.
- **Tooling and documentation:** use mise for tool versions. Study current official library/framework documentation with Context7 when doing library-specific work. Record scaffold provenance, consequential dependency choices, and implementation limits.
- **Open source:** the project is intended to be open source. Favor standard, maintainable patterns, reproducible setup, shared styling, clear contribution guidance, and documented dependencies. License selection remains pending; the owner has not selected one.

## Accepted prototype versus unfinished product

The committed baseline is an official Tauri Vue/TypeScript scaffold with custom UI, not a downloaded liquid-glass UI template. Text and Excel operate on public synthetic fixtures. Sample session history persists fixture references and mask/keep choices only. Excel copies tab-separated sample output; it does not import or export workbook files.

Real-input detection, Excel/file adapters, encrypted private history, restoration, cross-platform verification, and performance targets remain unfinished. Boilerplate acceptance must not be presented as acceptance or completion of those capabilities. Real private data must not be added to the sample localStorage path.

## Where future changes belong

- [PRD](../PRD.md): product requirements and remaining MVP work.
- [Workspace and glass decision](decisions/0002-workspace-and-glass.md): current implementation rationale and storage boundary.
- [Review design notes](review-design.md): actual interaction and verification evidence.
- [Contribution guide](../CONTRIBUTING.md): reproducible setup and engineering conventions.

Future page feedback should record the page, requested change, and any shared decision it supersedes. Do not invent page requirements before that feedback arrives.

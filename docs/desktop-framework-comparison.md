# OfflineMask: Tauri 2 versus Electrobun 2

Updated: 9 September 2026

Status: decision made — **Tauri 2 selected** in [Decision 0001](decisions/0001-desktop-stack.md). This document preserves the supporting comparison; no application performance benchmark has been completed.

## Selected approach

Use **Tauri 2 with Vue 3, TypeScript, and Vite** for the MVP. Keep Rust focused on native operations and private persistence. This decision follows the user's preference to preserve broader compatibility while the pilot's computers are still unknown.

Electrobun is a credible alternative when its supported machines are sufficient and keeping the main process in TypeScript materially reduces delivery effort. Its current platform restrictions are the main reason to prefer Tauri here. This is not a finding that Tauri is universally faster, smaller after all prerequisites are included, or automatically more secure.

The PRD requires Windows, macOS, Linux, and entirely offline installation and operation. Mobile is deferred and should be a tiebreaker. Neither framework provides Vietnamese PII detection, Excel fidelity, or reusable masking profiles automatically; those remain OfflineMask responsibilities.

## Comparison for this product

| Criterion | Tauri 2 | Electrobun 2 | Implication |
| --- | --- | --- | --- |
| Vue UI and development | Vue/Vite frontend; native integration through Rust and plugins. | Vue templates; TypeScript main process and UI. | Both fit the preferred frontend. Electrobun can reduce language switching. [1][2] |
| JavaScript dependencies | Browser-compatible packages can run in the frontend or workers. Node-only dependencies need an appropriate native adapter or separately packaged runtime. | Cottontail is the default; actual Bun is optional. Native addons and unusual runtime APIs need compatibility checks. | Electrobun has a useful advantage for backend JS libraries; it is not a guarantee that every npm package works. [3][4] |
| Windows coverage | Provides Windows installers and a Windows 10/WebView2 path. | README lists Windows 11+; current Windows build is x64, with ARM using emulation. | Tauri better preserves options for unknown pilot PCs. [5][6][7] |
| Mac coverage | Can build for both Intel and Apple Silicon, including universal bundles. | README lists macOS 14+; current core artifacts cover Apple Silicon, not Intel. | Tauri better matches the user's broader-compatibility preference. [6][7][8] |
| Linux coverage | Linux distribution packages need an explicit dependency and tested-distro plan. | Official Ubuntu 24.04+ baseline; other compatible distributions are community-supported and need runtime libraries. | Neither earns a blanket “all Linux machines” claim. [6][7][9] |
| UI/native access boundary | Capabilities restrict exposed frontend commands and scopes; core and plugin code retain system access. | Typed RPC, navigation restrictions, and sandboxed views that disable application RPC. | Both require deliberate authorization and input validation. Tauri has a documented capability model useful for narrow file access. [10][11] |
| Private persistence | Official Stronghold plugin is a candidate for secrets and keys, callable from JavaScript. | A vault adapter must be selected and validated against the chosen runtime. | Tauri offers a documented integration starting point; neither supplies our complete vault lifecycle. [12] |
| Completely offline distribution | Explicit WebView2 offline installation modes; application resources can be packaged locally. | Bundles the selected main runtime; uses system webviews or optional bundled CEF. Platform prerequisites still need local provisioning. | Test clean installation and attempted network access in either case. [3][5][7] |
| Reusable rules and profiles | Declarative packs and shared schemas are application code. | Same. | No meaningful framework advantage. |
| Vietnamese text and Excel | Detection, parsers, Unicode handling, preservation, and review are application concerns. | Same. | Test the same files and expected results in both. |
| Performance | No OfflineMask measurements yet. | No OfflineMask measurements yet. | No RAM, startup, throughput, or installer-size winner is established. |
| Future mobile | Tauri 2 includes iOS and Android targets; native features and UI still require adaptation. | No official mobile release target found in the reviewed target matrix. | Tauri offers a clearer route, but this is secondary to the desktop MVP. [7][13] |

Framework support only establishes a possible target. OfflineMask must still qualify the actual parser, detection runtime, dependencies, and packaged app on every advertised OS/CPU combination.

## Keeping development fast with Tauri

The selected approach does not require rewriting all application logic in Rust.

| Responsibility | Proposed implementation boundary |
| --- | --- |
| Review screen, settings, projects, and profile editor | Vue and TypeScript. |
| Pack schemas, conflict resolution, profile matching, and rule definitions | Portable TypeScript modules with explicit versioning and bounded execution. |
| Initial parsing and rule evaluation | Browser-compatible libraries in background workers where appropriate; validate memory, cancellation, and file fidelity before selecting them. |
| File dialogs, controlled file access, atomic writes, and persistent private data | A small native adapter using suitable Tauri plugins and Rust commands. |
| Alias mapping and restore operations | One defined project service; batch operations across the UI/native boundary and make persistence the responsibility of the vault adapter. |
| Optional model inference | A replaceable detector adapter, chosen after corpus evaluation. Do not require Python or move all processing to Rust merely because Tauri is used. |

The UI will necessarily handle sensitive values for review. Keep routine diagnostics free of those values, constrain their lifetime, and keep cryptographic key handling within the chosen vault boundary. Stronghold is a candidate, not a decision about bulk mapping storage, password recovery, or backups.

Electrobun would preserve the same logical modules while replacing the native adapter with a TypeScript main-process implementation. Its potential speed advantage is an engineering hypothesis until the actual dependencies and packaging are exercised.

## Conditions for revisiting the decision

Reconsider Electrobun only if implementation evidence justifies changing the selected stack and the confirmed pilot devices fit its release matrix. Any replacement must meet correctness, offline, and usability requirements. Expanded platform coverage alone does not require reopening the decision. Do not exclude users merely to make the shell choice easier.

The user prefers broader compatibility because the pilot machines are unknown. That supports the Tauri decision without assigning arbitrary numerical scores to speculative benefits.

## Validation still required

No packaged Tauri or Electrobun application was built or timed for this comparison. Documentation and architecture were reviewed; no customer workbook was uploaded or used as benchmark data. Empty-window figures from third-party comparison repositories do not establish OfflineMask's performance.

Validate the selected Tauri implementation using the workflow below. A second framework implementation is not required for initialization. If a future comparison becomes necessary, reuse one Vue review screen, one rule engine, and identical synthetic XLSX fixtures. Suggested workloads are a small correctness fixture and larger 10,000- and 50,000-row fixtures; these are test sizes, not agreed product limits.

1. Import Vietnamese text, identifier strings with leading zeros, repeated identifiers, dates, and monetary values.
2. Review and change a cell or column decision while keeping the UI responsive; test Vietnamese input-method composition, diacritics, keyboard selection, and copy/paste. Save a profile and reuse it after column reordering.
3. Mask, export, save and reopen the project, then restore known aliases from reordered returned data. Wrong-project and recognizable modified aliases must not cause guessed substitutions.
4. Preserve the original and declared output properties. Explicitly handle or block fixtures containing formulas, comments, hidden content, and unsupported workbook features.
5. Test installation, first launch, restart, pack import, and restoration on clean offline systems. Inspect attempted external requests as well as successful connections from the app and its bundled components.

Record complete installer and installed sizes including prerequisites; time until the same review UI is interactive; import, detection, export, and restore durations; whole-process-tree idle and peak memory; cancellation latency; and engineering effort for packaging and debugging. Use pinned versions, the same hardware, and repeated release runs. A result on this Apple Silicon Mac would not establish Windows or Linux performance.

Required platform coverage, offline behavior, and correctness are pass/fail release gates. Measure delivery effort and responsiveness in the selected implementation. Model inference should be evaluated separately from the rules-only workflow.

## Sources

Sources were reviewed on 9 September 2026. Electrobun's current documentation describes its 2.x Hutch/Cottontail architecture; older Bun-only comparisons should not be treated as a current specification.

1. [Tauri Vite integration](https://v2.tauri.app/start/frontend/vite/).
2. [Electrobun quick start and frontend templates](https://framework.blackboard.sh/electrobun/guides/quick-start/).
3. [Electrobun Cottontail and Bun runtime choices](https://framework.blackboard.sh/electrobun/guides/cottontail/).
4. [Tauri architecture](https://v2.tauri.app/concept/architecture/) and [sidecar integration](https://v2.tauri.app/develop/sidecar/).
5. [Tauri Windows installers and offline WebView2 options](https://v2.tauri.app/distribute/windows-installer/).
6. [Electrobun published OS requirements](https://github.com/blackboardsh/electrobun#platform-support).
7. [Electrobun release targets and runtime dependencies](https://framework.blackboard.sh/electrobun/guides/cross-platform-development/).
8. [Tauri universal Mac bundles](https://v2.tauri.app/distribute/app-store/).
9. [Tauri Debian packaging and dependencies](https://v2.tauri.app/distribute/debian/).
10. [Tauri trust boundaries](https://v2.tauri.app/security/) and [capabilities](https://v2.tauri.app/security/capabilities/).
11. [Electrobun BrowserWindow, RPC, and sandbox controls](https://framework.blackboard.sh/electrobun/apis/browser-window/).
12. [Tauri Stronghold integration](https://v2.tauri.app/plugin/stronghold/).
13. [Tauri supported platform families](https://v2.tauri.app/).

# Packaged native UI under IP denial — 21 September 2026

The unchanged Sidecar UI executable was copied into a disposable QA bundle. A LaunchServices wrapper applies `sandbox-exec` IPv4/IPv6 inbound/outbound IP denial before executing it. Unlike earlier direct executable launches, this produces an attachable, working GUI. `scripts/recognition-offline-v1/stage.py` reproduces the wrapper; it refuses normal user bundles. The wrapper changes only the outer bundle identity: the compiled Tauri QA data identity remains `dev.offlinemask.recognition.sidecarui20260921`.

Before exec, a small C launcher asserts `EPERM` on TCP and UDP socket connections for IPv4 and IPv6 loopback. The process keeps its PID and sandbox on exec; native helper children inherit that sandbox. The recorded probes are in the adjacent JSON files. Local IPC remains permitted. WebKit's separately managed XPC processes were not independently sandbox-probed: this is host/helper IP denial with the shipping local-only frontend CSP, not an assertion that every OS service had its network disabled. User/global networking was unchanged.

## Observed full-UI checks

- Clean QA app data: startup and navigation succeeded; no inference helper launched without a pack. Built-in Email, phone and labelled customer-code fixture produced three expected aliases.
- Names/address/other options showed `Cần tải thêm`; selecting a missing option revealed the 712 MB prompt. The action led to settings, not a partial masking result.
- Explicit `Tải về` with IP denied failed at 0 MB and showed a retryable error. Returning to Text preserved `Khách hàng H’Hen Niê.` exactly. No automatic download was triggered by startup or selecting an option.
- Restored verified local pack, restarted under the same denial, passed all four socket probes again. All categories were available and the 161-character selected-pair fixture masked the name, full apartment/street address and email while retaining the ordinary date/amount.
- Started a 50,000-character synthetic request, clicked Cancel, and checked the entire original draft remained present. No partial session was created. A subsequent short request produced the same three findings. Earlier session remained available.
- Restart cleared temporary sessions. Quit removed the exact QA host/helper. Original user app PIDs 16321 and 29625 were left running.

Clean run host: 15753 (no helper). Installed-pack host/helper: 16150/16173. Earlier exploratory wrapper run 3721/3747 also passed short masking/cancel/retry but lacked the inline socket probe and is not used as the primary evidence.

The clean state was created by temporarily moving only the disposable QA data directory, then restoring it; no private app data was accessed. This checks first-open behavior and offline processing. It does not re-test successful online pack delivery; that was separately exercised in Decision 0045. All text here is synthetic. No detection-quality claim beyond the existing fixture evidence is added.

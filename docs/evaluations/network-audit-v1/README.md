# Network observation of packaged text masking

Recorded: 8 October 2026. Outcome: no network entries observed in the selected processes; comprehensive attempted-request tracing remains unverified.

## Artifact and isolation

Tested the existing `OfflineMask Fully Signed QA.app`, not a newly built public DMG. Its separate compiled QA identity uses synthetic test data and an already installed pack. The host, helper and runtime hashes actually measured in this run are in [results.json](results.json); do not substitute hashes from older packaging reports. The bundle passed `verify-native-desktop.mjs`, including signature, notices and absence of bundled model weights. macOS 26.6.2, Apple Silicon. No user app was running at the initial inventory. No production app data, global networking or security settings were changed.

## Monitor and control

Used the installed Apple `nettop` in one-second CSV sampling mode. First phase selected host/helper names and the three newly observed WebKit process IDs (GPU, Networking, WebContent). The restart phase selected those process names before launch to include newly created processes. WebKit association was inferred from process inventories before launch, after launch and after quit. Privileged responsibility inspection was unavailable.

Commands, with the actual first-run process IDs:

```sh
nettop -n -P -L 240 -s 1 -p offlinemask -p recognition-sidecar -p 96250 -p 96251 -p 96254 -J bytes_in,bytes_out
nettop -n -P -L 45 -s 1 -p offlinemask -p recognition-sidecar -p com.apple.WebKit.Networking -p com.apple.WebKit.WebContent -p com.apple.WebKit.GPU -J bytes_in,bytes_out
```

Replace PIDs with a fresh inventory when reproducing. Confirm the QA app and worker quit afterward. Name-based restart monitoring can include unrelated WebKit instances; do not retain their activity as app evidence.

A separate `nettop -n -P -L 12 -s 1 -p curl -J bytes_in,bytes_out` control detected a rate-limited request to `https://osaasy.dev/`: 14,612 incoming bytes and 623 outgoing bytes in the last observed control row. An earlier request to offlinemask.com failed DNS resolution. These were deliberate developer control requests, outside the application.

Both application captures completed normally: **240 samples + 45 samples, zero process rows**. These are empty socket observations, not a claim of a measured zero for every possible network attempt. An additional `lsof -nP -a -p 96239,96250,96251,96254,96304 -i` inspection found no IP sockets. Raw CSV remains local under `artifacts/network-audit-v1`; hashes and sample counts are recorded in results.json.

## UI observations during monitoring

- Masked the synthetic customer name Nguyễn Minh Anh, complete apartment/street address and minh.anh@example.com; ordinary transaction date and amount remained. Preview showed three replacements.
- Copy action displayed `Đã sao chép`; original-text view displayed the synthetic source. This checked the UI confirmation, not an independent clipboard-content comparison.
- Started a 50,000-character repeated synthetic fixture and cancelled. Editor returned with its 50,000-character count and masking action available; no partial session appeared. Accessibility text did not expose an exact full-string comparison, so this run does not assert byte-for-byte retention.
- Replaced that draft with a short synthetic name/email fixture. Retry succeeded with two replacements.
- Quit removed the QA app and helper. Restart showed no temporary sessions, started a new model helper, and Settings showed the installed 1.14 GB pack as ready. Final quit again removed the app/helper.

## Source checks and remaining boundary

Inspected application paths: model startup checks local files; downloading is invoked by the explicit Settings action; model providers set `allowRemoteModels = false`; the shipping CSP permits local assets/IPC rather than external connections. This is supporting source evidence, not an independent audit of every dependency or proof that this historical artifact equals a future release build.

Detailed `tcpdump -i pktap,all` monitoring failed with `ioctl(SIOCIFCREATE): Operation not permitted`. `sudo -n true` required a password; `launchctl procinfo` required root. Access to BPF devices alone did not provide the required PKTAP privilege. No password was requested or security setting changed. Context7 had no matching Apple PKTAP documentation; commands were checked against this machine's installed tcpdump manual and nettop help.

One-second socket sampling can miss brief connections and requests rejected before creating a socket. It also does not prove the absence of DNS activity delegated to system services. Even packet capture alone cannot prove the absence of pre-network attempts. Closing the comprehensive gate requires a validated observer covering connection attempts, denied requests and delegated WebKit/system networking, with an app/webview positive control, on the final release artifact. The earlier [host/helper IP-denial tests](../recognition-offline-v1/README.md) remain complementary evidence that masking works without those processes having IP access.

No runtime behavior or detection policy changed. No telemetry was added. This run narrows the evidence gap; it does not close the stronger all-components/no-attempt claim.

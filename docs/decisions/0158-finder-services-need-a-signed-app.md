# 0158 — Finder lists an app's Services only when the app is signed with a Developer ID

Date: 26 October 2026. Status: recorded; nothing to change in the app until the Mac build is signed. Owner, testing the 2.3.0 native build: "I don't know how to open PDF through the Finder service?", with Finder's Open With list and its Services submenu, which showed Warp, TeamViewer and "Send to Claude" but no OfflineMask item.

## What was checked

The two Services of decision 0094 are declared in `src-tauri/Info.plist` and registered: `pbs -dump` lists both for `/Applications/OfflineMask.app`, the file one with `com.adobe.pdf` among its `NSSendFileTypes`, and `NSServicesStatus` disables nothing. The declaration matches TeamViewer's, which Finder shows, except for an empty `NSRequiredContext`, and the Automator workflow "Send to Claude" shows without one. Neither explained it, so Finder's Services submenu was read by UI scripting with an invented one-page PDF selected (the owner's documents were not used), as the oracle for each experiment on macOS 26.6.2:

1. **A duplicate registration** from a debug bundle (`target/debug/…/OfflineMask Landing Review.app`, same port name and titles) was moved aside and the registry refreshed: no change.
2. **Three probe apps**, each a shell script with an `Info.plist` declaring one file Service: unsigned with `com.adobe.pdf`, ad hoc signed with `com.adobe.pdf`, ad hoc signed with `public.item` (TeamViewer's declaration). All three were registered (`lsregister -f`, `pbs -update`, present in `pbs -dump`); none appeared.
3. **Every file Service Finder did list** comes from an app with a Developer ID team identifier (Warp, TeamViewer, Clop, Terminal) or from an Automator workflow, which the system runs itself. OfflineMask's build is ad hoc signed (`TeamIdentifier=not set`), and `spctl --assess` rejects it; so were the probes.

The provider itself works: decision 0094 verified both Services through `NSPerformService` with a debug bundle, and the file path routes a PDF through the same code as a drop on the home page (0149). What is missing is only the menu item, which macOS withholds from apps it would not let Gatekeeper accept. Whether the rule is "a valid Developer ID" or "accepted by Gatekeeper" could not be separated on this Mac, which has no signing identity; both say the same thing for this app.

## Decision

- Nothing changes in the declaration or the provider. The Services appear once the Mac build is signed with a Developer ID and notarized ([docs/release/macos-arm64.md](../release/macos-arm64.md)); until then, on macOS, files reach OfflineMask by drag and drop and the file picker, and selected text by ⌘⇧M and the circle. Windows has no Services and is unaffected.
- The 2.3.0 changelog no longer names the Finder service as a way to open a PDF, so the unsigned build promises nothing it cannot show. `landing/privacy.html` and the product page do not mention the Services and are unchanged.
- The probe apps were unregistered and deleted, the debug bundle put back, and the registry refreshed; the owner's Finder keeps its own state.

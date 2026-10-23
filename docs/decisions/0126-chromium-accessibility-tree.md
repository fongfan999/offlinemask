# 0126 — macOS: ask Chromium and Electron apps for their accessibility tree

Date: 23 October 2026. Status: found by the owner on macOS (dev build, Ẩn nhanh on, Accessibility granted): selecting a support message with a name, account number and phone in ChatGPT's message box in Dia showed no circle, and Settings showed no skip reason. The same text in TextEdit showed the circle.

## Problem

Chromium (Chrome, Dia, Arc, Edge) and Electron (Slack, Zalo, Signal, VS Code, Lark) applications build their accessibility tree only when an assistive client asks for it. Until then `AXFocusedUIElement` on the application answers `kAXErrorNoValue` (-25212), so `read_selection` returned nothing and no `selection-made` event was sent. Probed on the owner's machine: Dia, Zalo and Signal all answered -25212.

Earlier tests in Dia ([0096](0096-selection-popover.md), [0101](0101-circle-by-the-text.md)) worked because something had already switched Dia's tree on in that launch (a probe script setting `AXManualAccessibility`, or another assistive tool). Once a fresh Dia started, the circle never appeared.

## Decision

The first time a selection is read from an application in a launch, the macOS backend sets `AXManualAccessibility` to true on that application's element. This is the switch Electron added for assistive tools and Chromium honours; native applications reject it, which is harmless. When the switch is accepted, the focused element is asked up to five times, 120 ms apart, while the tree is built. After setting the switch in Dia, the same probe returned the focused element and its selection through `AXSelectedTextMarkerRange`.

`AXEnhancedUserInterface` is not set: Dia does not support it ([0101](0101-circle-by-the-text.md)), and it disturbs window animations in other apps.

## Consequences

An application asked this way keeps its accessibility tree on until it quits, as it would for VoiceOver or any other assistive tool, at some memory and CPU cost inside that application. Applications are asked only while Ẩn nhanh is on and only once a selection gesture happens in them. Nothing about what OfflineMask observes or stores changes: still left-button presses and releases, the selected text read on demand, nothing kept (see `landing/privacy.html`).

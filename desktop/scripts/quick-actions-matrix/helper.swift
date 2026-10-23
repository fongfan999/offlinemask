// The native half of the Ẩn nhanh matrix (README.md): window listing, synthetic input,
// Accessibility reads and the clipboard, each a subcommand printing one JSON object.
// Built by run.mjs with `swiftc -O`; the timed steps run here so a process start never
// sits inside a measurement.
import AppKit
import ApplicationServices
import CryptoKit
import Foundation

func emit(_ value: [String: Any]) {
  let data = try! JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
  FileHandle.standardOutput.write(data)
  FileHandle.standardOutput.write("\n".data(using: .utf8)!)
}
func fail(_ message: String) -> Never {
  emit(["error": message])
  exit(1)
}
func now() -> Double { Double(DispatchTime.now().uptimeNanoseconds) / 1e6 }
func pause(_ ms: Double) { usleep(useconds_t(ms * 1000)) }

// MARK: Windows

struct Window {
  let id: Int
  let x: Double, y: Double, width: Double, height: Double
  var json: [String: Any] { ["id": id, "x": x, "y": y, "width": width, "height": height] }
  var center: CGPoint { CGPoint(x: x + width / 2, y: y + height / 2) }
}
/// On-screen windows of processes whose owner name is `owner` (CGWindowList).
func windows(owner: String) -> [Window] {
  let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
  return list.compactMap { info in
    guard info[kCGWindowOwnerName as String] as? String == owner,
      let bounds = info[kCGWindowBounds as String] as? [String: Double],
      (info[kCGWindowAlpha as String] as? Double ?? 1) > 0
    else { return nil }
    return Window(
      id: info[kCGWindowNumber as String] as? Int ?? 0, x: bounds["X"] ?? 0, y: bounds["Y"] ?? 0,
      width: bounds["Width"] ?? 0, height: bounds["Height"] ?? 0)
  }
}
/// The circle: OfflineMask's small floating window (narrower than 80 points).
func circle(owner: String) -> Window? { windows(owner: owner).first { $0.width < 80 && $0.height < 80 } }
/// The preview card: the pill window grown to a card (the hover hint stays short).
func card(owner: String) -> Window? {
  windows(owner: owner).first { $0.width >= 200 && $0.height >= 100 && $0.width < 900 }
}

// MARK: Input

let source = CGEventSource(stateID: .hidSystemState)
func key(_ code: CGKeyCode, _ flags: CGEventFlags = []) {
  for down in [true, false] {
    let event = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: down)!
    event.flags = flags
    event.post(tap: .cghidEventTap)
    pause(8)
  }
}
func click(_ point: CGPoint, count: Int = 1) {
  CGEvent(mouseEventSource: source, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)!
    .post(tap: .cghidEventTap)
  pause(30)
  for n in 1...count {
    for type in [CGEventType.leftMouseDown, .leftMouseUp] {
      let event = CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: point, mouseButton: .left)!
      event.setIntegerValueField(.mouseEventClickState, value: Int64(n))
      event.post(tap: .cghidEventTap)
      pause(12)
    }
  }
}
let keyA: CGKeyCode = 0, keyV: CGKeyCode = 9, keyDelete: CGKeyCode = 51

// MARK: Accessibility

func attribute(_ element: AXUIElement, _ name: String) -> AnyObject? {
  var value: AnyObject?
  return AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success ? value : nil
}
func string(_ element: AXUIElement, _ name: String) -> String? { attribute(element, name) as? String }
func children(_ element: AXUIElement) -> [AXUIElement] {
  attribute(element, kAXChildrenAttribute) as? [AXUIElement] ?? []
}
func frame(_ element: AXUIElement) -> CGRect? {
  guard let position = attribute(element, kAXPositionAttribute), let size = attribute(element, kAXSizeAttribute)
  else { return nil }
  var point = CGPoint.zero, extent = CGSize.zero
  AXValueGetValue(position as! AXValue, .cgPoint, &point)
  AXValueGetValue(size as! AXValue, .cgSize, &extent)
  return CGRect(origin: point, size: extent)
}
/// Brings an app forward; Accessibility's AXFrontmost works where macOS 14's cooperative
/// activation ignores a request from a background process.
func bringForward(_ pid: pid_t) {
  AXUIElementSetAttributeValue(AXUIElementCreateApplication(pid), kAXFrontmostAttribute as CFString, kCFBooleanTrue)
  NSRunningApplication(processIdentifier: pid)?.activate()
}
func focused(_ pid: pid_t) -> AXUIElement? {
  attribute(AXUIElementCreateApplication(pid), kAXFocusedUIElementAttribute) as! AXUIElement?
}
/// Depth-first search, bounded so a huge page cannot stall a run.
func find(_ root: AXUIElement, limit: Int = 6000, _ match: (AXUIElement) -> Bool) -> AXUIElement? {
  var stack = [root], seen = 0
  while let element = stack.popLast(), seen < limit {
    seen += 1
    if match(element) { return element }
    stack.append(contentsOf: children(element).reversed())
  }
  return nil
}
/// The page text the matrix compares: the element's value, else its descendants' text.
func text(_ element: AXUIElement) -> String {
  if let value = string(element, kAXValueAttribute), !value.isEmpty { return value }
  var parts: [String] = []
  var stack = [element], seen = 0
  while let next = stack.popLast(), seen < 400 {
    seen += 1
    if string(next, kAXRoleAttribute) == kAXStaticTextRole, let value = string(next, kAXValueAttribute) {
      parts.append(value)
    }
    stack.append(contentsOf: children(next).reversed())
  }
  return parts.joined()
}
func describe(_ element: AXUIElement?) -> [String: Any] {
  guard let element else { return [:] }
  var out: [String: Any] = ["role": string(element, kAXRoleAttribute) ?? ""]
  if let id = string(element, "AXDOMIdentifier") { out["domId"] = id }
  if let selected = string(element, kAXSelectedTextAttribute) { out["selectedLength"] = selected.count }
  if let rect = frame(element) { out["frame"] = [rect.minX, rect.minY, rect.width, rect.height] }
  return out
}
/// The element a case reads: one with this DOM id, the first one with this role in the
/// front window, or the app's focused element.
func target(_ pid: pid_t, _ domId: String?, role: String? = nil) -> AXUIElement? {
  let app = AXUIElementCreateApplication(pid)
  if let domId, !domId.isEmpty { return find(app) { string($0, "AXDOMIdentifier") == domId } }
  if let role, !role.isEmpty {
    let window = attribute(app, kAXFocusedWindowAttribute) as! AXUIElement? ?? app
    return find(window) { string($0, kAXRoleAttribute) == role }
  }
  return focused(pid)
}

// MARK: Clipboard

func pngDigest() -> String? {
  guard let data = NSPasteboard.general.data(forType: .png) else { return nil }
  return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
}

// MARK: Commands

var args = Array(CommandLine.arguments.dropFirst())
func option(_ name: String) -> String? {
  guard let index = args.firstIndex(of: "--\(name)"), index + 1 < args.count else { return nil }
  return args[index + 1]
}
func number(_ name: String, _ fallback: Double) -> Double { option(name).flatMap(Double.init) ?? fallback }
func pid() -> pid_t {
  guard let value = option("pid").flatMap(Int32.init) else { fail("--pid is required") }
  return value
}
let owner = option("owner") ?? "OfflineMask"

switch args.first ?? "" {
case "trusted":
  emit(["trusted": AXIsProcessTrusted()])

case "windows":
  emit(["windows": windows(owner: owner).map(\.json)])

case "app":
  // Installed path and running process of the first bundle id that resolves.
  for bundle in (option("bundle") ?? "").split(separator: ",").map(String.init) {
    guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundle) else { continue }
    let running = NSRunningApplication.runningApplications(withBundleIdentifier: bundle).first
    emit(["bundle": bundle, "path": url.path, "pid": Int(running?.processIdentifier ?? 0)])
    exit(0)
  }
  emit(["path": NSNull()])

case "wait-title":
  // Waits for a window whose title contains `--title`, raises it and brings its app forward.
  let app = pid(), wanted = option("title") ?? "", start = now(), limit = number("timeout", 15000)
  while now() - start < limit {
    let list = attribute(AXUIElementCreateApplication(app), kAXWindowsAttribute) as? [AXUIElement] ?? []
    if let window = list.first(where: { (string($0, kAXTitleAttribute) ?? "").contains(wanted) }) {
      AXUIElementPerformAction(window, kAXRaiseAction as CFString)
      AXUIElementSetAttributeValue(window, kAXMainAttribute as CFString, kCFBooleanTrue)
      bringForward(app)
      pause(300)
      emit(["found": true, "ms": Int(now() - start), "frame": frame(window).map { [$0.minX, $0.minY, $0.width, $0.height] } ?? []])
      exit(0)
    }
    pause(200)
  }
  emit(["found": false])

case "reload":
  key(15, .maskCommand)
  emit(["ok": true])

case "frontmost":
  let app = NSWorkspace.shared.frontmostApplication
  emit(["pid": Int(app?.processIdentifier ?? 0), "bundle": app?.bundleIdentifier ?? ""])

case "activate":
  bringForward(pid())
  pause(number("wait", 300))
  emit(["frontmost": Int(NSWorkspace.shared.frontmostApplication?.processIdentifier ?? 0)])

case "web-accessibility":
  // Chromium builds its tree only for assistive technology that asks (decision 0126).
  let app = AXUIElementCreateApplication(pid())
  let manual = AXUIElementSetAttributeValue(app, "AXManualAccessibility" as CFString, kCFBooleanTrue)
  let enhanced = AXUIElementSetAttributeValue(app, "AXEnhancedUserInterface" as CFString, kCFBooleanTrue)
  emit(["manual": manual.rawValue, "enhanced": enhanced.rawValue])

case "wait-element":
  // Waits until an element with this DOM id exists (a web page finished loading).
  let start = now(), limit = number("timeout", 10000)
  while now() - start < limit {
    if let element = target(pid(), option("dom-id")) {
      emit(["found": true, "ms": Int(now() - start), "element": describe(element)])
      exit(0)
    }
    pause(200)
  }
  emit(["found": false])

case "read":
  let element = target(pid(), option("dom-id"))
  emit(["text": element.map(text) ?? NSNull(), "element": describe(element)])

case "focus":
  // Focus a field by DOM id (or keep the focused one), then select its whole text with ⌘A.
  guard let element = target(pid(), option("dom-id"), role: option("role")) else { fail("element not found") }
  if option("dom-id") != nil || option("role") != nil {
    AXUIElementSetAttributeValue(element, kAXFocusedAttribute as CFString, kCFBooleanTrue)
    let current = focused(pid())
    let missed = current.map { !CFEqual($0, element) && string($0, "AXDOMIdentifier") != option("dom-id") } ?? true
    if missed, let rect = frame(element) {
      click(CGPoint(x: rect.midX, y: rect.minY + min(12, rect.height / 2)))
    }
    pause(150)
  }
  emit(["element": describe(focused(pid()))])

case "paste-text":
  // Put the sample into the focused field through the clipboard (chat composers ignore
  // AXValue writes). Never presses Return.
  let board = NSPasteboard.general
  board.clearContents()
  board.setString(option("text") ?? "", forType: .string)
  key(keyA, .maskCommand)
  pause(60)
  key(keyV, .maskCommand)
  pause(number("wait", 400))
  emit(["ok": true])

case "clear-field":
  // Select all in the focused field and delete it: a test composer left empty.
  key(keyA, .maskCommand)
  pause(60)
  key(keyDelete)
  emit(["ok": true])

case "set-clipboard-image":
  // A small generated image, so a text-only "restore" would show as a loss.
  let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: 24, pixelsHigh: 24, bitsPerSample: 8, samplesPerPixel: 4,
    hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  for x in 0..<24 {
    for y in 0..<24 {
      bitmap.setColor(NSColor(red: CGFloat(x) / 24, green: 0.3, blue: CGFloat(y) / 24, alpha: 1), atX: x, y: y)
    }
  }
  let data = bitmap.representation(using: .png, properties: [:])!
  let board = NSPasteboard.general
  board.clearContents()
  board.setData(data, forType: .png)
  emit(["digest": pngDigest() ?? "", "changeCount": board.changeCount])

case "check-clipboard":
  // Waits for the clipboard to hold the image again: a restore may still be running.
  let expected = option("digest") ?? "", start = now(), limit = number("timeout", 3000)
  var digest = pngDigest()
  while digest != expected && now() - start < limit {
    pause(50)
    digest = pngDigest()
  }
  emit([
    "restored": digest == expected, "ms": Int(now() - start),
    "types": (NSPasteboard.general.types ?? []).map(\.rawValue),
  ])

case "case":
  // One timed run: select, wait for the circle, click it, wait for the outcome.
  let app = pid(), domId = option("dom-id"), role = option("role"), circleLimit = number("circle-timeout", 4000)
  let resultLimit = number("result-timeout", 5000)
  guard let field = target(app, domId, role: role) else { fail("field not found") }
  let watch = option("watch-dom-id").flatMap { target(app, $0) } ?? field
  let before = text(watch)
  var out: [String: Any] = ["before": before]
  // A circle left over from an earlier run would be clicked instead of this one.
  let stale = now()
  while circle(owner: owner) != nil && now() - stale < 2500 { pause(50) }

  let start = now()
  switch option("select") ?? "keys" {
  case "triple-click":
    guard let rect = frame(field) else { fail("field has no frame") }
    click(CGPoint(x: rect.minX + min(40, rect.width / 3), y: rect.minY + min(10, rect.height / 2)), count: 3)
  default:
    key(keyA, .maskCommand)
  }
  // The pill window shrinks to the circle before it moves to the selection, so a circle
  // counts once it has held still for 60 ms; its time is when it reached that spot.
  var dot: Window?, seen: Window?, seenAt = 0.0
  while now() - start < circleLimit {
    if let found = circle(owner: owner) {
      if let last = seen, last.x == found.x, last.y == found.y {
        if now() - seenAt >= 60 { dot = found; break }
      } else {
        seen = found
        seenAt = now()
      }
    } else {
      seen = nil
    }
    pause(15)
  }
  out["selected"] = describe(focused(app))
  guard let dot else {
    out["outcome"] = "no-circle"
    emit(out)
    exit(0)
  }
  out["circleMs"] = Int(seenAt - start)
  out["circle"] = dot.json

  let clicked = now()
  click(dot.center)
  var outcome = "nothing"
  while now() - clicked < resultLimit {
    if text(watch) != before { outcome = "replaced"; break }
    if card(owner: owner) != nil { outcome = "preview"; break }
    pause(15)
  }
  if outcome != "nothing" { out["resultMs"] = Int(now() - clicked) }
  // Off the circle's spot, so the next circle does not open under the pointer as a hint.
  CGEvent(
    mouseEventSource: source, mouseType: .mouseMoved,
    mouseCursorPosition: CGPoint(x: max(dot.x - 160, 8), y: dot.y + 160), mouseButton: .left)!
    .post(tap: .cghidEventTap)
  out["outcome"] = outcome
  if let shown = card(owner: owner) { out["card"] = shown.json }
  // A late paste (after the card opened) still changes the field.
  pause(number("settle", 1200))
  let after = text(watch)
  out["after"] = after
  out["changed"] = after != before
  emit(out)

default:
  fail("usage: helper trusted|windows|app|wait-title|reload|frontmost|activate|web-accessibility|wait-element|read|focus|paste-text|clear-field|set-clipboard-image|check-clipboard|case")
}

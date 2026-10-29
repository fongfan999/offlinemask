// The privacy contract: landing/privacy.html makes concrete promises about what the app does with
// data. These tests read the app's real configuration and source and fail when one of those
// promises may no longer hold. When a test here fails on purpose (a new network call, permission,
// dependency or input hook), update landing/privacy.html and its "Cập nhật ngày …" line in the
// same change, then update the expectation below.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const UPDATE = "Update landing/privacy.html (and its date) to match, then this expectation.";

test("the app's web layer can only reach itself (privacy §4)", () => {
  const conf = JSON.parse(read("../src-tauri/tauri.conf.json"));
  const csp = conf.app.security.csp;
  const connect = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("connect-src"))
    .split(/\s+/)
    .slice(1);
  const local = [
    "'self'",
    "asset:",
    "http://asset.localhost",
    "https://asset.localhost",
    "ipc:",
    "http://ipc.localhost",
  ];
  assert.deepEqual(connect.toSorted(), local.toSorted(), UPDATE);
});

test("no updater, analytics or crash reporting is bundled (privacy §4)", () => {
  const forbidden =
    /updater|sentry|bugsnag|posthog|mixpanel|amplitude|segment|analytics|telemetry|crash/i;
  const cargo = read("../src-tauri/Cargo.toml");
  const pkg = JSON.parse(read("../package.json"));
  const names = [
    ...cargo.matchAll(/^([\w-]+)\s*=/gm),
    ...Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).map((n) => [null, n]),
  ].map((m) => m[1]);
  assert.deepEqual(
    names.filter((name) => forbidden.test(name)),
    [],
    UPDATE,
  );
});

test("only the pack downloader opens network connections (privacy §4)", () => {
  const dir = new URL("../src-tauri/src/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".rs"));
  const networked = files.filter((f) => /\breqwest\b/.test(read(`../src-tauri/src/${f}`)));
  assert.deepEqual(networked.toSorted(), ["model_pack.rs", "models.rs"], UPDATE);
});

test("the page names what the system web view connects to by itself (privacy §4)", () => {
  // Measured with a WebView2 net log of the idle app (decision 0138): its component
  // updater and the system's DNS, nothing of OfflineMask's.
  const page = read("../../landing/privacy.html");
  assert.match(page, /Microsoft Edge WebView2/, UPDATE);
  assert.match(page, /edge\.microsoft\.com/, UPDATE);
  // Switching WebView2's own traffic off would change that fact: update the page then.
  const conf = JSON.parse(read("../src-tauri/tauri.conf.json"));
  const args = conf.app.windows.map((window) => window.additionalBrowserArgs ?? "").join(" ");
  assert.doesNotMatch(args, /component-update|ComponentUpdater|DnsOverHttps/i, UPDATE);
});

test("pack files come only from the project's Cloudflare R2 store (privacy §4)", () => {
  const dir = new URL("../packs/", import.meta.url);
  const hosts = new Set();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    for (const [, url] of read(`../packs/${file}`).matchAll(/"url":\s*"([^"]+)"/g))
      hosts.add(new URL(url).host);
  }
  assert.deepEqual([...hosts], ["pub-5b0280497d774b8f99417b3438d8bce8.r2.dev"], UPDATE);
  assert.match(read("../../landing/privacy.html"), /Cloudflare R2/, UPDATE);
});

test("links from the app open only OfflineMask.com and its report page (privacy §4)", () => {
  const caps = JSON.parse(read("../src-tauri/capabilities/default.json"));
  const opener = caps.permissions.find((p) => p.identifier === "opener:allow-open-url");
  assert.deepEqual(
    opener.allow.map((a) => a.url),
    ["https://offlinemask.com/", "https://offlinemask.com/bao-loi#*"],
    UPDATE,
  );
  // A report rides in the fragment, which the browser never sends; the user presses Gửi
  // on the page (decision 0147).
  assert.match(read("../src/core/report.ts"), /return `\$\{reportPage\}#\$\{fields\}`;/, UPDATE);
  const page = read("../../landing/privacy.html");
  assert.match(page, /Bạn bấm Mở trang báo lỗi, rồi bấm Gửi trên trang đó/, UPDATE);
  assert.match(page, /OfflineMask chỉ dùng mạng trong bốn trường hợp/, UPDATE);
});

test("text in pictures is read by the system's own engine, on the machine, only once the page says so (privacy §2)", () => {
  // Decision 0171: scanned pages and images go to Apple's Vision framework through the
  // native `ocr` module, which neither downloads a model, writes a file nor opens a
  // connection; the picture is held for the call and only lines of text come back.
  // The feature is built but gated off until its measurement is clean; the page
  // describes it only while it is on.
  const ocr = read("../src-tauri/src/ocr.rs");
  assert.match(ocr, /objc2_vision::\{[\s\S]*VNRecognizeTextRequest/, UPDATE);
  assert.doesNotMatch(ocr, /reqwest|std::fs|File::|Command::/, UPDATE);
  assert.equal(JSON.parse(read("../package.json")).dependencies["tesseract.js"], undefined, UPDATE);
  const shipped = /export const ocrShipped = (true|false);/.exec(read("../src/adapters/ocr.ts"));
  assert.ok(shipped, UPDATE);
  // Prettier wraps the page's prose; the sentences are matched with their spaces squeezed.
  const page = read("../../landing/privacy.html").replace(/\s+/g, " ");
  if (shipped[1] === "true") {
    assert.match(page, /bộ nhận dạng ký tự có sẵn của hệ điều hành \(Vision của Apple/, UPDATE);
    assert.match(page, /ảnh không được lưu lại và không có trong bản đã ẩn/, UPDATE);
  } else assert.doesNotMatch(page, /nhận dạng ký tự|Vision/, UPDATE);
  // On Windows the system's engine is Windows.Media.Ocr, offered by the app only once
  // `WINDOWS_SHIPPED` is on; until then the page says Windows has none.
  assert.match(ocr, /use windows::Media::Ocr::OcrEngine;/, UPDATE);
  const windows = /pub const WINDOWS_SHIPPED: bool = (true|false);/.exec(ocr);
  assert.ok(windows, UPDATE);
  if (windows[1] === "true" && shipped[1] === "true") {
    assert.match(page, /Windows\.Media\.Ocr/, UPDATE);
    assert.doesNotMatch(page, /Trên Windows, phần này chưa có/, UPDATE);
  } else assert.doesNotMatch(page, /Windows\.Media\.Ocr/, UPDATE);
});

test("where the system cannot read Vietnamese, models carried in the app do, only once the page says so (privacy §2)", () => {
  // Decision 0172: two ONNX graphs built into the app (`public/reading/`, copied at build
  // time by scripts/prepare-reading.mjs) are read by a worker from the app itself; the
  // picture never leaves the worker and nothing is written. Gated off until the owner
  // opens it; the page describes it only while it is on.
  const worker = read("../src/workers/reading.worker.ts");
  const fetches = [...worker.matchAll(/fetch\(([^)]*)\)/g)].map((match) => match[1]);
  assert.deepEqual(fetches, ["`/reading/${file.name}`"], UPDATE);
  assert.doesNotMatch(worker, /indexedDB|localStorage|caches\.|invoke\(/, UPDATE);
  const adapter = read("../src/adapters/ocr.ts");
  assert.deepEqual(
    [...adapter.matchAll(/fetch\(([^)]*)\)/g)].map((match) => match[1]),
    ['"/reading/reading-v1.json"'],
    UPDATE,
  );
  const shipped = /export const ocrShipped = (true|false);/.exec(adapter);
  const reading = /export const readingShipped = (true|false);/.exec(adapter);
  assert.ok(shipped && reading, UPDATE);
  const page = read("../../landing/privacy.html").replace(/\s+/g, " ");
  if (shipped[1] === "true" && reading[1] === "true") {
    assert.match(page, /mô hình đọc chữ đi kèm ứng dụng/, UPDATE);
    assert.doesNotMatch(page, /Trên Windows, phần này chưa có/, UPDATE);
  } else assert.doesNotMatch(page, /mô hình đọc chữ đi kèm ứng dụng/, UPDATE);
});

test("the app's system permissions are the ones the page explains (privacy §5)", () => {
  const ids = (name) =>
    JSON.parse(read(`../src-tauri/capabilities/${name}.json`))
      .permissions.map((p) => (typeof p === "string" ? p : p.identifier))
      .filter((id) => !id.startsWith("core:"))
      .toSorted();
  assert.deepEqual(
    ids("default"),
    [
      "clipboard-manager:allow-read-text",
      "clipboard-manager:allow-write-text",
      "dialog:allow-save",
      "fs:allow-write-file",
      "global-shortcut:allow-is-registered",
      "global-shortcut:allow-register",
      "global-shortcut:allow-unregister",
      "opener:allow-open-url",
    ],
    UPDATE,
  );
  assert.deepEqual(ids("pill"), [], UPDATE);
});

test("selection watching observes mouse buttons only, never keys (privacy §5)", () => {
  const mac = read("../src-tauri/src/selection_macos.rs");
  const win = read("../src-tauri/src/selection_windows.rs");
  const all = readdirSync(new URL("../src-tauri/src/", import.meta.url))
    .filter((f) => f.endsWith(".rs"))
    .map((f) => read(`../src-tauri/src/${f}`))
    .join("\n");
  assert.doesNotMatch(all, /WH_KEYBOARD_LL|NSEventMask::KeyDown|NSEventMask::KeyUp/, UPDATE);
  assert.match(mac, /NSEventMask::LeftMouseDown \| NSEventMask::LeftMouseUp/, UPDATE);
  assert.match(win, /WH_MOUSE_LL/, UPDATE);
});

test("the circle reads only in AI places, by app and page host (privacy §5)", () => {
  const mac = read("../src-tauri/src/selection_macos.rs");
  const win = read("../src-tauri/src/selection_windows.rs");
  const page = read("../../landing/privacy.html");
  // The circle's path asks nothing of an application off the list (decision 0135).
  for (const backend of [mac, win]) {
    assert.match(backend, /if gate && !.*may_look\(/, UPDATE);
    assert.match(backend, /if gate && !spot\.listed/, UPDATE);
  }
  // A browser's page address is read, and only its host is compared.
  assert.match(mac, /"AXURL"/, UPDATE);
  assert.match(win, /UIA_DocumentControlTypeId/, UPDATE);
  assert.match(page, /chỉ dùng tên miền để so với danh sách, và không lưu lại/, UPDATE);
  assert.match(page, /Nút chỉ hiện ở nơi có AI/, UPDATE);
});

test("history deletes itself after the periods the page names (privacy §3)", () => {
  // Decision 0143: no keep-forever choice. Changing the choices or the default changes the page.
  const core = read("../src/core/sessions.ts");
  assert.match(core, /keepDayChoices = \[1, 7, 30, 90\] as const/, UPDATE);
  assert.match(core, /defaultKeepDays: KeepDays = 30;/, UPDATE);
  assert.match(
    read("../../landing/privacy.html"),
    /Tự xóa sau 30 ngày \(bạn chọn 1, 7, 30 hoặc 90 ngày trong Cài đặt\)/,
    UPDATE,
  );
});

test("the privacy page carries an update date", () => {
  assert.match(read("../../landing/privacy.html"), /Cập nhật ngày \d{1,2} tháng \d{1,2} năm \d{4}/);
});

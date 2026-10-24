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

test("links from the app open only OfflineMask.com (privacy §4)", () => {
  const caps = JSON.parse(read("../src-tauri/capabilities/default.json"));
  const opener = caps.permissions.find((p) => p.identifier === "opener:allow-open-url");
  assert.deepEqual(
    opener.allow.map((a) => a.url),
    ["https://offlinemask.com/"],
    UPDATE,
  );
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

test("the privacy page carries an update date", () => {
  assert.match(read("../../landing/privacy.html"), /Cập nhật ngày \d{1,2} tháng \d{1,2} năm \d{4}/);
});

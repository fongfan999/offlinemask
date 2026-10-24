import test from "node:test";
import assert from "node:assert/strict";
import {
  addPlace,
  browsers,
  defaultPlaces,
  detectPlatform,
  effectivePlaces,
  nativePlaces,
  noChanges,
  parseChanges,
  removePlace,
} from "../src/core/places.ts";

test("each platform has its own AI apps and browsers, and the same AI sites (decision 0135)", () => {
  for (const platform of ["macos", "windows"]) {
    const ids = defaultPlaces(platform).map((place) => `${place.kind}:${place.id}`);
    assert.ok(ids.includes("host:chatgpt.com"), platform);
    assert.ok(ids.includes("host:gemini.google.com"), platform);
    assert.equal(new Set(ids).size, ids.length, platform);
    // Not AI places: everyday chat and office applications.
    assert.ok(!ids.some((id) => /zalo|word|excel|outlook|mail/i.test(id)), platform);
    assert.ok(!browsers(platform).some((id) => /firefox/i.test(id)), platform);
  }
  const mac = defaultPlaces("macos");
  assert.ok(mac.some((place) => place.id === "com.anthropic.claudefordesktop"));
  assert.deepEqual(mac.find((place) => place.name === "ChatGPT" && place.kind === "app").ids, [
    "com.openai.chat",
    "com.openai.codex",
  ]);
  assert.ok(browsers("macos").includes("company.thebrowser.dia"));
  const win = defaultPlaces("windows");
  assert.ok(win.some((place) => place.id === "claude.exe"));
  // Executable names are lowercase: the native side lowercases what it reads.
  for (const place of win.filter((place) => place.kind === "app"))
    for (const id of place.ids) assert.equal(id, id.toLowerCase());
  for (const id of browsers("windows")) assert.equal(id, id.toLowerCase());
  assert.ok(browsers("windows").includes("msedge.exe"));
  // Elsewhere only the sites remain, and no browser is read.
  assert.ok(defaultPlaces("other").every((place) => place.kind === "host"));
  assert.deepEqual(browsers("other"), []);
  // Hosts are bare host names: the native side matches them with their subdomains.
  for (const place of mac.filter((place) => place.kind === "host"))
    assert.match(place.id, /^[a-z0-9.-]+$/);
});

test("the platform comes from the user agent", () => {
  assert.equal(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"), "macos");
  assert.equal(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "windows");
  assert.equal(detectPlatform("Mozilla/5.0 (X11; Linux x86_64)"), "other");
});

test("added and removed places are kept apart, so new defaults still arrive", () => {
  const zalo = { kind: "app", id: "com.vng.zalo", name: "Zalo" };
  let changes = addPlace(noChanges, zalo, "macos");
  assert.deepEqual(changes, { added: [zalo], removed: [] });
  // Adding twice, or adding a default, changes nothing.
  assert.deepEqual(addPlace(changes, zalo, "macos"), changes);
  assert.deepEqual(addPlace(changes, defaultPlaces("macos")[0], "macos"), changes);

  changes = removePlace(changes, { kind: "host", id: "chatgpt.com" }, "macos");
  assert.deepEqual(changes.removed, ["host:chatgpt.com"]);
  const places = effectivePlaces(changes, "macos");
  assert.ok(!places.some((place) => place.id === "chatgpt.com"));
  assert.ok(places.some((place) => place.id === "com.vng.zalo"));
  assert.ok(places.some((place) => place.id === "claude.ai"));

  // Removing an added place forgets it; adding back a removed default restores it.
  changes = removePlace(changes, zalo, "macos");
  assert.deepEqual(changes.added, []);
  changes = addPlace(changes, { kind: "host", id: "chatgpt.com", name: "ChatGPT" }, "macos");
  assert.deepEqual(changes, noChanges);
});

test("a default app is removed by any of its identifiers, as the circle reports it", () => {
  // The ChatGPT app on this Mac reports com.openai.codex, its second identifier.
  const changes = removePlace(noChanges, { kind: "app", id: "com.openai.codex" }, "macos");
  assert.deepEqual(changes.removed, ["app:com.openai.chat"]);
  const apps = nativePlaces(effectivePlaces(changes, "macos"), "macos").apps;
  assert.ok(!apps.includes("com.openai.chat") && !apps.includes("com.openai.codex"));
  // Adding it back through the same identifier restores the default.
  assert.deepEqual(
    addPlace(changes, { kind: "app", id: "com.openai.codex", name: "ChatGPT" }, "macos"),
    noChanges,
  );
});

test("stored changes are read defensively", () => {
  assert.deepEqual(parseChanges(null), noChanges);
  assert.deepEqual(parseChanges("not json"), noChanges);
  assert.deepEqual(
    parseChanges(
      JSON.stringify({
        added: [{ kind: "app", id: "a", name: "A" }, { kind: "file", id: "b", name: "B" }, null],
        removed: ["host:x", 3],
      }),
    ),
    { added: [{ kind: "app", id: "a", name: "A" }], removed: ["host:x"] },
  );
});

test("the native side gets every application identifier, the browsers and the hosts", () => {
  const native = nativePlaces(defaultPlaces("macos"), "macos");
  assert.ok(native.apps.includes("com.openai.chat") && native.apps.includes("com.openai.codex"));
  assert.ok(native.hosts.includes("claude.ai"));
  assert.deepEqual(native.browsers, browsers("macos"));
  assert.ok(nativePlaces(defaultPlaces("windows"), "windows").apps.includes("chatgpt.exe"));
});

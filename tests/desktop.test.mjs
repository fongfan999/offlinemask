import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";
import { openProductWebsite, productWebsite } from "../src/adapters/desktop.ts";

afterEach(() => {
  if (globalThis.window) clearMocks();
  delete globalThis.window;
  delete globalThis.isTauri;
});

test("website links keep standard browser navigation in the web preview", async () => {
  const event = new Event("click", { cancelable: true });
  await openProductWebsite(event);
  assert.equal(event.defaultPrevented, false);
});

test("native website clicks prevent webview navigation and open only the homepage once", async () => {
  globalThis.window = {};
  globalThis.isTauri = true;
  const calls = [];
  mockIPC((command, args) => calls.push({ command, args }));
  const event = new Event("click", { cancelable: true });
  const opening = openProductWebsite(event);
  assert.equal(event.defaultPrevented, true);
  await opening;
  assert.equal(productWebsite, "https://offlinemask.com/");
  assert.deepEqual(calls, [{
    command: "plugin:opener|open_url",
    args: { url: productWebsite, with: undefined },
  }]);
});

test("native opener failure reaches the UI without navigating away from the app", async () => {
  globalThis.window = {};
  globalThis.isTauri = true;
  mockIPC(() => { throw new Error("Browser unavailable"); });
  const event = new Event("click", { cancelable: true });
  await assert.rejects(openProductWebsite(event), /Browser unavailable/);
  assert.equal(event.defaultPrevented, true);
});

// Installing a newer version over an older one keeps the passcode vault, history, settings and
// the recognition pack, as offlinemask.com and its install guide promise (decision 0139). The
// operating systems key that data to the identities checked here; changing one would start every
// updating user from scratch. Change them only together with a migration and those pages.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

test("the app identifier names the data folders on every platform", () => {
  // app_local_data_dir() (vault, models) and the web view's storage (settings, theme) are
  // both folders named after it: Application Support, %LOCALAPPDATA%, ~/.local/share.
  assert.equal(read("../src-tauri/tauri.conf.json").identifier, "dev.offlinemask.desktop");
});

test("the web view keeps the origin its localStorage belongs to", () => {
  // useHttpsScheme moves Windows from http://tauri.localhost to https://, a new origin with
  // empty storage.
  for (const window of read("../src-tauri/tauri.conf.json").app.windows) {
    assert.notEqual(window.useHttpsScheme, true);
  }
});

test("Store updates install into the same package, keeping its LocalCache", () => {
  // Windows keeps a package's data across updates only while Name and Publisher stay the same.
  const { identityName, publisher } = read("../store/microsoft-store.json");
  assert.equal(identityName, "WotDaFong.OfflineMask");
  assert.equal(publisher, "CN=1AE90961-8E70-4358-8DAA-9714DE006FEA");
});

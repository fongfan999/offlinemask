import test from "node:test";
import assert from "node:assert/strict";
import { useVault, vaultMessages } from "../src/composables/useVault.ts";
import { createTextSession, encodePrivateSessions } from "../src/core/sessions.ts";

/** In-memory stand-in for the native vault with the same error codes. */
function fakeAdapter(initial = null) {
  const store = { file: initial, key: null, saves: [] };
  const adapter = {
    status: async () => (store.key ? "unlocked" : store.file ? "locked" : "none"),
    async create(passcode, data) {
      if (store.file) throw "exists";
      if (!/^\d{6}$/.test(passcode)) throw "passcode-invalid";
      store.file = { passcode, data };
      store.key = passcode;
    },
    async unlock(passcode) {
      if (!store.file) throw "missing";
      if (store.file.passcode !== passcode) throw "wrong-passcode";
      store.key = passcode;
      return store.file.data;
    },
    async save(data) {
      if (!store.key) throw "locked";
      store.saves.push(data);
      store.file.data = data;
    },
    async changePasscode(current, next) {
      if (store.file.passcode !== current) throw "wrong-passcode";
      if (!/^\d{6}$/.test(next)) throw "passcode-invalid";
      store.file.passcode = next;
    },
    async reset() {
      store.file = null;
      store.key = null;
    },
  };
  return { adapter, store };
}
const session = createTextSession(
  "Gọi 0901234567.",
  [],
  [{ start: 4, end: 14, type: "SDT", label: "Số điện thoại", priority: 1 }],
);

test("vault: before the passcode exists, saves are no-ops", async () => {
  const { adapter, store } = fakeAdapter();
  const vault = useVault(adapter);
  await vault.start();
  assert.equal(vault.state.value, "none");
  assert.equal(vault.checked.value, true);
  await vault.save([session]);
  assert.deepEqual(store.saves, []);
});

test("vault: create unlocks, saves coalesce, and the stored copy decodes", async () => {
  const { adapter, store } = fakeAdapter();
  const vault = useVault(adapter);
  await vault.start();
  assert.equal(await vault.create("12345", [session]), false);
  assert.equal(vault.error.value, vaultMessages["passcode-invalid"]);
  assert.equal(await vault.create("123456", [session]), true);
  assert.equal(vault.state.value, "unlocked");
  assert.equal(store.file.data, encodePrivateSessions([session]));
  void vault.save([session]);
  void vault.save([]);
  await vault.save([session]);
  assert.ok(store.saves.length <= 2, "a save requested during a save runs once after it");
  assert.equal(store.file.data, encodePrivateSessions([session]));
});

test("vault: wrong passcode is reported, the right one returns sessions, reset empties everything", async () => {
  const { adapter, store } = fakeAdapter({
    passcode: "246810",
    data: encodePrivateSessions([session]),
  });
  const vault = useVault(adapter);
  await vault.start();
  assert.equal(vault.state.value, "locked");
  assert.equal(await vault.unlock("000000"), null);
  assert.equal(vault.error.value, vaultMessages["wrong-passcode"]);
  assert.equal(vault.state.value, "locked");
  const sessions = await vault.unlock("246810");
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, session.id);
  assert.equal(vault.state.value, "unlocked");
  assert.equal(await vault.changePasscode("999999", "135790"), false);
  assert.equal(await vault.changePasscode("246810", "135790"), true);
  assert.equal(store.file.passcode, "135790");
  assert.equal(await vault.reset(), true);
  assert.equal(vault.state.value, "none");
  assert.equal(store.file, null);
});

test("vault: a file that decodes to garbage counts as corrupt and stays closed", async () => {
  const { adapter } = fakeAdapter({ passcode: "246810", data: '{"version":9}' });
  const vault = useVault(adapter);
  await vault.start();
  assert.equal(await vault.unlock("246810"), null);
  assert.equal(vault.error.value, vaultMessages.corrupt);
  assert.equal(vault.state.value, "locked");
});

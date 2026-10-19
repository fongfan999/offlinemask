import test from "node:test";
import assert from "node:assert/strict";
import {
  createSession,
  decodeSessions,
  encodeSessions,
  sessionOutput,
} from "../src/core/sessions.ts";

test("each conversion creates an independent session, round trips and preserves choices", () => {
  const first = createSession("text", []);
  first.decisions.account = "keep";
  const second = createSession("text", [first]);
  assert.notEqual(first.id, second.id);
  assert.equal(second.number, 2);
  const restored = decodeSessions(encodeSessions([second, first]));
  assert.deepEqual(restored, [second, first]);
  assert.ok(sessionOutput(restored[1]).includes("001234567890"));
  assert.ok(sessionOutput(restored[0]).includes("[STK_DEMO_01]"));
});
test("saved history excludes arbitrary source content and unknown decisions", () => {
  const session = createSession("text", []);
  session.source = "PRIVATE CONTENT";
  session.decisions.private = "PRIVATE CONTENT";
  const encoded = encodeSessions([session]);
  assert.ok(!encoded.includes("PRIVATE CONTENT"));
  assert.ok(!encoded.includes("Nguyễn Minh Anh"));
  assert.deepEqual(decodeSessions(null), []);
});
test("corrupt, duplicate, unsupported and incomplete history is rejected", () => {
  assert.throws(() => decodeSessions("{"));
  assert.throws(() => decodeSessions('{"version":2,"sessions":[]}'));
  const session = createSession("text", []);
  assert.throws(() => decodeSessions(encodeSessions([session, session])));
  session.decisions.account = "pending";
  assert.throws(() => decodeSessions(encodeSessions([session])));
});
test("spreadsheet samples saved by earlier builds are dropped on load", () => {
  const text = createSession("text", []);
  const raw = JSON.parse(encodeSessions([text]));
  raw.sessions.push({ ...raw.sessions[0], id: crypto.randomUUID(), format: "excel", number: 2 });
  assert.deepEqual(decodeSessions(JSON.stringify(raw)), [text]);
});

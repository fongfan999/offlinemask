import test from "node:test";
import assert from "node:assert/strict";
import {
  createSession,
  decodeSessions,
  encodeSessions,
  sessionOutput,
  maskedRows,
} from "../src/core/sessions.ts";

test("each conversion creates an independent session, round trips and preserves choices", () => {
  const first = createSession("text", []);
  first.decisions.account = "keep";
  const second = createSession("excel", [first]);
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
test("table masking preserves shape, exact amounts and repeated aliases", () => {
  const session = createSession("excel", []);
  const rows = maskedRows(session.decisions);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.length === 6));
  assert.equal(rows[0][0], rows[1][0]);
  assert.equal(rows[0][5], "2500000");
  assert.equal(rows[1][5], "1500000");
  assert.equal(sessionOutput(session).split("\n").length, 3);
  session.decisions.account = "keep";
  assert.equal(maskedRows(session.decisions)[0][1], "001234567890");
});

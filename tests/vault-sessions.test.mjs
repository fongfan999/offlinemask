import test from "node:test";
import assert from "node:assert/strict";
import {
  createTextSession,
  decodePrivateSessions,
  encodePrivateSessions,
  sessionOutput,
} from "../src/core/sessions.ts";
import { addManualMask, previewSelection } from "../src/core/manual-mask.ts";

const text = "Tôi là Nguyễn Minh Anh, gọi 0901234567 nhé.";
const detection = { start: 28, end: 38, type: "SDT", label: "Số điện thoại", priority: 1 };

test("private sessions round trip through the vault encoding with choices and manual masks", () => {
  const session = createTextSession(text, [], [detection], ["phone"]);
  session.decisions[session.analysis.findings[0].id] = "keep";
  const range = previewSelection(
    session.original,
    session.analysis,
    session.decisions,
    true,
    7,
    22,
  );
  Object.assign(
    session,
    addManualMask(
      session.original,
      session.analysis,
      session.decisions,
      session.id.slice(0, 4),
      range,
    ),
  );
  session.reviewUndo = { analysis: session.analysis, decisions: {} };
  const [restored] = decodePrivateSessions(encodePrivateSessions([session]));
  assert.equal(restored.id, session.id);
  assert.equal(restored.original, text);
  assert.deepEqual(restored.options, ["phone"]);
  assert.equal(restored.manualMaskCount, 1);
  assert.equal(restored.reviewUndo, undefined);
  assert.equal(sessionOutput(restored), sessionOutput(session));
  assert.equal(encodePrivateSessions([]), JSON.stringify({ version: 1, sessions: [] }));
});

test("sample sessions are left out and damaged records reject the whole vault", () => {
  const session = createTextSession(text, [], [detection]);
  const sample = {
    id: crypto.randomUUID(),
    number: 2,
    format: "excel",
    fixture: "sample-v1",
    createdAt: new Date().toISOString(),
    decisions: {},
  };
  assert.equal(JSON.parse(encodePrivateSessions([sample, session])).sessions.length, 1);
  const good = JSON.parse(encodePrivateSessions([session]));
  const broken = (mutate) => {
    const copy = structuredClone(good);
    mutate(copy.sessions[0]);
    assert.throws(() => decodePrivateSessions(JSON.stringify(copy)));
  };
  broken((s) => (s.original = 42));
  broken((s) => (s.options = ["everything"]));
  broken((s) => (s.analysis.spans[0].end = 10_000));
  broken((s) => (s.analysis.findings[0].alias = "not an alias"));
  broken((s) => (s.decisions = {}));
  broken((s) => (s.fixture = "sample-v1"));
  assert.throws(() => decodePrivateSessions(JSON.stringify({ version: 2, sessions: [] })));
  assert.throws(() => decodePrivateSessions("not json"));
});

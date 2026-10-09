import test from "node:test";
import assert from "node:assert/strict";
import { addManualMask, previewSelection } from "../src/core/manual-mask.ts";
import { createTextSession, encodeSessions, sessionOutput } from "../src/core/sessions.ts";

function session(text, value) {
  const start = text.indexOf(value);
  return createTextSession(
    text,
    [],
    value
      ? [
          {
            start,
            end: start + value.length,
            type: "TEN",
            label: "Họ và tên",
            priority: 50,
            source: "Synthetic",
            reason: "Test",
          },
        ]
      : [],
  );
}
function hide(s, start, end, masked = true) {
  const range = previewSelection(s.original, s.analysis, s.decisions, masked, start, end);
  assert.ok(range);
  Object.assign(
    s,
    addManualMask(s.original, s.analysis, s.decisions, s.id.slice(0, 8), range, s.manualMaskCount),
  );
}

test("manual selection maps past aliases and textarea CRLF normalization without changing other occurrences", () => {
  const s = session("An\r\nMã riêng: XY-99.\rXY-99 😀", "An");
  const before = sessionOutput(s).replace(/\r\n?/g, "\n");
  const at = before.indexOf("XY-99");
  hide(s, at, at + 5);
  const output = sessionOutput(s);
  assert.ok(output.endsWith("\rXY-99 😀"));
  assert.ok(output.includes("\r\nMã riêng: [AN_THEM_"));
  assert.equal(s.original, "An\r\nMã riêng: XY-99.\rXY-99 😀");
});

test("selection across a partial alias expands that occurrence without changing repeated aliases", () => {
  const s = session("Nguyễn Minh Anh; Nguyễn Minh Anh", "Minh Anh");
  const old = s.analysis.findings[0].alias;
  const output = sessionOutput(s);
  hide(s, 0, output.indexOf(old) + 4);
  assert.ok(sessionOutput(s).startsWith("[AN_THEM_"));
  assert.ok(sessionOutput(s).endsWith(`Nguyễn ${old}`));
  assert.equal(
    s.analysis.findings.find((f) => f.id.startsWith("AN_THEM")).value,
    "Nguyễn Minh Anh",
  );
  s.decisions = Object.fromEntries(s.analysis.findings.map((f) => [f.id, "keep"]));
  assert.equal(sessionOutput(s), s.original);
});

test("original-view correction preserves unrelated keep choices and aliases", () => {
  const s = session("An ở 47 Phố Mới.", "An");
  s.decisions[s.analysis.findings[0].id] = "keep";
  hide(s, 5, 15, false);
  assert.ok(sessionOutput(s).startsWith("An ở [AN_THEM_"));
  assert.equal(s.analysis.findings[1].value, "47 Phố Mới");
});

test("emoji and decomposed accent selections expand to complete graphemes", () => {
  for (const value of ["👨‍👩‍👧‍👦", "e\u0302\u0303", "😀"]) {
    const s = session(`A ${value} Z`);
    hide(s, 2, 3);
    assert.equal(s.analysis.findings[0].value, value);
    assert.equal(sessionOutput(s), `A ${s.analysis.findings[0].alias} Z`);
  }
});

test("empty, whitespace, malformed or already hidden selections do not create findings", () => {
  const s = session("An   Bình", "An");
  const alias = s.analysis.findings[0].alias;
  for (const [start, end] of [
    [0, 0],
    [-1, 2],
    [0, 999],
    [0.5, 2],
    [2, 4],
    [alias.length, alias.length + 3],
  ])
    assert.equal(previewSelection(s.original, s.analysis, s.decisions, true, start, end), null);
  assert.throws(() =>
    addManualMask(s.original, s.analysis, s.decisions, s.id.slice(0, 8), { start: 0, end: 1 }),
  );
});

test("manual findings and undo snapshots stay out of sample storage", () => {
  const s = session("Riêng: SECRET-42");
  s.reviewUndo = { analysis: s.analysis, decisions: s.decisions };
  hide(s, 7, 16);
  assert.deepEqual(JSON.parse(encodeSessions([s])).sessions, []);
  Object.assign(s, s.reviewUndo);
  assert.equal(sessionOutput(s), s.original);
});

test("undo and replacement never reuse a manual alias for different text", () => {
  const s = session("Alpha Beta Gamma");
  const before = { analysis: s.analysis, decisions: s.decisions };
  hide(s, 0, 5);
  const first = s.analysis.findings[0].alias;
  Object.assign(s, before); // Undo must not rewind the session's alias counter.
  hide(s, 6, 10);
  assert.notEqual(s.analysis.findings[0].alias, first);
  const second = s.analysis.findings[0].alias;
  hide(s, 0, sessionOutput(s).length);
  assert.notEqual(s.analysis.findings[0].alias, first);
  assert.notEqual(s.analysis.findings[0].alias, second);
});

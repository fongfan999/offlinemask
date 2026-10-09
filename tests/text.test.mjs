import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeText,
  maskedText,
  maxTextLength,
  textParts,
  validateText,
} from "../src/core/text.ts";
import {
  createSession,
  createTextSession,
  decodeSessions,
  encodeSessions,
  sessionOutput,
  sessionTitle,
} from "../src/core/sessions.ts";
import { detectBankingIdentifiers } from "../src/core/detection/banking.ts";
import { modelChunks } from "../src/core/detection/chunks.ts";
import { mergeModelDetections, modelDetections } from "../src/core/detection/model-policy.ts";

const scope = "01234567";
// Explicit provider fixtures test the transformation contract, not model accuracy.
function finding(text, value, type = "TEN", priority = 50) {
  const start = text.indexOf(value);
  return {
    start,
    end: start + value.length,
    type,
    label: type,
    priority,
    source: "Test provider",
    reason: "Synthetic fixture",
  };
}

test("provider spans produce consistent aliases and preserve every other character", () => {
  const original =
    "Trần Minh Bình\r\nSTK: 009988776655.\nNgày 09/09/2026: 2.500.000 đồng.\nTrần Minh Bình";
  const session = createTextSession(
    original,
    [],
    [finding(original, "Trần Minh Bình"), ...detectBankingIdentifiers(original)],
  );
  const result = sessionOutput(session);
  const name = session.analysis.findings[0];
  assert.equal(result.split(name.alias).length - 1, 2);
  assert.ok(result.includes("Ngày 09/09/2026: 2.500.000 đồng."));
  assert.ok(result.includes("\r\n"));
  assert.equal(session.original, original);
  assert.equal(
    textParts(original, session.analysis.spans)
      .map((part) => part.text)
      .join(""),
    original,
  );
  session.decisions = Object.fromEntries(session.analysis.findings.map(({ id }) => [id, "keep"]));
  assert.equal(sessionOutput(session), original);
});

test("explicit banking context wins over overlapping model guesses", () => {
  const original =
    "STK: 0901234567; CCCD: 091234567890. Mã khách hàng: KH001. Mã giao dịch: TX-123.";
  const session = createTextSession(
    original,
    [],
    [finding(original, "0901234567", "SDT"), ...detectBankingIdentifiers(original)],
  );
  assert.deepEqual(
    session.analysis.findings.map((f) => f.label),
    ["Số tài khoản", "Số giấy tờ tùy thân", "Mã khách hàng", "Mã giao dịch"],
  );
  const spans = session.analysis.spans;
  assert.ok(spans.every((span, index) => !index || spans[index - 1].end <= span.start));
});

test("repeated matches respect identifier boundaries and distinct overlapping values", () => {
  const original = "Mã khách hàng: ABC123. Mã khách hàng: ABC1234. ABC123 ABC1234 XABC123 ABC123X";
  const session = createTextSession(original, [], detectBankingIdentifiers(original));
  const [short, long] = session.analysis.findings;
  const output = sessionOutput(session);
  assert.equal(output.split(short.alias).length - 1, 2);
  assert.equal(output.split(long.alias).length - 1, 2);
  assert.ok(output.endsWith("XABC123 ABC123X"));
  assert.notEqual(short.alias, long.alias);
});

test("no provider findings preserve text, including markup and supplementary Unicode", () => {
  const original =
    "😀 Ngày 09/09/2026: 001234567890 và 2.500.000 đồng. <script>alert('test')</script>";
  assert.equal(sessionOutput(createTextSession(original, [], [])), original);
  assert.equal(detectBankingIdentifiers(original).length, 0);
});

test("aliases are session scoped and skip existing source tokens", () => {
  const original = `test@example.org [EMAIL_1_${scope}]`;
  const detections = [finding(original, "test@example.org", "EMAIL")];
  assert.equal(analyzeText(original, scope, detections).findings[0].alias, `[EMAIL_2_${scope}]`);
  const first = createTextSession(original, [], detections);
  const second = createTextSession(original, [first], detections);
  assert.notEqual(first.analysis.findings[0].alias, second.analysis.findings[0].alias);
  first.decisions[first.analysis.findings[0].id] = "keep";
  assert.equal(sessionOutput(first), original);
  assert.notEqual(sessionOutput(second), original);
});

test("private sessions are excluded entirely from sample persistence", () => {
  const text = "synthetic@example.org";
  const privateSession = createTextSession(text, [], [finding(text, text, "EMAIL")]);
  const sample = createSession("excel", [privateSession]);
  const encoded = encodeSessions([privateSession, sample]);
  for (const value of [
    privateSession.id,
    text,
    privateSession.analysis.findings[0].alias,
    "private-text-v1",
  ])
    assert.ok(!encoded.includes(value));
  assert.deepEqual(decodeSessions(encoded), [sample]);
  assert.equal(sessionTitle(privateSession), "Văn bản #1");
});

test("session creation retries colliding namespaces", (context) => {
  const ids = [
    "12345678-0000-4000-8000-000000000001",
    "12345678-1111-4111-8111-111111111111",
    "87654321-0000-4000-8000-000000000002",
  ];
  context.mock.method(crypto, "randomUUID", () => ids.shift());
  const first = createTextSession("Synthetic", [], []);
  const second = createTextSession("Synthetic", [first], []);
  assert.ok(second.id.startsWith("87654321"));
});

test("invalid input and malformed provider offsets fail closed", () => {
  for (const text of ["", " \n\t ", "a".repeat(maxTextLength + 1)]) {
    assert.ok(validateText(text));
    assert.throws(() => createTextSession(text, [], []));
  }
  for (const [start, end] of [
    [-1, 2],
    [0, 999],
    [2, 1],
    [0.5, 2],
    [NaN, 2],
  ])
    assert.throws(() => analyzeText("abc", scope, [{ ...finding("abc", "a"), start, end }]));
  const exact = "a".repeat(maxTextLength);
  assert.equal(sessionOutput(createTextSession(exact, [], [])), exact);
});

test("unreviewed decisions cannot be copied", () => {
  const text = "test@example.org";
  const analysis = analyzeText(text, scope, [finding(text, text, "EMAIL")]);
  assert.throws(() => maskedText(text, analysis, {}));
});

test("model policy merges Vietnamese name parts and retains transaction facts", () => {
  const text = "Nguyễn Minh Anh, 09/09/2026, 2.500.000 đồng";
  const span = (word, canonical_label) => ({
    start: text.indexOf(word),
    end: text.indexOf(word) + word.length,
    canonical_label,
    score: 0.9,
  });
  const detections = modelDetections(text, [
    span("Nguyễn", "LAST_NAME"),
    span("Minh", "MIDDLE_NAME"),
    span("Anh", "FIRST_NAME"),
    span("09/09/2026", "DATE"),
    span("2.500.000", "AMOUNT"),
    span("đồng", "CURRENCY"),
  ]);
  assert.equal(detections.length, 1);
  assert.equal(text.slice(detections[0].start, detections[0].end), "Nguyễn Minh Anh");
});

test("bounded overlapping windows cover every input character, including emoji and the tail", () => {
  const text = "😀 Văn bản tổng hợp. ".repeat(200) + "Cuối tài liệu: Trần Minh Bình";
  const chunks = modelChunks(text, (value) => [...value].length * 2 + 2);
  assert.ok(chunks.length > 1);
  assert.equal(chunks[0].start, 0);
  let covered = 0;
  for (const chunk of chunks) {
    assert.ok([...chunk.text].length * 2 + 2 <= 384);
    assert.ok(chunk.start <= covered);
    assert.equal(chunk.text, text.slice(chunk.start, chunk.start + chunk.text.length));
    assert.ok(!/[\uDC00-\uDFFF]/.test(chunk.text[0]));
    covered = chunk.start + chunk.text.length;
  }
  assert.equal(covered, text.length);
  assert.ok(chunks.at(-1).text.endsWith("Trần Minh Bình"));
});

test("partial subwords and overlapping model windows cannot leave word tails exposed", () => {
  const text = "😀 Nguyễn Minh Anh";
  const spans = [
    { start: 3, end: 4, canonical_label: "LAST_NAME" },
    { start: 10, end: 14, canonical_label: "FIRST_NAME" },
    { start: 15, end: 16, canonical_label: "LAST_NAME" },
  ];
  const detections = modelDetections(text, spans);
  assert.deepEqual(
    detections.map((s) => text.slice(s.start, s.end)),
    ["Nguyễn Minh Anh"],
  );
  const merged = mergeModelDetections([
    { ...finding(text, "Nguyễn Minh") },
    { ...finding(text, "Minh Anh") },
  ]);
  assert.deepEqual(
    merged.map((s) => text.slice(s.start, s.end)),
    ["Nguyễn Minh Anh"],
  );
});

test("model windows never split a decomposed accent or joined emoji", () => {
  const text = "Nguyễn 👨‍👩‍👧‍👦 ".repeat(150);
  const boundaries = new Set(
    [...new Intl.Segmenter("vi", { granularity: "grapheme" }).segment(text)]
      .map((s) => s.index)
      .concat(text.length),
  );
  const chunks = modelChunks(text, (value) => value.length + 2);
  for (const chunk of chunks) {
    assert.ok(boundaries.has(chunk.start));
    assert.ok(boundaries.has(chunk.start + chunk.text.length));
    assert.ok(chunk.text.length + 2 <= 384);
  }
  assert.equal(chunks.at(-1).start + chunks.at(-1).text.length, text.length);
});

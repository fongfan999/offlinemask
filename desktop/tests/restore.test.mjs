import test from "node:test";
import assert from "node:assert/strict";
import { analyzeText } from "../src/core/text.ts";
import { addManualMask } from "../src/core/manual-mask.ts";
import { restoreAliases } from "../src/core/restore.ts";
import { createTextSession } from "../src/core/sessions.ts";
import { sessionPreview } from "../src/core/session-preview.ts";

const scope = "4aae";
const detection = (start, end, type) => ({
  start,
  end,
  type,
  label: type,
  source: "test",
  reason: "test",
  priority: 1,
});

test("exact session aliases restore in place and nothing else changes", () => {
  const text = "Liên hệ minh.anh@example.com hoặc 0901234567.";
  const analysis = analyzeText(text, scope, [detection(8, 28, "EMAIL"), detection(34, 44, "SDT")]);
  const reply = `Tóm tắt:\n- Email: [EMAIL_1_${scope}]\n- Gọi [SDT_1_${scope}] hai lần ([SDT_1_${scope}]).\n\n"Đã liên hệ [EMAIL_1_${scope}]"`;
  const result = restoreAliases(reply, analysis);
  assert.equal(result.restored, 4);
  assert.deepEqual(result.unknown, []);
  assert.equal(
    result.text,
    `Tóm tắt:\n- Email: minh.anh@example.com\n- Gọi 0901234567 hai lần (0901234567).\n\n"Đã liên hệ minh.anh@example.com"`,
  );
});

test("aliases from another session or a rewritten alias are reported, never guessed", () => {
  const text = "Khách 0901234567";
  const analysis = analyzeText(text, scope, [detection(6, 16, "SDT")]);
  const reply = `[SDT_1_${scope}] và [SDT_1_dead] và [SDT_2_${scope}] và [sdt_1_${scope}] và [SDT_1_${scope}`;
  const result = restoreAliases(reply, analysis);
  assert.equal(result.restored, 1);
  assert.deepEqual(result.unknown, ["[SDT_1_dead]", `[SDT_2_${scope}]`]);
  assert.equal(
    result.text,
    `0901234567 và [SDT_1_dead] và [SDT_2_${scope}] và [sdt_1_${scope}] và [SDT_1_${scope}`,
  );
});

test("manual corrections restore too, and a session without findings leaves text alone", () => {
  const text = "Tên: Nguyễn Văn A";
  const empty = analyzeText(text, scope, []);
  assert.deepEqual(restoreAliases("Không có gì [TEN_1_4aae]", empty), {
    text: "Không có gì [TEN_1_4aae]",
    restored: 0,
    unknown: ["[TEN_1_4aae]"],
    marks: [],
  });
  const manual = addManualMask(text, empty, {}, scope, { start: 5, end: 17 });
  const result = restoreAliases(`Người: [AN_THEM_1_${scope}].`, manual.analysis);
  assert.equal(result.text, "Người: Nguyễn Văn A.");
  assert.equal(result.restored, 1);
});

test("sidebar preview shows the first masked line, truncated by grapheme", () => {
  const text =
    "\n\n  Email minh.anh@example.com của khách hàng mới gửi hôm nay cần xử lý gấp nhé\nDòng 2";
  const session = createTextSession(text, [], [detection(10, 30, "EMAIL")]);
  const preview = sessionPreview(session);
  assert.ok(preview.startsWith("Email [EMAIL_1_"));
  assert.ok(!preview.includes("minh.anh"));
  assert.ok(preview.endsWith("..."));
  assert.ok([...preview].length <= 46);
  const short = createTextSession("Xin chào", [], []);
  assert.equal(sessionPreview(short), "Xin chào");
  const emoji = createTextSession("👩‍👩‍👧‍👦".repeat(50), [], []);
  assert.ok(sessionPreview(emoji).endsWith("👩‍👩‍👧‍👦..."));
});

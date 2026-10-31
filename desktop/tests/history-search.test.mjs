import test from "node:test";
import assert from "node:assert/strict";
import { createTextSession } from "../src/core/sessions.ts";
import { matchesSearch, searchKey, sessionDate } from "../src/core/session-preview.ts";

const detection = (start, end, type) => ({
  start,
  end,
  type,
  label: type,
  source: "test",
  reason: "test",
  priority: 1,
});

const doc = {
  id: "4aae0000-0000-4000-8000-000000000002",
  number: 4,
  format: "word",
  fixture: "private-doc-v1",
  createdAt: "2026-10-14T05:00:00.000Z",
  fileName: "Hợp đồng thuê nhà.docx",
  paragraphs: 1,
  preview: [],
  findings: [],
  masked: 0,
};

test("search ignores accents, case and word order", () => {
  assert.equal(searchKey("  Hợp   ĐỒNG "), "hop dong");
  assert.ok(matchesSearch(doc, "hop dong"));
  assert.ok(matchesSearch(doc, "NHÀ thuê"));
  assert.ok(matchesSearch(doc, "tài liệu #4"));
  assert.ok(matchesSearch(doc, sessionDate(doc).slice(-5)));
  assert.ok(matchesSearch(doc, "   "));
  assert.ok(!matchesSearch(doc, "hop dong mua"));
});

test("a text is found by its masked copy and by what it hid", () => {
  const text = "Gửi hoá đơn tháng 10 cho minh.anh@example.com";
  const session = createTextSession(text, [], [detection(25, 45, "EMAIL")]);
  assert.ok(matchesSearch(session, "hoa don thang 10"));
  assert.ok(matchesSearch(session, "EMAIL_1"));
  assert.ok(matchesSearch(session, "minh.anh"));
  assert.ok(matchesSearch(session, "example.com hoa don"));
  assert.ok(!matchesSearch(session, "khach.hang"));
});

test("made-up dev history survives the vault and is searchable", async () => {
  const { seedSessions, isSeeded } = await import("../src/dev/seed-history.ts");
  const { decodePrivateSessions, encodePrivateSessions, aliasScope } =
    await import("../src/core/sessions.ts");
  const seeded = seedSessions(80, []);
  assert.equal(seeded.length, 80);
  assert.ok(seeded.every(isSeeded));
  assert.equal(new Set(seeded.map((s) => aliasScope(s.id))).size, 80);
  const back = decodePrivateSessions(encodePrivateSessions(seeded));
  assert.equal(back.length, 80);
  assert.ok(back.some((s) => matchesSearch(s, "hop dong")));
  assert.ok(back.some((s) => matchesSearch(s, "hoa don thang 10")));
  // A hidden name finds its texts and its files, without accents too.
  const an = back.filter((s) => matchesSearch(s, "nguyen van an"));
  assert.ok(an.some((s) => s.format === "text"));
  assert.ok(an.some((s) => s.format === "word"));
  assert.ok(back.some((s) => s.format === "excel" && matchesSearch(s, "Trần Thị Bích")));
});

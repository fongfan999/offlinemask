import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRecord, auditCorpus } from "../scripts/detector-feasibility/corpus.mjs";
const capabilities = JSON.parse(
  readFileSync(
    new URL("../../docs/evaluations/detector-feasibility/capabilities.json", import.meta.url),
  ),
);
const seed = (id, split, annotated) => ({
  id,
  split,
  annotated,
  familyId: id,
  templateId: id,
  representation: "prose",
  provenance: {
    kind: "authored-synthetic",
    author: "author",
    createdAt: "2026-09-18",
    sourceId: "unit-only",
    realRecordsUsed: false,
  },
  review: { status: "author-reviewed", reviewer: "author" },
});

test("corpus annotations preserve emoji and decomposed-source offsets and card category", () => {
  const value = "Trần Ánh".normalize("NFD");
  const r = parseRecord(
    seed(
      "a",
      "development",
      `📎 Người nhận [[person|${value}]], thẻ [[card|4111 1111 1111 1111]].`,
    ),
    capabilities,
  );
  assert.equal(r.text.slice(r.entities[0].start, r.entities[0].end), value);
  assert.equal(r.entities[1].category, "other");
  assert.equal(r.entities[1].critical, true);
  assert.throws(
    () => parseRecord(seed("a", "development", "[[person|a]]\u0301"), capabilities),
    /grapheme/,
  );
});
test("corpus rejects malformed spans, unsupported types and unverified review provenance", () => {
  for (const text of ["[[person|A [[person|B]]]]", "[[missing|thing]]", "[[person| Name ]]"])
    assert.throws(() => parseRecord(seed("a", "train", text), capabilities));
  const r = seed("a", "train", "[[person|Hà Bảo]]");
  r.provenance.realRecordsUsed = true;
  assert.throws(() => parseRecord(r, capabilities), /Real records/);
  r.provenance.realRecordsUsed = false;
  r.review.status = "independently-reviewed";
  assert.throws(() => parseRecord(r, capabilities), /Author cannot/);
});
test("family and template relatives cannot cross training and final partitions", () => {
  for (const key of ["familyId", "templateId"]) {
    const a = seed("a", "train", "Người ký [[person|Hạ Thu]] đã gửi bản sao.");
    const b = seed("b", "final", "[[person|Đỗ Vân]] nhận phong bì.");
    b[key] = a[key];
    assert.throws(() => auditCorpus([a, b], capabilities), /Cross-split/);
  }
});
test("normalized text and entity-masked templates detect renamed or reformatted leakage", () => {
  const a = seed("a", "train", "Người nhận [[person|Ngọc Ánh]] có 27 chứng từ.");
  const b = seed("b", "final", "Nguoi nhan [[person|Vân Hải]] co 43 chung tu.");
  assert.throws(() => auditCorpus([a, b], capabilities), /skeleton leakage/);
  assert.throws(
    () => auditCorpus([a], capabilities, [{ text: "NGƯỜI NHẬN Ngọc Ánh có 98 chứng từ." }]),
    /Observed regression/,
  );
});
test("small authored seed is structurally valid without claiming training or final readiness", () => {
  const rows = JSON.parse(
    readFileSync(new URL("./fixtures/detector-feasibility/development-seed.json", import.meta.url)),
  );
  const report = auditCorpus(rows, capabilities);
  assert.equal(report.validStructure, true);
  assert.equal(report.pilotReady, false);
  assert.equal(report.finalValidationReady, false);
  assert.equal(report.composition.train.records, 0);
  assert.equal(report.composition.final.records, 0);
  assert.equal(report.composition.development.families, 28);
  assert.ok(report.blockers.length > 0);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { records } from "../scripts/detector-corpus-v1/records.mjs";
import {
  auditReadiness,
  recordDigest,
  reviewTemplate,
} from "../scripts/detector-corpus-v1/audit.mjs";
import { parseRecord } from "../scripts/detector-feasibility/corpus.mjs";
const capabilities = JSON.parse(
  readFileSync(
    new URL("../../docs/evaluations/detector-feasibility/capabilities.json", import.meta.url),
  ),
);
const row = (id, split, annotated) => ({
  id,
  familyId: id,
  templateId: id,
  scenarioId: id,
  split,
  annotated,
  representation: "unit",
  provenance: {
    kind: "authored-synthetic",
    author: "author",
    sourceId: "unit",
    createdAt: "2026-09-18",
    realRecordsUsed: false,
  },
  review: { status: "author-reviewed", reviewer: "author" },
});
const sample = () => [
  row("a", "train", "Kính gửi [[person|Trần Ánh]], xin nhận hồ sơ."),
  row("b", "development", "Người đứng tên là [[person|Lê Hạ]]."),
];
const approval = (entry) => ({
  ...entry,
  status: "approved",
  reviewer: { kind: "human", id: "unit-reviewer" },
  reviewedAt: "2026-09-18",
  checks: Object.fromEntries(Object.keys(entry.checks).map((key) => [key, true])),
  note: "Unit fixture only; not corpus review evidence.",
});

test("new corpus counts distinct families, retains all types in each split and keeps variants together", () => {
  const seed = JSON.parse(
    readFileSync(new URL("./fixtures/detector-feasibility/development-seed.json", import.meta.url)),
  );
  const report = auditReadiness([...seed, ...records], capabilities, []);
  assert.equal(records.length, 62);
  assert.equal(new Set(records.map((r) => r.familyId)).size, 60);
  assert.equal(report.composition.train.families, 30);
  assert.equal(report.composition.development.families, 58);
  for (const split of ["train", "development"]) {
    assert.ok(
      report.composition[split].negativeFamilies / report.composition[split].families >= 0.3,
    );
    assert.ok(Object.values(report.composition[split].typeFamilies).every((n) => n > 0));
  }
  assert.equal(report.independentReview.pending, 91);
  assert.equal(report.pilotReady, false);
  assert.equal(report.composition.final.records, 0);
  for (const r of records.filter((r) => r.representation === "nfd-emoji")) {
    const parsed = parseRecord(r, capabilities);
    assert.ok(parsed.text.startsWith("📎"));
    for (const entity of parsed.entities)
      assert.equal(parsed.text.slice(entity.start, entity.end), entity.value);
  }
});
test("inline independent review claims cannot bypass the separate ledger", () => {
  const rows = sample().map((r) => ({
    ...r,
    review: { status: "independently-reviewed", reviewer: "someone" },
  }));
  assert.equal(auditReadiness(rows, capabilities, []).independentReview.approved, 0);
});
test("record approval rejects changed annotations, provenance and capability schema", () => {
  const rows = sample(),
    ledger = reviewTemplate(rows, capabilities);
  ledger.records[0] = approval(ledger.records[0]);
  for (const change of [
    (r) => {
      r.annotated += " Доп.";
    },
    (r) => {
      r.provenance.sourceId = "changed";
    },
    (r) => {
      r.split = "development";
    },
  ]) {
    const changed = structuredClone(rows);
    change(changed[0]);
    assert.throws(() => auditReadiness(changed, capabilities, [], ledger), /Stale record review/);
  }
  const changedContract = structuredClone(capabilities);
  changedContract.types.person.critical = true;
  assert.notEqual(recordDigest(rows[0], changedContract), ledger.records[0].digest);
  assert.throws(() => auditReadiness(rows, changedContract, [], ledger), /Stale record review/);
});
test("approval needs non-author human declaration and every substantive check", () => {
  for (const mutate of [
    (e) => {
      e.reviewer.id = "author";
    },
    (e) => {
      e.reviewer.kind = "agent";
    },
    (e) => {
      e.checks.ordinaryText = false;
    },
    (e) => {
      e.note = "";
    },
  ]) {
    const rows = sample(),
      ledger = reviewTemplate(rows, capabilities);
    ledger.records[0] = approval(ledger.records[0]);
    mutate(ledger.records[0]);
    assert.throws(() => auditReadiness(rows, capabilities, [], ledger));
  }
});
test("approved annotations alone do not certify split independence or quotas", () => {
  const rows = sample(),
    ledger = reviewTemplate(rows, capabilities);
  ledger.records = ledger.records.map(approval);
  let report = auditReadiness(rows, capabilities, [], ledger);
  assert.equal(report.independentReview.approved, 2);
  assert.equal(report.pilotReady, false);
  assert.equal(report.independentReview.splitApproved, false);
  ledger.splitReview = approval(ledger.splitReview);
  report = auditReadiness(rows, capabilities, [], ledger);
  assert.equal(report.independentReview.splitApproved, true);
  assert.equal(report.pilotReady, false);
});
test("readiness requires both actual quota coverage and matching approvals; rejection revokes it", () => {
  // Tiny unit contract exercises the success branch without relaxing the real corpus contract.
  const contract = {
    types: { person: capabilities.types.person },
    requiredForPilot: {
      trainFamilies: 2,
      developmentFamilies: 2,
      perTypeFamilies: 1,
      negativeFractionMin: 0.5,
    },
  };
  const rows = [
    ...sample(),
    row("c", "train", "Phí cố định cho mỗi bản sao."),
    row("d", "development", "Biểu mẫu không có nội dung."),
  ];
  const ledger = reviewTemplate(rows, contract);
  ledger.records = ledger.records.map(approval);
  ledger.splitReview = approval(ledger.splitReview);
  let result = auditReadiness(rows, contract, [], ledger);
  assert.equal(result.pilotReady, true);
  assert.equal(result.finalValidationReady, false);
  assert.equal(result.independentReview.identityVerified, false);
  ledger.records[0].status = "rejected";
  result = auditReadiness(rows, contract, [], ledger);
  assert.equal(result.pilotReady, false);
  assert.equal(result.independentReview.pending, 1);
});
test("reject stale split approvals, unknown/duplicate reviews, and exposed final data", () => {
  const rows = sample();
  let ledger = reviewTemplate(rows, capabilities);
  ledger.splitReview.digest = "old";
  assert.throws(() => auditReadiness(rows, capabilities, [], ledger), /Stale split/);
  ledger = reviewTemplate(rows, capabilities);
  ledger.records.push(ledger.records[0]);
  assert.throws(() => auditReadiness(rows, capabilities, [], ledger), /Duplicate review/);
  ledger = reviewTemplate(rows, capabilities);
  ledger.records[0].id = "absent";
  assert.throws(() => auditReadiness(rows, capabilities, [], ledger), /Unknown review/);
  const finalRows = sample();
  finalRows[1].split = "final";
  assert.throws(() => auditReadiness(finalRows, capabilities, []), /Final holdout/);
});
test("value leakage catches renamed families, formatting and cross-type vocabulary reuse", () => {
  const rows = [
    row("a", "train", "Số liên hệ: [[phone|0916 482 735]]."),
    row("b", "development", "Tên đăng nhập được ghi [[username|0916482735]] ở đây."),
  ];
  assert.throws(() => auditReadiness(rows, capabilities, []), /entity value leakage/);
  rows[1].split = "train";
  assert.doesNotThrow(() => auditReadiness(rows, capabilities, []));
});
test("renamed observed regression templates and shared scenario labels are rejected", () => {
  const rows = sample();
  const old = parseRecord(
    row("old", "development", "Kính gửi [[person|Võ Mai]], xin nhận hồ sơ."),
    capabilities,
  );
  assert.throws(() => auditReadiness(rows, capabilities, [old]), /regression template/);
  rows[1].scenarioId = rows[0].scenarioId;
  assert.throws(() => auditReadiness(rows, capabilities, []), /scenario leakage/);
});

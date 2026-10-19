import assert from "node:assert/strict";
import test from "node:test";
import {
  parseRows,
  fixtures,
  describe,
  typeCategories,
  criticalTypes,
  summarizeChallenge,
} from "../scripts/challenge-core/common.mjs";
import { scoreFixture, categories } from "../scripts/model-comparison-metrics.mjs";
function scored(f) {
  return {
    ...scoreFixture(
      f,
      f.entities,
      Object.fromEntries(categories.map((c) => [c, f.entities.filter((e) => e.category === c)])),
    ),
    recordId: f.recordId,
    representation: f.representation,
    error: null,
  };
}
test("challenge annotations cover exact source spans and keep each variant in its record family", async () => {
  const fs = await fixtures(),
    stats = describe(fs);
  assert.equal(stats.cases, 100);
  assert.equal(stats.families, 48);
  assert.equal(stats.negativeCases, 24);
  assert.equal(Object.keys(stats.types).length, 17);
  assert.ok(Object.values(stats.types).every((n) => n > 0));
  const byFamily = Map.groupBy(fs, (f) => f.recordId);
  for (const variants of byFamily.values()) {
    if (!variants[0].entities.length) {
      assert.equal(variants.length, 1);
      continue;
    }
    assert.ok([3, 4].includes(variants.length));
    for (const f of variants) {
      assert.deepEqual(
        f.entities.map((e) => e.type),
        variants[0].entities.map((e) => e.type),
      );
      for (const e of f.entities) assert.equal(f.text.slice(e.start, e.end), e.value);
    }
  }
  assert.ok(summarizeChallenge(fs.map(scored)).challengePass, "Perfect predictions should pass");
});
test("annotation parser rejects unknown types, category disagreement and duplicate ids", () => {
  const row = {
    id: "one",
    recordId: "one",
    representation: "prose",
    annotated: "[[name|Synthetic Person]]",
    entityTypes: ["person"],
  };
  assert.throws(() => parseRows([row, row]), /Duplicate/);
  assert.throws(() => parseRows([{ ...row, entityTypes: ["email"] }]), /Type\/category/);
  assert.throws(() => parseRows([{ ...row, entityTypes: ["unknown"] }]), /Type\/category/);
  assert.throws(() => parseRows([{ ...row, entityTypes: [] }]), /Type annotation count/);
});
function balanced() {
  const rows = [];
  for (const [type, category] of Object.entries(typeCategories))
    for (let i = 0; i < 20; i++) {
      const id = `${type}-${i}`;
      const entity = {
        category,
        type,
        critical: criticalTypes.includes(type),
        start: 0,
        end: 4,
        value: "demo",
        total: 4,
        covered: 4,
        full: true,
        selectedFull: true,
      };
      rows.push({
        id,
        recordId: id,
        representation: "prose",
        group: "short",
        error: null,
        entities: [entity],
        sensitiveChars: 4,
        coveredChars: 4,
        ordinaryChars: 10,
        falsePositiveChars: 0,
        falsePositives: [],
      });
    }
  return rows;
}
test("one critical miss fails even when aggregate and subtype percentage floors pass", () => {
  const rows = balanced(),
    row = rows.find((r) => r.id === "password-0");
  row.entities[0].selectedFull = false;
  const result = summarizeChallenge(rows);
  assert.ok(result.screeningPass);
  assert.ok(result.byType.password.pass);
  assert.equal(result.criticalFailures.length, 1);
  assert.equal(result.challengePass, false);
});
test("subtype failures cannot hide inside the broad other category", () => {
  const rows = balanced();
  for (const row of rows.filter((r) => ["organization-0", "organization-1"].includes(r.id)))
    row.entities[0].selectedFull = false;
  const result = summarizeChallenge(rows);
  assert.ok(result.screeningPass);
  assert.equal(result.criticalFailures.length, 0);
  assert.equal(result.byType.organization.pass, false);
  assert.equal(result.challengePass, false);
});
test("failures and ordinary-negative masking remain blocking and visible", () => {
  const rows = balanced();
  rows[0].error = "Synthetic provider failure";
  assert.equal(summarizeChallenge(rows).challengePass, false);
  rows[0].error = null;
  for (let i = 0; i < 2; i++)
    rows.push({
      id: `negative-${i}`,
      recordId: `negative-${i}`,
      representation: "ordinary-text",
      group: "short",
      error: null,
      entities: [],
      sensitiveChars: 0,
      coveredChars: 0,
      ordinaryChars: 100,
      falsePositiveChars: 1,
      falsePositives: [],
    });
  const result = summarizeChallenge(rows);
  assert.equal(result.summary.falsePositiveNegativeCases, 2);
  assert.equal(result.challengePass, false);
});

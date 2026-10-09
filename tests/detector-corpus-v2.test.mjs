import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { records as first } from "../scripts/detector-corpus-v1/records.mjs";
import { records as second } from "../scripts/detector-corpus-v2/records.mjs";
import { auditExpansion } from "../scripts/detector-corpus-v2/coverage.mjs";
const capabilities = JSON.parse(
  readFileSync(
    new URL("../docs/evaluations/detector-feasibility/capabilities.json", import.meta.url),
  ),
);
const seed = JSON.parse(
  readFileSync(new URL("./fixtures/detector-feasibility/development-seed.json", import.meta.url)),
);
const rows = [...seed, ...first, ...second];

test("focused expansion improves thin types without counting variants as new families", () => {
  const previous = auditExpansion([...seed, ...first], capabilities, []);
  const next = auditExpansion(rows, capabilities, []);
  assert.equal(second.length, 70);
  assert.equal(next.composition.train.families, 65);
  assert.equal(next.composition.development.families, 93);
  for (const split of ["train", "development"]) {
    assert.ok(next.gaps[split].ordinaryFraction >= 0.3);
    for (const type of ["birthdate", "identity", "passport", "cvv", "pin", "apikey"])
      assert.equal(
        next.composition[split].typeFamilies[type] - previous.composition[split].typeFamilies[type],
        4,
      );
  }
  assert.equal(next.independentReview.pending, 161);
  assert.equal(next.pilotReady, false);
  assert.equal(next.finalValidationReady, false);
  assert.equal(next.gaps.train.familyDeficit, 135);
  assert.equal(next.gaps.development.familyDeficit, 0);
  assert.ok(next.gaps.development.typeDeficits.password > 0);
});
test("renamed and revalued template copies cannot pad a partition family count", () => {
  const source = second.find((row) => row.scenarioId === "v2-apikey-json");
  const duplicate = {
    ...source,
    id: source.id + "-copy",
    familyId: "different-family",
    templateId: "different-template",
    scenarioId: "different-scenario",
    annotated: source.annotated.replace("demo_tr_json_6qN8kP2v", "demo_other_Ac4nB7s"),
  };
  assert.throws(() => auditExpansion([source, duplicate], capabilities, []), /Duplicate template/);
  duplicate.familyId = source.familyId;
  const result = auditExpansion([source, duplicate], capabilities, []);
  assert.equal(result.composition.train.families, 1);
});
test("scenario metadata and ordinary numeric text cannot manufacture extra families", () => {
  const source = second.find((row) => row.scenarioId === "v2-negative-pin-attempts");
  const duplicate = {
    ...source,
    id: "different-id",
    familyId: "different-family",
    annotated: source.annotated.replace("180", "240"),
  };
  assert.throws(() => auditExpansion([source, duplicate], capabilities, []), /Duplicate/);
  const differentText = {
    ...source,
    id: "another-id",
    familyId: "another-family",
    annotated: "Nội dung khác hẳn nhưng cùng một kịch bản gốc.",
  };
  assert.throws(
    () => auditExpansion([source, differentText], capabilities, []),
    /Duplicate scenario/,
  );
});

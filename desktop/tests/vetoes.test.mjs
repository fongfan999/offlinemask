import test from "node:test";
import assert from "node:assert/strict";
import { modelDetections } from "../src/core/detection/model-policy.ts";
import { disabledVetoes, setVetoes, vetoNames } from "../src/core/detection/vetoes.ts";
import { judgeAblations, planRuns, comparisonMarkdown } from "../scripts/compare-packs-report.mjs";

const span = (text, value, canonical_label) => {
  const start = text.indexOf(value);
  assert.ok(start >= 0, value);
  return { start, end: start + value.length, canonical_label, score: 0.9 };
};
const values = (text, detections) => detections.map((d) => text.slice(d.start, d.end));

test("every mechanism is on by default and comes back on after a measurement", (t) => {
  t.after(() => setVetoes([]));
  assert.deepEqual(disabledVetoes(), []);
  const heading = "SAO KÊ TÀI KHOẢN";
  const row = "Quan hệ\tHọ và tên\n\nBố\tBùi Bảo Trang";
  const org = (text) => modelDetections(text, [span(text, text, "ORGANIZATION")]);
  assert.deepEqual(values(heading, org(heading)), []);
  assert.deepEqual(values(row, modelDetections(row, [span(row, "Bố", "PERSON")])), []);
  // Off, the model's word stands; each switch frees only its own mechanism.
  setVetoes(["capitalHeadings"]);
  assert.deepEqual(values(heading, org(heading)), [heading]);
  assert.deepEqual(values(row, modelDetections(row, [span(row, "Bố", "PERSON")])), []);
  setVetoes(["wordingColumns"]);
  assert.deepEqual(values(heading, org(heading)), []);
  assert.deepEqual(values(row, modelDetections(row, [span(row, "Bố", "PERSON")])), ["Bố"]);
  // A goods cell under a goods heading is covered twice (the column, the cell's unit), so
  // it comes back only when both are off: what the "+" groups of an ablation are for.
  const goods = "Tên hàng hóa\tĐơn vị tính\n\nGhẹ Xanh Bình Thuận\tKg";
  const place = (text) => modelDetections(text, [span(text, "Bình Thuận", "LOCATION")]);
  setVetoes(["wordingColumns"]);
  assert.deepEqual(values(goods, place(goods)), []);
  setVetoes(["wordingColumns", "productCells"]);
  assert.deepEqual(values(goods, place(goods)), ["Bình Thuận"]);
  setVetoes([]);
  assert.deepEqual(values(heading, org(heading)), []);
  assert.throws(() => setVetoes(["nonsense"]), /Unknown veto/);
  assert.ok(vetoNames.length >= 10);
});

test("a comparison plans the shipping run, the candidate and one ablation per mechanism", () => {
  assert.deepEqual(planRuns(), [{ id: "shipping", pack: "shipping", off: [] }]);
  const runs = planRuns({ candidate: true, ablate: ["phrases", "capitalHeadings"] });
  assert.deepEqual(
    runs.map((run) => [run.id, run.pack, run.off]),
    [
      ["shipping", "shipping", []],
      ["candidate", "candidate", []],
      ["candidate without phrases", "candidate", ["phrases"]],
      ["candidate without capitalHeadings", "candidate", ["capitalHeadings"]],
    ],
  );
  // Without a candidate the ablations run on the shipping pack; "+" joins mechanisms.
  assert.equal(planRuns({ ablate: ["phrases"] })[1].pack, "shipping");
  assert.deepEqual(planRuns({ ablate: ["wordingColumns+productCells"] })[1], {
    id: "shipping without wordingColumns+productCells",
    pack: "shipping",
    off: ["wordingColumns", "productCells"],
    ablates: "wordingColumns+productCells",
  });
  assert.throws(() => planRuns({ ablate: ["nonsense"] }), /Unknown veto/);
});

test("an ablation that brings nothing back marks a mechanism the pack no longer needs", () => {
  const totals = (over, leaked = 0, unlisted = 0) => ({
    documents: 3,
    notRead: 0,
    leaked,
    over,
    unlisted,
  });
  const runs = planRuns({ candidate: true, ablate: ["phrases", "capitalHeadings", "trims"] });
  const results = {
    shipping: { "seed 1": totals(0), invoices: totals(0) },
    candidate: { "seed 1": totals(1), invoices: totals(0) },
    "candidate without phrases": { "seed 1": totals(1), invoices: totals(0) },
    "candidate without capitalHeadings": { "seed 1": totals(4), invoices: totals(0, 0, 1) },
    "candidate without trims": { "seed 1": totals(0), invoices: totals(0, 2) },
  };
  const verdicts = judgeAblations(runs, results);
  assert.deepEqual(verdicts, [
    { veto: "phrases", needed: false, returned: {} },
    {
      veto: "capitalHeadings",
      needed: true,
      returned: { "seed 1": { over: 3 }, invoices: { unlisted: 1 } },
    },
    { veto: "trims", needed: true, returned: { invoices: { leaked: 2 } } },
  ]);
  const markdown = comparisonMarkdown({
    at: "2026-10-27T10:00:00.000Z",
    packs: { shipping: "abc", candidate: "run-1" },
    sets: [
      { name: "seed 1", documents: 3 },
      { name: "invoices", documents: 3 },
    ],
    runs,
    results,
    verdicts,
    seconds: 61.4,
  });
  assert.match(
    markdown,
    /\| candidate \| 0 \/ 0 \/ 1 \/ 0 \| 0 \/ 0 \/ 0 \/ 0 \| 0 \/ 0 \/ 1 \/ 0 \|/,
  );
  assert.match(markdown, /\*\*capitalHeadings\*\*: seed 1: \+3 over; invoices: \+1 unlisted/);
  assert.match(markdown, /switched off: phrases\./);
  assert.doesNotMatch(markdown, /Bùi/);
});

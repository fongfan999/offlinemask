import test from "node:test";
import assert from "node:assert/strict";
import {
  findings,
  initialDecisions,
  pendingCount,
  prepareCopy,
  previewText,
  sampleText,
  splitText,
} from "../src/core/review.ts";

test("review is gated until each known finding has an explicit decision", () => {
  const decisions = initialDecisions();
  assert.equal(pendingCount(decisions), 5);
  assert.throws(() => prepareCopy(decisions));
  for (const finding of findings) decisions[finding.id] = "mask";
  assert.equal(pendingCount(decisions), 0);
  assert.doesNotThrow(() => prepareCopy(decisions));
  delete decisions.email;
  assert.throws(() => prepareCopy(decisions));
});

test("repeated names use one alias while unmarked content stays unchanged", () => {
  const decisions = Object.fromEntries(
    findings.map((item) => [item.id, "mask"]),
  );
  const output = prepareCopy(decisions);
  assert.equal(output.split("[TEN_DEMO_01]").length - 1, 2);
  for (const finding of findings) assert.ok(!output.includes(finding.value));
  assert.ok(output.includes("08/09/2026"));
  assert.ok(output.includes("2.500.000 đồng"));
  assert.equal(
    splitText(sampleText, findings)
      .map((part) => part.text)
      .join(""),
    sampleText,
  );
});

test("keep decisions preserve exact text including leading zeros", () => {
  const decisions = Object.fromEntries(
    findings.map((item) => [item.id, "keep"]),
  );
  assert.equal(prepareCopy(decisions), sampleText);
  decisions.name = "mask";
  const output = prepareCopy(decisions);
  assert.ok(output.includes("001234567890"));
  assert.ok(!output.includes("Nguyễn Minh Anh"));
});

test("preview proposals are separate from permission to prepare a copy", () => {
  const decisions = initialDecisions();
  assert.ok(previewText(decisions).includes("[STK_DEMO_01]"));
  assert.throws(() => prepareCopy(decisions));
  decisions.account = "keep";
  assert.ok(previewText(decisions).includes("001234567890"));
  assert.throws(() => prepareCopy(decisions));
});

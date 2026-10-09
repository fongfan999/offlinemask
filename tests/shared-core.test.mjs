import test from "node:test";
import assert from "node:assert/strict";
import { applyDetectionPolicy, localDetections } from "../src/core/detection/policy.ts";
import { createModelRunner } from "../src/core/detection/model-runner.ts";
import { filterDetections } from "../src/core/detection/options.ts";
import { attachReferenceOffsets } from "../scripts/shared-core/reference-offsets.mjs";
import { summarizeStage } from "../scripts/shared-core/metrics.mjs";
import { categories } from "../scripts/model-comparison-metrics.mjs";

test("shared policy keeps model evidence separate while correcting explicit credential categories", () => {
  const text = 'Mật khẩu: "demo@example.com"';
  const start = text.indexOf("demo");
  const predictions = [
    {
      start,
      end: text.length - 1,
      type: "EMAIL",
      label: "Email",
      source: "Synthetic provider",
      reason: "Fixture",
      priority: 50,
    },
  ];
  const original = structuredClone(predictions);
  const result = applyDetectionPolicy(text, predictions);
  assert.deepEqual(predictions, original);
  assert.equal(result.modelOnly[0].type, "EMAIL");
  assert.equal(filterDetections(result.complete, ["email"]).length, 0);
  const other = filterDetections(result.complete, ["other"]);
  assert.equal(other.length, 1);
  assert.equal(text.slice(other[0].start, other[0].end), "demo@example.com");
  assert.equal(other[0].type, "MAT_KHAU");
});

test("local-only policy does not acquire contextual name recognition", () => {
  const text = "Họ tên: Lê Minh An; STK người nhận: 0012345678";
  assert.equal(filterDetections(localDetections(text), ["name"]).length, 0);
  assert.equal(filterDetections(localDetections(text), ["banking"]).length, 1);
  assert.equal(filterDetections(applyDetectionPolicy(text, []).complete, ["name"]).length, 1);
});

test("shared runner uses one inference pass for model-only and complete findings", async () => {
  const text = "Họ tên: Lê Minh An";
  let calls = 0,
    disposed = 0;
  const runner = createModelRunner([
    {
      source: "Fixture",
      tokenCount: () => 10,
      async predict(value) {
        calls++;
        return [{ word: value, index: 1, entity: "O", score: 1 }];
      },
      async dispose() {
        disposed++;
      },
    },
  ]);
  const result = await runner.inspect(text);
  assert.equal(calls, 1);
  assert.deepEqual(result.modelOnly, []);
  assert.equal(text.slice(result.complete[0].start, result.complete[0].end), "Lê Minh An");
  await runner.dispose();
  assert.equal(disposed, 1);
});

test("runner preserves provider source offsets across windows and reports complete progress", async () => {
  const text = "Bản tổng hợp. ".repeat(180) + "Lê Minh An";
  const seen = [],
    progress = [];
  const runner = createModelRunner([
    {
      source: "Fixture checkpoint",
      tokenCount: (value) => Math.ceil(value.length / 2) + 2,
      async predict(value) {
        seen.push(value);
        const name = value.indexOf("Lê Minh An");
        return name < 0
          ? [{ word: value, index: 1, entity: "O", score: 1 }]
          : [
              { word: value.slice(0, name), index: 1, entity: "O", score: 1 },
              { word: "Lê Minh An", index: 2, entity: "B-PERSON", score: 1 },
            ].filter((t) => t.word);
      },
      async dispose() {},
    },
  ]);
  const result = await runner.inspect(text, (value) => progress.push(value));
  assert.ok(seen.length > 1);
  assert.ok(seen.every((value) => Math.ceil(value.length / 2) + 2 <= 384));
  assert.deepEqual(
    progress.map((p) => p.completed),
    seen.map((_, i) => i + 1),
  );
  assert.ok(progress.every((p) => p.total === seen.length));
  assert.equal(result.modelOnly.at(-1).start, text.indexOf("Lê Minh An"));
  assert.equal(result.modelOnly.at(-1).end, text.length);
  assert.equal(result.modelOnly.at(-1).source, "Fixture checkpoint");
});

test("inference and alignment failures cannot return a partial success from the runner", async () => {
  assert.throws(() => createModelRunner([]));
  for (const predict of [
    async () => {
      throw Error("Fixture failure");
    },
    async () => [{ word: "An", index: 1, entity: "B-PERSON", score: 1 }],
  ]) {
    const runner = createModelRunner([
      { source: "Fixture", tokenCount: () => 5, predict, async dispose() {} },
    ]);
    await assert.rejects(runner.inspect("Missing An"));
  }
});

test("reference offsets preserve unknown emoji/combining text and reject tokenizer disagreements", () => {
  const text = "😀 A\u0301n";
  const tokens = [
    { index: 1, word: "[UNK]", entity: "O", score: 1 },
    { index: 2, word: "[UNK]", entity: "B-PERSON", score: 1 },
  ];
  const ids = [100, 100],
    reference = {
      ids,
      offsets: [
        [0, 2],
        [3, text.length],
      ],
    };
  assert.deepEqual(
    attachReferenceOffsets(text, tokens, ids, reference).map((t) => t.word),
    ["😀", "A\u0301n"],
  );
  assert.throws(() => attachReferenceOffsets(text, tokens, [101, 100], reference));
  assert.throws(() => attachReferenceOffsets(text, tokens.slice(1), ids, reference));
  assert.throws(() =>
    attachReferenceOffsets(text, tokens, ids, {
      ...reference,
      offsets: [
        [0, 2],
        [3, 999],
      ],
    }),
  );
  assert.throws(() =>
    attachReferenceOffsets(text, [{ ...tokens[0], index: 3 }, tokens[1]], ids, reference),
  );
});

test("screening rejects wrong other-category coverage and excludes long boilerplate from excess masking", () => {
  const row = {
    entities: categories.map((category) => ({
      category,
      full: true,
      selectedFull: true,
      covered: 3,
    })),
    sensitiveChars: 18,
    coveredChars: 18,
    ordinaryChars: 100,
    falsePositiveChars: 0,
    group: "short",
  };
  assert.equal(summarizeStage([row]).screeningPass, true);
  const wrong = structuredClone(row);
  wrong.entities.at(-1).selectedFull = false;
  assert.equal(summarizeStage([wrong]).screeningPass, false);
  const long = { ...row, group: "long", ordinaryChars: 100_000 };
  const result = summarizeStage([{ ...row, falsePositiveChars: 2 }, long]);
  assert.ok(result.summary.excessMaskingRate < 0.01);
  assert.equal(result.shortSummary.excessMaskingRate, 0.02);
  assert.equal(result.screeningPass, false);
});

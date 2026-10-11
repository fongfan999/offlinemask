import test from "node:test";
import assert from "node:assert/strict";
import {
  recognitionSource,
  attachRecognitionOffsets,
} from "../src/core/detection/recognition-source.ts";
import { recognitionPack } from "../src/core/detection/pack.ts";
test("production normalization restores decomposed Vietnamese and repeated names exactly", () => {
  const original = "🙂 Nguyễn / Nguyễn";
  const view = recognitionSource(original);
  const start = view.text.lastIndexOf("Nguyễn");
  const [span] = view.restore([{ start, end: start + 6, type: "TEN" }]);
  assert.equal(original.slice(span.start, span.end), "Nguyễn");
  assert.equal(span.start, original.lastIndexOf("Nguyễn"));
  assert.throws(() => view.restore([{ start: -1, end: 2 }]));
});
test("native alignment preserves unknown input and maps only the pack's contextual labels", () => {
  const tokens = [
    { index: 1, entity: "B-PER", score: 0.9, word: "[UNK]" },
    { index: 2, entity: "B-MISC", score: 0.8, word: "test" },
  ];
  const reference = {
    ids: [1, 2],
    offsets: [
      [0, 5],
      [6, 10],
    ],
  };
  const labels = recognitionPack.models.find((model) => model.offsets === "native").labels;
  const aligned = attachRecognitionOffsets("H’Hen test", tokens, [1, 2], reference, labels);
  assert.equal(aligned[0].word, "H’Hen");
  assert.equal(aligned[0].entity, "B-PERSON");
  assert.equal(aligned[1].entity, "O");
  // Without a map the model's own labels pass through unchanged.
  assert.deepEqual(
    attachRecognitionOffsets("H’Hen test", tokens, [1, 2], reference).map((t) => t.entity),
    ["B-PER", "B-MISC"],
  );
  assert.throws(() => attachRecognitionOffsets("H’Hen test", tokens, [2, 1], reference, labels));
  assert.throws(() =>
    attachRecognitionOffsets(
      "H’Hen test",
      tokens,
      [1, 2],
      {
        ids: [1, 2],
        offsets: [
          [6, 10],
          [0, 5],
        ],
      },
      labels,
    ),
  );
});

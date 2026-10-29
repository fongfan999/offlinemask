import test from "node:test";
import assert from "node:assert/strict";
import { readPicture } from "../src/core/doc/reading.ts";
import definition from "../reading/reading-v1.json" with { type: "json" };

// OfflineMask's own text recognition (decision 0172). The graphs are stood in for by
// fakes: a detector that sees one line where the test drew it, and a recogniser that
// reads every run of ink it is given as the next letter, with a space between runs.
const width = 200;
const height = 60;
/** A white picture with black blocks, as [x0, x1) × [20, 40). */
function picture(blocks) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const [x0, x1] of blocks)
    for (let y = 20; y < 40; y++)
      for (let x = x0; x < x1; x++) data.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 3);
  return { data, width, height };
}
const alphabet = ["<blank>", " ", "a", "b", "c"];
function fakes() {
  const calls = { recognise: 0 };
  return {
    calls,
    async detect(input, mapWidth, mapHeight) {
      assert.equal(input.length, 3 * mapWidth * mapHeight);
      const map = new Float32Array(mapWidth * mapHeight);
      for (let y = 18; y < 42; y++) for (let x = 15; x < 185; x++) map[y * mapWidth + x] = 1;
      return map;
    },
    async recognise(input, lineWidth) {
      calls.recognise++;
      const lineHeight = definition.recogniser.height;
      const steps = lineWidth / definition.recogniser.stride;
      const data = new Float32Array(steps * alphabet.length);
      for (let step = 0; step < steps; step++) data[step * alphabet.length] = 1;
      const ink = (x) => {
        for (let y = 0; y < lineHeight; y++) if (input[y * lineWidth + x] < 0) return true;
        return false;
      };
      const emit = (x, index) => {
        const step = Math.min(steps - 1, Math.floor(x / definition.recogniser.stride));
        data.fill(0, step * alphabet.length, (step + 1) * alphabet.length);
        data[step * alphabet.length + index] = 1;
      };
      let letter = 0;
      let end;
      for (let x = 0; x < lineWidth; x++) {
        if (!ink(x) || (x > 0 && ink(x - 1))) continue;
        if (end !== undefined) emit(Math.round((end + x) / 2), 1);
        emit(x + 1, 2 + letter++);
        end = x;
        while (end + 1 < lineWidth && ink(end + 1)) end++;
      }
      return { data, steps, classes: alphabet.length };
    },
  };
}
const read = (blocks, overrides = {}) => {
  const models = fakes();
  const reading = {
    ...definition,
    recogniser: { ...definition.recogniser, alphabet, ...overrides },
  };
  return readPicture(picture(blocks), models, reading).then((page) => ({ page, models }));
};
const close = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) <= 3 / width, `${message}: ${actual} vs ${expected}`);

test("a line's words come back with their own boxes, spaced as an engine's are", async () => {
  const { page } = await read([
    [20, 60],
    [100, 150],
  ]);
  assert.deepEqual(
    page.lines.map((word) => word.text),
    ["a ", "b"],
  );
  const [first, second] = page.lines;
  close(first.x, 20 / width, "first word starts at its ink");
  close(first.x + first.width, 60 / width, "first word ends at its ink");
  close(second.x, 100 / width, "second word starts at its ink");
  close(second.x + second.width, 150 / width, "second word ends at its ink");
  assert.equal(first.y, second.y);
  assert.equal(first.height, second.height);
  assert.ok(first.y > 0 && first.y < 20 / height && first.y + first.height > 40 / height);
  assert.equal(first.confidence, 1);
});

test("a line too wide for one reading is read in pieces cut at a word gap", async () => {
  const { page, models } = await read(
    [
      [20, 50],
      [70, 100],
      [120, 150],
    ],
    { piece: 48 },
  );
  assert.ok(models.calls.recognise > 1);
  assert.deepEqual(page.lines.map((word) => word.text.trim()).filter(Boolean).length, 3);
  for (const [index, x] of [20, 70, 120].entries())
    close(page.lines[index].x, x / width, `word ${index} starts at its ink`);
});

test("a picture with no line found reads as no words", async () => {
  const models = {
    detect: async (input, w, h) => new Float32Array(w * h),
    recognise: async () => assert.fail("nothing to read"),
  };
  assert.deepEqual(await readPicture(picture([]), models, definition), { lines: [] });
});

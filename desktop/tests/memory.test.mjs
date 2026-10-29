import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import {
  memoryBudget,
  memoryMessage,
  memoryNeed,
  memorySize,
  unzippedSize,
} from "../src/core/memory.ts";

const gib = 1024 ** 3;

test("the app keeps to a quarter of the machine's memory, between 1 and 4 GB", () => {
  assert.equal(memoryBudget(8 * gib), 2 * gib);
  assert.equal(memoryBudget(2 * gib), 1 * gib);
  assert.equal(memoryBudget(64 * gib), 4 * gib);
  assert.equal(memoryBudget(null), 2 * gib, "an unknown machine counts as 8 GB");
});

test("a zip's unpacked size comes from its directory, without unpacking", async () => {
  const zip = new JSZip();
  zip.file("xl/worksheets/sheet1.xml", "a".repeat(100_000));
  zip.file("[Content_Types].xml", "b".repeat(500));
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  assert.ok(bytes.length < 10_000);
  assert.equal(await unzippedSize(new Blob([bytes])), 100_500);
  assert.equal(await unzippedSize(new Blob(["not a zip"])), null);
  const need = await memoryNeed(new File([bytes], "a.xlsx"));
  assert.equal(need, 100_500 * 15, "a workbook counts by its unpacked XML");
});

test("plain files count by their size, and the refusal gives the figures", async () => {
  assert.equal(await memoryNeed(new File(["x".repeat(1000)], "a.csv")), 12_000);
  assert.equal(await memoryNeed(new File(["x".repeat(1000)], "a.txt")), 4_000);
  assert.equal(memorySize(1.5 * gib), "1,5 GB");
  assert.equal(memorySize(800 * 1024 ** 2), "800 MB");
  assert.match(memoryMessage(3 * gib, 2 * gib), /khoảng 3 GB.*tự giới hạn.*\(2 GB\)/);
});

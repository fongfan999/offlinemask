import test from "node:test";
import assert from "node:assert/strict";
import {
  estimateSeconds,
  fileWorkers,
  folderKind,
  isLitter,
  layoutKey,
  mapPool,
  outputFolderNames,
  roughDuration,
  scannedChars,
  skipReason,
  sortEntries,
} from "../src/core/folder.ts";
import { maskParagraphs } from "../src/core/doc/mask.ts";
import { AliasBook, maskTables } from "../src/core/sheet/mask.ts";

const gib = 1024 ** 3;
const entry = (path, size = 10) => ({ path, file: { name: path.split("/").pop(), size } });

test("a folder takes documents and spreadsheets and says why it leaves the rest", () => {
  assert.equal(folderKind("Hợp đồng.docx"), "word");
  assert.equal(folderKind("ghi chú.md"), "word");
  assert.equal(folderKind("Sao kê.xls"), "excel");
  assert.equal(folderKind("ảnh.png"), null);
  assert.equal(skipReason(entry("a/Hợp đồng.pdf")), null);
  assert.match(skipReason(entry("a/cũ.doc")), /\.doc cũ/);
  assert.match(skipReason(entry("a/ảnh.png")), /Chưa hỗ trợ/);
  assert.match(skipReason(entry("a/lớn.xlsx", 21 * 1024 * 1024)), /20 MB/);
  for (const name of [".DS_Store", "~$Hợp đồng.docx", "Thumbs.db", "desktop.ini"])
    assert.ok(isLitter(name), name);
  assert.ok(!isLitter("Hợp đồng.docx"));
});

test("files sort as a file manager sorts them, numbers by value", () => {
  const sorted = sortEntries([
    entry("Tháng 10.xlsx"),
    entry("Tháng 2.xlsx"),
    entry("Tháng 1.xlsx"),
  ]);
  assert.deepEqual(
    sorted.map((item) => item.path),
    ["Tháng 1.xlsx", "Tháng 2.xlsx", "Tháng 10.xlsx"],
  );
});

test("file workers follow processors and memory, between one and four", () => {
  assert.equal(fileWorkers({ cores: 10, memory: 16 * gib }), 2);
  assert.equal(fileWorkers({ cores: 16, memory: 64 * gib }), 4);
  assert.equal(fileWorkers({ cores: 32, memory: 128 * gib }), 4);
  assert.equal(fileWorkers({ cores: 16, memory: 8 * gib }), 2);
  assert.equal(fileWorkers({ cores: 4, memory: 4 * gib }), 1);
  assert.equal(fileWorkers({ cores: 2, memory: null }), 1);
  assert.equal(fileWorkers({ cores: 12, memory: null }), 2);
});

test("durations read as people say them", () => {
  assert.equal(roughDuration(20), "dưới 1 phút");
  assert.equal(roughDuration(25 * 60), "khoảng 25 phút");
  assert.equal(roughDuration(3 * 3600 + 100), "khoảng 3 giờ");
  assert.equal(roughDuration(90 * 60), "khoảng 1 giờ 30 phút");
});

test("the estimate counts the model's load and its measured pace", () => {
  assert.equal(estimateSeconds(0), 0);
  // Two bank statements' scanned columns and two letters, about 1 minute natively.
  assert.equal(roughDuration(estimateSeconds(110_000)), "khoảng 1 phút");
  // A pace a finished run measured replaces the assumed one.
  assert.equal(estimateSeconds(10_000, 500), 25);
});

test("sheets with the same headers share a layout, and only scanned columns are read", () => {
  assert.equal(layoutKey(["Họ và tên", "Số ĐT"]), layoutKey(["họ và tên ", "Số đt"]));
  assert.notEqual(layoutKey(["Họ và tên"]), layoutKey(["Họ và tên", "Số ĐT"]));
  const sheet = { preambleChars: 30, columnChars: [100, 200, 400] };
  const plans = [
    { mode: "hide", type: "TEN", label: "Họ và tên" },
    { mode: "scan" },
    { mode: "keep" },
  ];
  assert.equal(scannedChars(sheet, plans), 230);
});

test("the pool runs at most `limit` tasks at once and every item once", async () => {
  let running = 0;
  let peak = 0;
  const seen = [];
  await mapPool([1, 2, 3, 4, 5, 6, 7], 3, async (item, slot) => {
    assert.ok(slot >= 0 && slot < 3);
    running++;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    seen.push(item);
    running--;
  });
  assert.equal(peak, 3);
  assert.deepEqual(seen.toSorted(), [1, 2, 3, 4, 5, 6, 7]);
});

test("output folders take the next free name", () => {
  const names = outputFolderNames("Hồ sơ");
  assert.equal(names.next().value, "Hồ sơ (OfflineMasked)");
  assert.equal(names.next().value, "Hồ sơ (OfflineMasked 2)");
});

test("one alias book gives a value one alias in every file of the folder", () => {
  const book = new AliasBook("4aae");
  const span = (start, end) => ({
    start,
    end,
    type: "TEN",
    label: "Họ và tên",
    source: "test",
    reason: "test",
    priority: 1,
  });
  const doc = maskParagraphs(
    [{ id: 0, text: "Ông Nguyễn Văn An ký hợp đồng." }],
    new Map([[0, [span(4, 17)]]]),
    "4aae",
    [],
    book,
  );
  const sheet = maskTables(
    [
      {
        name: "Khách",
        headerRow: 0,
        preamble: [],
        header: ["Họ và tên"],
        rows: [["Nguyễn Văn An"], ["Trần Thị Bình"]],
      },
    ],
    { columns: [[{ mode: "hide", type: "TEN", label: "Họ và tên" }]], detections: new Map() },
    "4aae",
    book,
  );
  const alias = doc.edits.paragraphs.get(0)[0].text;
  assert.equal(sheet.edits[0].get(1).get(0), alias);
  assert.notEqual(sheet.edits[0].get(2).get(0), alias);
  assert.equal(book.findings.length, 2);
});

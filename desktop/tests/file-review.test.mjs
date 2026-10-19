import test from "node:test";
import assert from "node:assert/strict";
import { countAliases, keepAliases, reviewGroups } from "../src/core/file-review.ts";
import { editedAliases, keepReplacements, maskParagraphs } from "../src/core/doc/mask.ts";
import { editedCells, editedTexts, keepCells, maskTables } from "../src/core/sheet/mask.ts";

const scope = "4aae";
const detection = (start, end, type, label = type) => ({
  start,
  end,
  type,
  label,
  source: "test",
  reason: "test",
  priority: 1,
});

test("review groups count each value and put the most frequent first", () => {
  const paragraphs = [
    { id: 0, text: "Đức Phật dạy Ananda tại Ấn Độ." },
    { id: 1, text: "Đức Phật nói." },
  ];
  const detections = new Map([
    [
      0,
      [
        detection(0, 8, "TEN", "Họ và tên"),
        detection(13, 19, "TEN", "Họ và tên"),
        detection(24, 29, "DIA_CHI", "Địa chỉ"),
      ],
    ],
    [1, [detection(0, 8, "TEN", "Họ và tên")]],
  ]);
  const result = maskParagraphs(paragraphs, detections, scope);
  const counts = countAliases(editedAliases(result.edits), result.findings);
  const groups = reviewGroups(result.findings, counts, new Set());
  assert.deepEqual(
    groups.map((group) => [group.label, group.items.map((item) => [item.value, item.count])]),
    [
      [
        "Họ và tên",
        [
          ["Đức Phật", 2],
          ["Ananda", 1],
        ],
      ],
      ["Địa chỉ", [["Ấn Độ", 1]]],
    ],
  );
});

test("a kept value stays as it is everywhere in a document", () => {
  const paragraphs = [
    { id: 0, text: "Đức Phật gặp Nguyễn Minh Anh." },
    { id: 1, text: "Đức Phật." },
  ];
  const detections = new Map([
    [0, [detection(0, 8, "TEN"), detection(13, 28, "TEN")]],
    [1, [detection(0, 8, "TEN")]],
  ]);
  const result = maskParagraphs(paragraphs, detections, scope);
  const buddha = result.findings.find((finding) => finding.value === "Đức Phật").alias;
  const edits = keepReplacements(result.edits, new Set([buddha]));
  assert.deepEqual(
    [...edits.paragraphs].map(([id, list]) => [id, list.map((r) => r.text)]),
    [[0, [`[TEN_2_${scope}]`]]],
  );
  assert.equal(keepReplacements(result.edits, new Set()), result.edits);
});

test("a kept value goes back in spreadsheet cells; a cell with nothing hidden is untouched", () => {
  const table = {
    name: "Sheet1",
    headerRow: 0,
    preamble: [],
    header: ["Họ tên", "Ghi chú"],
    rows: [
      [" Đức Phật ", "Đức Phật gặp Lan"],
      ["Lan", "Lan"],
    ],
  };
  const columns = [[{ mode: "hide", type: "TEN", label: "Họ và tên" }, { mode: "scan" }]];
  const detectionsByCell = new Map([
    ["0:1:1", [detection(0, 8, "TEN"), detection(13, 16, "TEN")]],
    ["0:2:1", [detection(0, 3, "TEN")]],
  ]);
  const result = maskTables([table], { columns, detections: detectionsByCell }, scope);
  const counts = countAliases(editedTexts(result.edits), result.findings);
  const buddha = result.findings.find((finding) => finding.value === "Đức Phật").alias;
  assert.equal(counts.get(buddha), 2);
  const edits = keepCells(result.edits, result.findings, new Set([buddha]));
  assert.equal(edits[0].get(1)?.get(0), undefined, "the hidden column keeps its original cell");
  assert.equal(edits[0].get(1)?.get(1), `Đức Phật gặp [TEN_2_${scope}]`);
  assert.equal(edits[0].get(2)?.get(1), `[TEN_2_${scope}]`);
  assert.equal(editedCells(edits), 3);
});

test("keepAliases leaves aliases of other files alone", () => {
  const values = new Map([[`[TEN_1_${scope}]`, "Lan"]]);
  assert.equal(keepAliases("[TEN_1_beef] và Lan", values, new Set([`[TEN_1_${scope}]`])), null);
  assert.equal(
    keepAliases(`[TEN_1_${scope}] [TEN_1_beef]`, values, new Set()),
    `[TEN_1_${scope}] [TEN_1_beef]`,
  );
});

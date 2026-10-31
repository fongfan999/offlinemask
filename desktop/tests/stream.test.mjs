import test from "node:test";
import assert from "node:assert/strict";
import Papa from "papaparse";
import { CsvReader, linePieces, textPieces, valueMasker } from "../src/core/stream.ts";
import { maskedCsv, maskedLines, pieceCells, surveyCsv } from "../src/core/sheet/csv-stream.ts";

const blob = (text) => new Blob([text]);
async function collect(pieces) {
  const parts = [];
  for await (const part of pieces) parts.push(part);
  return Buffer.concat(parts.map((part) => Buffer.from(part))).toString("utf8");
}
/** Feed `text` to a reader in pieces of `size` characters. */
function readInPieces(text, size, delimiter = ",") {
  const reader = new CsvReader(delimiter);
  const rows = [];
  for (let at = 0; at < text.length; at += size)
    rows.push(...reader.feed(text.slice(at, at + size)));
  rows.push(...reader.finish());
  return { rows, newline: reader.newline };
}

test("CSV rows read a piece at a time are the rows read whole (decision 0174)", () => {
  const text =
    'Tên,Ghi chú,Số\r\n"Nguyễn Văn An","gọi lại, ""gấp""\r\nlúc 9h",1\r\nTrần Thị Bình,,2\r\n"","x""y",3';
  const whole = Papa.parse(text, { delimiter: "," }).data;
  for (const size of [1, 2, 3, 7, 50, 1000]) {
    const { rows, newline } = readInPieces(text, size);
    assert.deepEqual(rows, whole, `pieces of ${size}`);
    assert.equal(newline, "\r\n");
  }
  assert.deepEqual(readInPieces("a;b\nc;d\n", 3, ";").rows, [
    ["a", "b"],
    ["c", "d"],
  ]);
});

test("text pieces keep characters cut between pieces, in UTF-8 and Windows-1258", async () => {
  const text = "Nguyễn Văn An gọi 0912345678\n".repeat(50);
  let joined = "";
  for await (const piece of textPieces(blob(text), 7)) joined += piece.text;
  assert.equal(joined, text);
  const withBom = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), text]);
  joined = "";
  for await (const piece of textPieces(withBom, 5)) joined += piece.text;
  assert.equal(joined, text);
  // "Hà" in Windows-1258 is 48 E0: not UTF-8.
  joined = "";
  for await (const piece of textPieces(new Blob([new Uint8Array([0x48, 0xe0, 0x0a])]), 1))
    joined += piece.text;
  assert.equal(joined, "Hà\n");
});

test("line pieces keep every line ending, a \\r\\n cut in two included", async () => {
  const text = "một\r\nhai\nba\rbốn\r\n\r\nnăm";
  for (const size of [1, 2, 4, 100]) {
    const lines = [];
    for await (const piece of linePieces(blob(text), size)) lines.push(...piece.lines);
    assert.equal(lines.map((line) => line.text + line.ending).join(""), text, `pieces of ${size}`);
    assert.deepEqual(
      lines.map((line) => line.ending),
      ["\r\n", "\n", "\r", "\r\n", "\r\n", ""],
    );
  }
});

const findings = [
  {
    id: "TEN_1",
    alias: "[TEN_1_ab12]",
    value: "Nguyễn Văn An",
    label: "Họ và tên",
    reason: "",
    source: "",
  },
  { id: "TEN_2", alias: "[TEN_2_ab12]", value: "An", label: "Họ và tên", reason: "", source: "" },
  {
    id: "SDT_1",
    alias: "[SDT_1_ab12]",
    value: "0912345678",
    label: "Số điện thoại",
    reason: "",
    source: "",
  },
];

test("found values become their codes as whole words; kept values stay", () => {
  const masker = valueMasker(findings, new Set());
  assert.equal(
    masker.text("Nguyễn Văn An gọi 0912345678, An nhắn; Anh không"),
    "[TEN_1_ab12] gọi [SDT_1_ab12], [TEN_2_ab12] nhắn; Anh không",
  );
  assert.equal(masker.cell("TEN", "  An "), "[TEN_2_ab12]");
  assert.equal(masker.cell("SDT", "An"), "An", "a hidden column matches its own type");
  const keeping = valueMasker(findings, new Set(["[SDT_1_ab12]"]));
  assert.equal(keeping.text("số 0912345678"), "số 0912345678");
});

test("a CSV is surveyed and masked a piece at a time", async () => {
  const file = blob(
    'Sao kê tháng 10,,\nNgày,Khách hàng,Ghi chú\n01/10,Nguyễn Văn An,gọi 0912345678\n02/10,Trần Thị Bình,"An, hẹn lại"\n',
  );
  const seen = [];
  const survey = await surveyCsv(file, 20, (text) => seen.push(text));
  assert.equal(survey.headerRow, 1);
  assert.deepEqual(survey.header, ["Ngày", "Khách hàng", "Ghi chú"]);
  assert.equal(survey.sample.length, 2);
  assert.deepEqual(survey.columnChars, [10, 26, 25]);
  const plans = [
    { mode: "keep" },
    { mode: "hide", type: "TEN", label: "Họ và tên" },
    { mode: "scan" },
  ];
  assert.deepEqual(
    pieceCells([["01/10", "Nguyễn Văn An", "gọi 0912345678"]], 2, 1, plans).map((cell) => cell.key),
    ["2:2"],
  );
  const masker = valueMasker(
    [
      ...findings,
      {
        id: "TEN_3",
        alias: "[TEN_3_ab12]",
        value: "Trần Thị Bình",
        label: "",
        reason: "",
        source: "",
      },
    ],
    new Set(),
  );
  assert.equal(
    await collect(maskedCsv(file, 1, plans, masker)),
    '﻿Sao kê tháng 10,,\nNgày,Khách hàng,Ghi chú\n01/10,[TEN_1_ab12],gọi [SDT_1_ab12]\n02/10,[TEN_3_ab12],"[TEN_2_ab12], hẹn lại"\n',
  );
  assert.equal(
    await collect(maskedLines(blob("An gọi 0912345678\r\nhết"), masker)),
    "[TEN_2_ab12] gọi [SDT_1_ab12]\r\nhết",
  );
});

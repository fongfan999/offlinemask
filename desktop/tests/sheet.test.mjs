import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHeader, suggestColumn } from "../src/core/sheet/columns.ts";
import {
  AliasBook,
  applyEdits,
  cellKey,
  maskCell,
  maskTables,
  restoreTables,
  scanBatches,
  scanCells,
  splitDetections,
} from "../src/core/sheet/mask.ts";

const scope = "4aae";
const detection = (start, end, type, priority = 1) => ({
  start,
  end,
  type,
  label: type,
  source: "test",
  reason: "test",
  priority,
});
const mode = (plan) => (plan.mode === "hide" ? `hide:${plan.type}` : plan.mode);

test("headers suggest a plan in Vietnamese and English, without marks or punctuation", () => {
  assert.equal(normalizeHeader("Số ĐT (di động)"), "so dt di dong");
  const cases = {
    "Họ và tên": "hide:TEN",
    "Tên khách hàng": "hide:TEN",
    "Người nhận": "scan",
    "Tên người gửi/nhận": "scan",
    "Chủ tài khoản": "hide:TEN",
    "Số điện thoại": "hide:SDT",
    Email: "hide:EMAIL",
    "Số tài khoản": "hide:STK",
    "CCCD/CMND": "hide:CCCD",
    "Mã số thuế": "hide:GIAY_TO",
    "Địa chỉ thường trú": "hide:DIA_CHI",
    "Mã giao dịch": "hide:GD",
    "Mã KH": "hide:KH",
    "Ngày sinh": "hide:NGAY_SINH",
    "Ghi chú": "scan",
    "Nội dung chuyển khoản": "scan",
    "Số tiền (VND)": "keep",
    "Số dư": "keep",
    "Bên gửi/nhận": "scan",
    "Ngày giao dịch": "keep",
    "Tên sản phẩm": "keep",
    "Trạng thái": "keep",
  };
  for (const [header, expected] of Object.entries(cases))
    assert.equal(mode(suggestColumn(header, [])), expected, header);
});

test("unknown headers fall back to what the values look like", () => {
  assert.equal(mode(suggestColumn("Cột A", ["a@b.vn", "c@d.com", ""])), "hide:EMAIL");
  assert.equal(mode(suggestColumn("Cột B", ["0901 234 567", "+84912345678"])), "hide:SDT");
  assert.equal(mode(suggestColumn("Cột C", ["Nguyễn Minh Anh", "Trần Bình"])), "hide:TEN");
  assert.equal(
    mode(
      suggestColumn("Cột D", [
        "Khách gọi lại lúc 9 giờ để hỏi về khoản phí",
        "Đã xử lý xong yêu cầu hoàn tiền",
      ]),
    ),
    "scan",
  );
  assert.equal(mode(suggestColumn("Cột E", ["2500000", "750000"])), "keep");
  assert.equal(mode(suggestColumn("Cột F", [])), "keep");
});

test("the alias book gives one alias per type and value and skips aliases already in the file", () => {
  const book = new AliasBook(scope, (alias) => alias === `[TEN_1_${scope}]`);
  assert.equal(book.alias("TEN", "Họ và tên", "An"), `[TEN_2_${scope}]`);
  assert.equal(book.alias("TEN", "Họ và tên", "An"), `[TEN_2_${scope}]`);
  assert.equal(book.alias("SDT", "Số điện thoại", "An"), `[SDT_1_${scope}]`);
  assert.equal(book.findings.length, 2);
  assert.throws(() => new AliasBook("zz"));
});

test("a scanned cell replaces non-overlapping detections, preferring priority then length", () => {
  const book = new AliasBook(scope);
  const text = "Gọi An 0901234567";
  const out = maskCell(
    text,
    [detection(4, 6, "TEN"), detection(7, 17, "SDT", 5), detection(7, 12, "STK", 1)],
    book,
  );
  assert.equal(out, `Gọi [TEN_1_${scope}] [SDT_1_${scope}]`);
});

test("hidden and scanned columns mask every row with shared aliases; headers and kept columns stay", () => {
  const tables = [
    {
      name: "Giao dịch",
      headerRow: 0,
      preamble: [],
      header: ["Họ và tên", "Số tiền", "Ghi chú"],
      rows: [
        ["Nguyễn Minh Anh", "2500000", "Gọi 0901234567"],
        ["Nguyễn Minh Anh ", "750000", ""],
        ["Trần Bình", "100", "Không có"],
      ],
    },
  ];
  const columns = [
    [{ mode: "hide", type: "TEN", label: "Họ và tên" }, { mode: "keep" }, { mode: "scan" }],
  ];
  const cells = scanCells(tables, columns);
  assert.deepEqual(
    cells.map((cell) => cell.key),
    [cellKey(0, 1, 2), cellKey(0, 3, 2)],
  );
  const detections = new Map([[cellKey(0, 1, 2), [detection(4, 14, "SDT")]]]);
  const result = maskTables(tables, { columns, detections }, scope);
  const view = applyEdits(tables[0], result.edits[0]);
  assert.deepEqual(view.header, tables[0].header);
  assert.deepEqual(view.rows, [
    [`[TEN_1_${scope}]`, "2500000", `Gọi [SDT_1_${scope}]`],
    [`[TEN_1_${scope}]`, "750000", ""],
    [`[TEN_2_${scope}]`, "100", "Không có"],
  ]);
  assert.equal(result.masked, 4);
  assert.deepEqual(
    result.findings.map((finding) => [finding.alias, finding.value]),
    [
      [`[TEN_1_${scope}]`, "Nguyễn Minh Anh"],
      [`[SDT_1_${scope}]`, "0901234567"],
      [`[TEN_2_${scope}]`, "Trần Bình"],
    ],
  );
  assert.equal(applyEdits(tables[0], result.edits[0], 1).rows.length, 1);
});

test("a returned file restores known aliases in cells and headers and reports foreign ones", () => {
  const findings = [
    {
      id: "TEN_1",
      alias: `[TEN_1_${scope}]`,
      value: "Nguyễn Minh Anh",
      label: "",
      reason: "",
      source: "",
    },
  ];
  const returned = [
    {
      name: "Kết quả",
      headerRow: 0,
      preamble: [],
      header: ["Khách", `Tổng của [TEN_1_${scope}]`],
      rows: [
        [`[TEN_1_${scope}]`, "3250000"],
        ["[TEN_9_dead]", "1"],
      ],
    },
  ];
  const result = restoreTables(returned, findings);
  const view = applyEdits(returned[0], result.edits[0]);
  assert.deepEqual(view.header, ["Khách", "Tổng của Nguyễn Minh Anh"]);
  assert.deepEqual(view.rows, [
    ["Nguyễn Minh Anh", "3250000"],
    ["[TEN_9_dead]", "1"],
  ]);
  assert.equal(result.restored, 2);
  assert.deepEqual(result.unknown, ["[TEN_9_dead]"]);
});

test("scan batches stay under the limit and detections map back to their own cell", () => {
  const cells = [
    { key: "a", text: "Gọi An" },
    { key: "b", text: "x".repeat(25) },
    { key: "c", text: "Bình đây" },
  ];
  const batches = scanBatches(cells, 40);
  assert.deepEqual(
    batches.map((batch) => batch.parts.map((part) => part.key)),
    [["a", "b"], ["c"]],
  );
  const first = batches[0];
  const spans = splitDetections(first, [detection(4, 6, "TEN"), detection(4, 20, "TEN")]);
  assert.deepEqual(
    spans.get("a").map((d) => [d.start, d.end]),
    [
      [4, 6],
      [4, 6],
    ],
  );
  const second = splitDetections(batches[1], [detection(0, 4, "TEN")]);
  assert.deepEqual(
    second.get("c").map((d) => [d.start, d.end]),
    [[0, 4]],
  );
});

import ExcelJS from "exceljs";
import {
  decodeText,
  maxDataRows,
  openSheetFile,
  sheetFormat,
  writeSheetFile,
} from "../src/core/sheet/files.ts";

const editsOf = (entries) => [
  new Map(entries.map(([row, column, text]) => [row, new Map([[column, text]])])),
];

test("CSV keeps its delimiter and line breaks, reads Windows-1258, and writes UTF-8 with a BOM", async () => {
  assert.equal(sheetFormat("A.CSV"), "csv");
  assert.equal(sheetFormat("a.xls"), "xls");
  assert.equal(sheetFormat("a.xlsb"), null);
  const text = 'Họ tên;Số tiền\r\nNguyễn Minh Anh;"2.500,5"\r\nTrần Bình;100\r\n';
  const file = await openSheetFile(new TextEncoder().encode(text), "giao-dich.csv");
  assert.equal(file.source.delimiter, ";");
  assert.deepEqual(file.tables[0], {
    name: "giao-dich",
    headerRow: 0,
    preamble: [],
    header: ["Họ tên", "Số tiền"],
    rows: [
      ["Nguyễn Minh Anh", "2.500,5"],
      ["Trần Bình", "100"],
    ],
  });
  const out = await writeSheetFile(file.source, editsOf([[1, 0, "[TEN_1_4aae]"]]));
  assert.deepEqual([...out.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  // With ";" as the separator, "2.500,5" needs no quotes on the way out.
  assert.equal(decodeText(out), "Họ tên;Số tiền\r\n[TEN_1_4aae];2.500,5\r\nTrần Bình;100");
  // "Nguyễn" in Windows-1258 uses a combining tilde after "ê".
  const legacy = new Uint8Array([0x54, 0xea, 0xde, 0x6e, 0x0a, 0x41]);
  assert.equal(decodeText(legacy).normalize("NFC"), "Tễn\nA");
});

test("XLSX keeps every sheet, styles, numbers and formulas outside the edited cells", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Giao dịch");
  sheet.addRow(["Họ và tên", "Số tiền", "Ngày", "Tổng"]);
  sheet.getRow(1).font = { bold: true };
  sheet.addRow([
    "Nguyễn Minh Anh",
    2500000,
    new Date(Date.UTC(2026, 8, 8)),
    { formula: "B2*2", result: 5000000 },
  ]);
  sheet.getCell("B2").numFmt = "#,##0";
  sheet.getColumn(1).width = 30;
  workbook.addWorksheet("Trống");
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
  const file = await openSheetFile(bytes, "so.xlsx");
  assert.deepEqual(
    file.tables.map((table) => table.name),
    ["Giao dịch", "Trống"],
  );
  assert.deepEqual(file.tables[0].rows[0], ["Nguyễn Minh Anh", "2500000", "8/9/2026", "5000000"]);
  assert.equal(file.notes.length, 1);
  const out = await writeSheetFile(file.source, editsOf([[1, 0, "[TEN_1_4aae]"]]));
  const back = new ExcelJS.Workbook();
  await back.xlsx.load(out);
  const copy = back.getWorksheet("Giao dịch");
  assert.equal(copy.getCell("A2").value, "[TEN_1_4aae]");
  assert.equal(copy.getCell("B2").value, 2500000);
  assert.equal(copy.getCell("B2").numFmt, "#,##0");
  assert.equal(copy.getCell("D2").formula, "B2*2");
  assert.equal(copy.getRow(1).font.bold, true);
  assert.equal(copy.getColumn(1).width, 30);
  assert.ok(back.getWorksheet("Trống"));
});

test("files outside the supported scope are refused with a reason", async () => {
  await assert.rejects(openSheetFile(new Uint8Array(1), "a.numbers"), { code: "unsupported" });
  await assert.rejects(openSheetFile(new Uint8Array(21 * 1024 * 1024), "a.csv"), {
    code: "too-large",
  });
  await assert.rejects(openSheetFile(new TextEncoder().encode("\n\n"), "a.csv"), { code: "empty" });
  await assert.rejects(openSheetFile(new Uint8Array([1, 2, 3]), "a.xlsx"), { code: "unreadable" });
  const many = "a\n" + "1\n".repeat(maxDataRows + 1);
  await assert.rejects(openSheetFile(new TextEncoder().encode(many), "a.csv"), {
    code: "too-many-rows",
  });
});

import {
  decodePrivateSessions,
  encodePrivateSessions,
  encodeSessions,
  isPrivate,
  sessionTitle,
} from "../src/core/sessions.ts";
import { sessionPreview } from "../src/core/session-preview.ts";

function sheetSession() {
  return {
    id: "4aae0000-0000-4000-8000-000000000001",
    number: 3,
    format: "excel",
    fixture: "private-sheet-v1",
    createdAt: "2026-10-13T05:00:00.000Z",
    fileName: "Sổ khách.xlsx",
    mode: "columns",
    sheets: [
      {
        name: "Khách",
        rows: 1,
        plans: [
          { mode: "hide", type: "TEN", label: "Họ và tên" },
          { mode: "keep" },
          { mode: "scan" },
        ],
      },
    ],
    preview: [{ header: ["Tên", "Tiền", "Ghi chú"], rows: [[`[TEN_1_${scope}]`, "5", ""]] }],
    findings: [
      {
        id: "TEN_1",
        alias: `[TEN_1_${scope}]`,
        value: "An",
        label: "Họ và tên",
        reason: "r",
        source: "s",
      },
    ],
    masked: 1,
  };
}

test("spreadsheet sessions round-trip through the vault and never reach sample storage", () => {
  const session = sheetSession();
  assert.ok(isPrivate(session));
  assert.equal(sessionTitle(session), "Bảng tính #3");
  assert.equal(sessionPreview(session), "Sổ khách.xlsx");
  assert.deepEqual(decodePrivateSessions(encodePrivateSessions([session])), [session]);
  const stored = encodeSessions([session]);
  assert.ok(!stored.includes("Sổ khách") && !stored.includes("An"));
});

test("a damaged spreadsheet record invalidates the vault", () => {
  for (const damage of [
    (s) => (s.sheets[0].plans[0] = { mode: "hide", type: "bad type", label: "x" }),
    (s) => (s.findings[0].alias = "TEN_1"),
    (s) => (s.preview = []),
    (s) => (s.mode = "rows"),
    (s) => (s.preview[0].rows[0][0] = 5),
  ]) {
    const session = sheetSession();
    damage(session);
    assert.throws(() => decodePrivateSessions(encodePrivateSessions([session])));
  }
});

import { findHeaderRow } from "../src/core/sheet/files.ts";

test("a statement's title and summary lines sit above the header and are scanned, not used as columns", async () => {
  assert.equal(
    findHeaderRow([
      ["Họ tên", "Số tiền"],
      ["An", "5"],
    ]),
    0,
  );
  assert.equal(
    findHeaderRow([
      ["SAO KÊ", "", "", ""],
      ["Chủ tài khoản: An", "", "Số dư: 5", ""],
      ["", "", "", ""],
      ["Ngày", "Số tiền", "Người gửi/nhận", "Nội dung"],
      ["1/1/2025", "-5", "An", "QR"],
    ]),
    3,
  );
  // Rows of numbers or repeated merged text are never a header.
  assert.equal(
    findHeaderRow([
      ["1", "2", "3"],
      ["a", "b", "c"],
    ]),
    1,
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("SAO_KE");
  sheet.addRow(["SAO KÊ TÀI KHOẢN"]);
  sheet.mergeCells("A1:D1");
  sheet.addRow(["Chủ tài khoản: Nguyễn Minh Anh"]);
  sheet.mergeCells("A2:D2");
  sheet.addRow([]);
  sheet.addRow(["Ngày giao dịch", "Số tiền", "Người gửi/nhận", "Nội dung"]);
  sheet.addRow([new Date(Date.UTC(2025, 0, 1)), -1070761, "Nguyễn Minh Anh", "QR VIETTEL"]);
  const file = await openSheetFile(
    new Uint8Array(await workbook.xlsx.writeBuffer()),
    "sao-ke.xlsx",
  );
  const table = file.tables[0];
  assert.equal(table.headerRow, 3);
  assert.deepEqual(table.preamble[0], ["SAO KÊ TÀI KHOẢN", "", "", ""]);
  assert.deepEqual(table.header, ["Ngày giao dịch", "Số tiền", "Người gửi/nhận", "Nội dung"]);
  assert.deepEqual(table.rows, [["1/1/2025", "-1070761", "Nguyễn Minh Anh", "QR VIETTEL"]]);

  const columns = [
    table.header.map((header) =>
      suggestColumn(
        header,
        table.rows.map((row) => row[0]),
      ),
    ),
  ];
  assert.deepEqual(columns[0].map(mode), ["keep", "keep", "scan", "scan"]);
  const keys = scanCells([table], columns).map((cell) => cell.key);
  assert.ok(keys.includes(cellKey(0, 1, 0)), "preamble lines are scanned");
  const name = "Nguyễn Minh Anh";
  const detections = new Map([
    [cellKey(0, 1, 0), [detection(15, 15 + name.length, "TEN")]],
    [cellKey(0, 4, 2), [detection(0, name.length, "TEN")]],
    // A model span over an amount is ignored.
    [cellKey(0, 4, 1), [detection(1, 8, "TEN")]],
  ]);
  const result = maskTables([table], { columns, detections }, scope);
  const view = applyEdits(table, result.edits[0]);
  assert.deepEqual(view.preamble[1][0], `Chủ tài khoản: [TEN_1_${scope}]`);
  assert.deepEqual(view.rows[0], ["1/1/2025", "-1070761", `[TEN_1_${scope}]`, "QR VIETTEL"]);
  assert.ok(view.preambleChanged.has("1:0") && view.changed.has("0:2"));

  const out = await writeSheetFile(file.source, result.edits);
  const back = new ExcelJS.Workbook();
  await back.xlsx.load(out);
  const copy = back.getWorksheet("SAO_KE");
  assert.equal(copy.getCell("A2").value, `Chủ tài khoản: [TEN_1_${scope}]`);
  assert.equal(copy.getCell("C5").value, `[TEN_1_${scope}]`);
  assert.equal(copy.getCell("B5").value, -1070761);
  assert.equal(copy.getCell("A4").value, "Ngày giao dịch");
});

test("writing one opened workbook twice never carries the first copy's aliases into the second", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("A");
  sheet.addRow(["Tên", "SĐT"]);
  sheet.addRow(["An", "0901234567"]);
  const file = await openSheetFile(new Uint8Array(await workbook.xlsx.writeBuffer()), "a.xlsx");
  const first = await writeSheetFile(file.source, editsOf([[1, 0, "[TEN_1_4aae]"]]));
  const second = await writeSheetFile(file.source, editsOf([[1, 1, "[SDT_1_4aae]"]]));
  const read = async (bytes) => {
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(bytes);
    return [back.getWorksheet("A").getCell("A2").value, back.getWorksheet("A").getCell("B2").value];
  };
  assert.deepEqual(await read(first), ["[TEN_1_4aae]", "0901234567"]);
  assert.deepEqual(await read(second), ["An", "[SDT_1_4aae]"]);
});

test("in files, a model name without a capital letter is skipped; capitalized names stay", () => {
  const book = new AliasBook(scope);
  const text = "Thái tử ngộ đạo, gặp Nguyễn Minh Anh và trần bình";
  const out = maskCell(
    text,
    [
      detection(5, 7, "TEN"),
      detection(8, 11, "TEN"),
      detection(21, 36, "TEN"),
      detection(40, 49, "TEN"),
      detection(0, 4, "DIA_CHI"),
    ],
    book,
  );
  assert.equal(out, `[DIA_CHI_1_${scope}] tử ngộ đạo, gặp [TEN_1_${scope}] và trần bình`);
});

test("plain text decodes UTF-16 with a BOM and UTF-8 with or without one", () => {
  const text = "Nguyễn Minh Anh";
  const le = new Uint8Array(2 + text.length * 2);
  le.set([0xff, 0xfe]);
  for (let i = 0; i < text.length; i++)
    le.set([text.charCodeAt(i) & 0xff, text.charCodeAt(i) >> 8], 2 + i * 2);
  assert.equal(decodeText(le), text);
  assert.equal(decodeText(new TextEncoder().encode(text)), text);
  assert.equal(
    decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(text)])),
    text,
  );
});

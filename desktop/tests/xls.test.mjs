import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { openSheetFile, writeSheetFile } from "../src/core/sheet/files.ts";

function book(bookType) {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Sao kê tài khoản"],
    ["Họ tên", "Điện thoại", "Số tiền", "Ngày"],
    ["Nguyễn Minh Anh", "0901234567", 2500000, new Date(Date.UTC(2026, 9, 14))],
    ["Lê Ngọc Hà", "0912345678", 120000, new Date(Date.UTC(2026, 9, 15))],
  ]);
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  sheet["!cols"] = [{ wch: 24 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Giao dịch");
  return new Uint8Array(XLSX.write(workbook, { type: "array", bookType }));
}

test("a binary .xls opens like .xlsx and saves as .xlsx", async () => {
  const file = await openSheetFile(book("biff8"), "sao ke.xls");
  assert.equal(file.source.format, "xlsx");
  const [table] = file.tables;
  assert.equal(table.name, "Giao dịch");
  assert.deepEqual(table.preamble, [["Sao kê tài khoản", "", "", ""]]);
  assert.deepEqual(table.header, ["Họ tên", "Điện thoại", "Số tiền", "Ngày"]);
  assert.deepEqual(table.rows[0].slice(0, 3), ["Nguyễn Minh Anh", "0901234567", "2500000"]);
  assert.equal(table.rows[0][3], "14/10/2026");

  const edits = [new Map([[2, new Map([[0, "[TEN_1_4aae]"]])]])];
  const written = await writeSheetFile(file.source, edits);
  assert.equal(new TextDecoder().decode(written.subarray(0, 2)), "PK", "the copy is an .xlsx");
  const reopened = await openSheetFile(written, "sao ke (đã ẩn).xlsx");
  assert.deepEqual(reopened.tables[0].rows[0].slice(0, 3), [
    "[TEN_1_4aae]",
    "0901234567",
    "2500000",
  ]);
  assert.deepEqual(reopened.tables[0].rows[1].slice(0, 2), ["Lê Ngọc Hà", "0912345678"]);
  const sheet = reopened.source.sheets[0];
  assert.equal(sheet.getCell(1, 1).isMerged, true, "merged title stays merged");
  assert.equal(typeof sheet.getCell(3, 3).value, "number", "amounts stay numbers");
});

test("an Excel 5.0/95 .xls opens", async () => {
  // SheetJS writes BIFF5 text in an 8-bit code page without Vietnamese letters, so
  // this file is ASCII; real Excel 95 files in Windows-1258 use the bundled code pages.
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Ho ten", "Dien thoai"],
    ["Minh Anh", "0901234567"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const bytes = new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "biff5" }));
  const file = await openSheetFile(bytes, "cu.xls");
  assert.deepEqual(file.tables[0].rows, [["Minh Anh", "0901234567"]]);
});

test("an HTML table saved as .xls, as many banks export, opens", async () => {
  const html = new TextEncoder().encode(
    '<html><head><meta charset="utf-8"></head><body><table><tr><td>Họ tên</td><td>Số tài khoản</td></tr><tr><td>Trần Quốc Bảo</td><td>0071000123456</td></tr></table></body></html>',
  );
  const file = await openSheetFile(html, "statement.xls");
  assert.deepEqual(file.tables[0].header, ["Họ tên", "Số tài khoản"]);
  assert.equal(file.tables[0].rows[0][0], "Trần Quốc Bảo");
});

test("a damaged .xls is unreadable", async () => {
  const bytes = book("biff8").slice(0, 600);
  await assert.rejects(openSheetFile(bytes, "hong.xls"), { code: "unreadable" });
});

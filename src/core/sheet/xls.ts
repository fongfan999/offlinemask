import ExcelJS from "exceljs";
import { maxDataRows, SheetFileError, workbookFile, type OpenedFile } from "./files.ts";

/** Old Excel files (.xls, decision 0086): binary BIFF workbooks, and the HTML or XML
 * spreadsheets many banks export under that name. SheetJS reads them, in the file
 * worker and only when such a file is opened; the sheets become an in-memory ExcelJS
 * workbook, so masking, previews and saving work as for .xlsx, and the masked copy is
 * an .xlsx. Values, number formats, merged cells and column widths are carried over. */
export async function readXls(bytes: Uint8Array): Promise<OpenedFile> {
  const [XLSX, cptable] = await Promise.all([
    import("xlsx"),
    // Code pages for older files written in Windows-1258 and other legacy encodings.
    import("xlsx/dist/cpexcel.full.mjs"),
  ]);
  XLSX.set_cptable(cptable);
  let book: import("xlsx").WorkBook;
  try {
    book = XLSX.read(bytes, {
      type: "array",
      cellDates: true,
      cellNF: true,
      UTC: true,
      // Enough to tell the user the file is too long, without reading it all.
      sheetRows: maxDataRows + 200,
    });
  } catch {
    // Damaged, unknown, or password-protected.
    throw new SheetFileError("unreadable");
  }
  const workbook = new ExcelJS.Workbook();
  book.SheetNames.forEach((name, index) => {
    if (book.Workbook?.Sheets?.[index]?.Hidden === 2) return;
    const source = book.Sheets[name]!;
    const sheet = workbook.addWorksheet(name);
    const ref = source["!ref"];
    if (!ref) return;
    const range = XLSX.utils.decode_range(ref);
    for (let r = range.s.r; r <= range.e.r; r++)
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = source[XLSX.utils.encode_cell({ r, c })] as import("xlsx").CellObject;
        if (!cell || cell.t === "z") continue;
        const target = sheet.getCell(r + 1, c + 1);
        if (cell.t === "e") target.value = cell.w ?? "";
        else if (cell.t === "n" || cell.t === "b" || cell.t === "d") {
          target.value = cell.v as number | boolean | Date;
          if (typeof cell.z === "string" && cell.z !== "General") target.numFmt = cell.z;
        } else target.value = String(cell.v ?? "");
      }
    for (const merge of source["!merges"] ?? [])
      try {
        sheet.mergeCells(merge.s.r + 1, merge.s.c + 1, merge.e.r + 1, merge.e.c + 1);
      } catch {
        // Overlapping merges in a damaged file: the values are still there.
      }
    (source["!cols"] ?? []).forEach((column, index) => {
      if (column?.wch) sheet.getColumn(index + 1).width = column.wch;
    });
  });
  return workbookFile(workbook, [
    "Bản đã ẩn được lưu thành tệp .xlsx. Công thức được giữ bằng kết quả; màu và phông chữ không được giữ.",
  ]);
}

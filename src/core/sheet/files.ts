import ExcelJS from "exceljs";
import Papa from "papaparse";
import type { CellEdits, SheetTable } from "./mask.ts";

/** Supported input (decision 0076): ordinary .xlsx workbooks and .csv files, up to
 * these limits. Everything stays in memory on this machine. */
export const maxFileBytes = 20 * 1024 * 1024;
export const maxDataRows = 100_000;
export type SheetFormat = "xlsx" | "csv";
export type FileError = "unsupported" | "too-large" | "too-many-rows" | "unreadable" | "empty";

export function sheetFormat(fileName: string): SheetFormat | null {
  const extension = fileName.toLowerCase().split(".").pop();
  return extension === "xlsx" ? "xlsx" : extension === "csv" ? "csv" : null;
}

export interface CsvSource {
  format: "csv";
  rows: string[][];
  delimiter: string;
  newline: string;
}
export interface XlsxSource {
  format: "xlsx";
  workbook: ExcelJS.Workbook;
  sheets: ExcelJS.Worksheet[];
}
export type SheetSource = CsvSource | XlsxSource;
export interface OpenedFile {
  source: SheetSource;
  tables: SheetTable[];
  /** What the exported copy will not carry over, said before download. */
  notes: string[];
}

export class SheetFileError extends Error {
  readonly code: FileError;
  constructor(code: FileError) {
    super(code);
    this.code = code;
  }
}

/** UTF-8 (with or without BOM) first; Vietnamese Excel exports in Windows-1258 otherwise. */
export function decodeText(bytes: Uint8Array): string {
  const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(start));
  } catch {
    return new TextDecoder("windows-1258").decode(bytes);
  }
}

/** The header is the first row, within the top 30, that fills most columns with
 * distinct short labels. Bank statements and reports open with a title and a few
 * summary lines (often merged) before it; those rows are kept as the preamble. */
export function findHeaderRow(grid: readonly (readonly string[])[]): number {
  const width = grid.reduce((max, row) => Math.max(max, row.length), 0);
  const needed = Math.max(2, Math.ceil(width * 0.6));
  for (let index = 0; index < Math.min(grid.length, 30); index++) {
    const labels = (grid[index] ?? []).map((cell) => cell.trim()).filter(Boolean);
    if (
      labels.length >= needed &&
      new Set(labels).size === labels.length &&
      labels.every((label) => label.length <= 60 && !/^[-+\d.,:/\s]+$/.test(label))
    )
      return index;
  }
  return 0;
}

function tableFrom(name: string, grid: string[][]): SheetTable {
  const width = grid.reduce((max, row) => Math.max(max, row.length), 0);
  const pad = (row: string[]) => Array.from({ length: width }, (_, index) => row[index] ?? "");
  const headerRow = findHeaderRow(grid);
  return {
    name,
    headerRow,
    preamble: grid.slice(0, headerRow).map(pad),
    header: pad(grid[headerRow] ?? []),
    rows: grid.slice(headerRow + 1).map(pad),
  };
}
function checkRows(tables: readonly SheetTable[]) {
  const rows = tables.reduce((sum, table) => sum + table.rows.length, 0);
  if (rows > maxDataRows) throw new SheetFileError("too-many-rows");
  if (!tables.some((table) => table.header.some(Boolean) || table.rows.length))
    throw new SheetFileError("empty");
}

/** The separator used most in the header line, outside quotes. Excel in Vietnamese
 * locales writes ";", so a guess from whole rows (where amounts hold commas) misleads. */
export function guessDelimiter(text: string): string {
  const header = text.split(/\r\n|\n|\r/, 1)[0] ?? "";
  const counts = new Map<string, number>();
  let quoted = false;
  for (const char of header) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && [",", ";", "\t", "|"].includes(char))
      counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ",";
}

export function readCsv(bytes: Uint8Array, name: string): OpenedFile {
  const text = decodeText(bytes);
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: false,
    delimiter: guessDelimiter(text),
  });
  const rows = parsed.data;
  // A final line break leaves one empty row behind; drop it.
  while (rows.length && rows[rows.length - 1]!.every((cell) => cell === "")) rows.pop();
  const tables = [tableFrom(name.replace(/\.csv$/i, ""), rows)];
  checkRows(tables);
  return {
    source: {
      format: "csv",
      rows,
      delimiter: parsed.meta.delimiter || ",",
      newline: parsed.meta.linebreak || "\r\n",
    },
    tables,
    notes: [],
  };
}

/** Written as UTF-8 with a BOM so Excel shows Vietnamese correctly. */
export function writeCsv(source: CsvSource, edits: CellEdits): Uint8Array {
  const changes = edits[0];
  const rows = source.rows.map((row, index) =>
    row.map((text, column) => changes?.get(index)?.get(column) ?? text),
  );
  const text = Papa.unparse(rows, { delimiter: source.delimiter, newline: source.newline });
  const body = new TextEncoder().encode(text);
  const out = new Uint8Array(body.length + 3);
  out.set([0xef, 0xbb, 0xbf]);
  out.set(body, 3);
  return out;
}

const dateFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC" });
/** What a person sees in the cell, as text. */
export function cellText(cell: ExcelJS.Cell): string {
  // A merged range shows its value once, in its top-left cell.
  if (cell.isMerged && cell.master.address !== cell.address) return "";
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return dateFormat.format(value);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("formula" in value || "sharedFormula" in value) {
      const result = (value as ExcelJS.CellFormulaValue).result;
      if (result instanceof Date) return dateFormat.format(result);
      return result === undefined || result === null || typeof result === "object"
        ? ""
        : String(result);
    }
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("error" in value) return String(value.error);
  }
  return String(value);
}

export async function readXlsx(bytes: Uint8Array): Promise<OpenedFile> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  } catch {
    throw new SheetFileError("unreadable");
  }
  const sheets = workbook.worksheets.filter((sheet) => sheet.state !== "veryHidden");
  const tables = sheets.map((sheet) => {
    const grid: string[][] = [];
    const width = sheet.columnCount;
    for (let r = 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      grid.push(Array.from({ length: width }, (_, c) => cellText(row.getCell(c + 1))));
    }
    while (grid.length && grid[grid.length - 1]!.every((cell) => cell === "")) grid.pop();
    return tableFrom(sheet.name, grid);
  });
  checkRows(tables);
  return {
    source: { format: "xlsx", workbook, sheets },
    tables,
    notes: ["Biểu đồ, bảng tổng hợp (pivot) và macro không được giữ lại trong tệp tải về."],
  };
}

/** Edited cells become plain text; every other cell keeps its value, formula and style. */
export async function writeXlsx(source: XlsxSource, edits: CellEdits): Promise<Uint8Array> {
  source.sheets.forEach((sheet, index) => {
    edits[index]?.forEach((columns, row) =>
      columns.forEach((text, column) => {
        sheet.getRow(row + 1).getCell(column + 1).value = text;
      }),
    );
  });
  const buffer = await source.workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

export async function openSheetFile(bytes: Uint8Array, name: string): Promise<OpenedFile> {
  const format = sheetFormat(name);
  if (!format) throw new SheetFileError("unsupported");
  if (bytes.byteLength > maxFileBytes) throw new SheetFileError("too-large");
  if (format === "csv") {
    try {
      return readCsv(bytes, name);
    } catch (error) {
      throw error instanceof SheetFileError ? error : new SheetFileError("unreadable");
    }
  }
  return readXlsx(bytes);
}

export function writeSheetFile(source: SheetSource, edits: CellEdits): Promise<Uint8Array> {
  return source.format === "csv"
    ? Promise.resolve(writeCsv(source, edits))
    : writeXlsx(source, edits);
}

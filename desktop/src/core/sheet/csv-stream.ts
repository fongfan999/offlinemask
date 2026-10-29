import Papa from "papaparse";
import { CsvReader, linePieces, textPieces, type ValueMasker } from "../stream.ts";
import type { ColumnPlan } from "./columns.ts";
import { findHeaderRow, guessDelimiter } from "./files.ts";

/** A CSV file read a piece at a time (decision 0174): its rows, numbered as in the file,
 * with the delimiter guessed from the header line as for a file opened whole. */
export async function* csvPieces(
  file: Blob,
): AsyncGenerator<{ rows: string[][]; first: number; read: number; reader: CsvReader }> {
  let reader: CsvReader | null = null;
  let first = 0;
  let read = 0;
  for await (const piece of textPieces(file)) {
    reader ??= new CsvReader(guessDelimiter(piece.text));
    read = piece.read;
    const rows = reader.feed(piece.text);
    yield { rows, first, read, reader };
    first += rows.length;
  }
  if (reader) yield { rows: reader.finish(), first, read, reader };
}

/** What choosing columns and the estimate need, read in one pass: the header (within
 * the first 30 rows, decision 0076), the lines above it, the first rows to choose by,
 * and how many characters each column holds. */
export interface CsvSurvey {
  headerRow: number;
  preamble: string[][];
  header: string[];
  sample: string[][];
  columnChars: number[];
  preambleChars: number;
}
export async function surveyCsv(
  file: Blob,
  sampleRows: number,
  /** Each cell that may hold a code already, so new codes never repeat it. */
  seen: (text: string) => void,
): Promise<CsvSurvey> {
  const head: string[][] = [];
  let survey: CsvSurvey | null = null;
  const count = (row: string[]) =>
    row.forEach((text, column) => {
      if (!text.trim()) return;
      survey!.columnChars[column] = (survey!.columnChars[column] ?? 0) + text.length;
      if (text.includes("[")) seen(text);
    });
  const settle = () => {
    const width = head.reduce((max, row) => Math.max(max, row.length), 0);
    const pad = (row: string[]) => Array.from({ length: width }, (_, index) => row[index] ?? "");
    const headerRow = findHeaderRow(head);
    const preamble = head.slice(0, headerRow).map(pad);
    survey = {
      headerRow,
      preamble,
      header: pad(head[headerRow] ?? []),
      sample: [],
      columnChars: Array.from({ length: width }, () => 0),
      preambleChars: preamble.flat().reduce((sum, text) => sum + text.length, 0),
    };
    preamble.flat().forEach((text) => text.includes("[") && seen(text));
    for (const row of head.slice(headerRow + 1)) take(row);
  };
  const take = (row: string[]) => {
    if (survey!.sample.length < sampleRows)
      survey!.sample.push(survey!.header.map((_, index) => row[index] ?? ""));
    count(row);
  };
  for await (const { rows } of csvPieces(file))
    for (const row of rows) {
      if (survey) take(row);
      else if (head.push(row) >= 30) settle();
    }
  if (!survey) settle();
  return survey!;
}

/** Every cell the model reads in one piece: the lines above the header and the scanned
 * columns, keyed by row and column. */
export function pieceCells(
  rows: readonly string[][],
  first: number,
  headerRow: number,
  plans: readonly ColumnPlan[],
): { key: string; text: string }[] {
  const cells: { key: string; text: string }[] = [];
  rows.forEach((row, index) => {
    const at = first + index;
    if (at === headerRow) return;
    row.forEach((text, column) => {
      if (text.trim() && (at < headerRow || plans[column]?.mode === "scan"))
        cells.push({ key: `${at}:${column}`, text });
    });
  });
  return cells;
}

/** The masked copy, a piece at a time, as UTF-8 with a BOM like a CSV saved whole. */
export async function* maskedCsv(
  file: Blob,
  headerRow: number,
  plans: readonly ColumnPlan[],
  masker: ValueMasker,
): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  yield new Uint8Array([0xef, 0xbb, 0xbf]);
  for await (const { rows, first, reader } of csvPieces(file)) {
    if (!rows.length) continue;
    const masked = rows.map((row, index) => {
      const at = first + index;
      if (at === headerRow) return row;
      return row.map((text, column) => {
        if (!text.trim()) return text;
        if (at < headerRow) return masker.text(text);
        const plan = plans[column];
        if (plan?.mode === "hide") return masker.cell(plan.type, text);
        return plan?.mode === "scan" ? masker.text(text) : text;
      });
    });
    const newline = reader.newline || "\r\n";
    yield encoder.encode(Papa.unparse(masked, { delimiter: reader.delimiter, newline }) + newline);
  }
}

/** A text file's masked copy, line by line, as UTF-8 like a text file saved whole. */
export async function* maskedLines(file: Blob, masker: ValueMasker): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  for await (const { lines } of linePieces(file))
    yield encoder.encode(lines.map((line) => masker.text(line.text) + line.ending).join(""));
}

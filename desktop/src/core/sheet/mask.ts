import type { Detection } from "../detection/types.ts";
import { keepAliases } from "../file-review.ts";
import type { Finding } from "../review.ts";
import { restoreAliases } from "../restore.ts";
import type { ColumnPlan } from "./columns.ts";

/** One sheet as the app sees it, as display strings: optional lines above the
 * header (a title, account summary), the header row and the data rows. The worker
 * keeps the real workbook; only these strings cross to the page. */
export interface SheetTable {
  name: string;
  /** Index of the header in the sheet's rows (0 when the file starts with it). */
  headerRow: number;
  preamble: string[][];
  header: string[];
  rows: string[][];
}
/** Changed cells per sheet, keyed by the row's index in the sheet, then column. */
export type CellEdits = Map<number, Map<number, string>>[];
/** Every row of a table with its index in the sheet. */
function* sheetRows(
  table: SheetTable,
): Generator<[number, string[], "preamble" | "header" | "data"]> {
  for (const [index, row] of table.preamble.entries()) yield [index, row, "preamble"];
  yield [table.headerRow, table.header, "header"];
  for (const [index, row] of table.rows.entries()) yield [table.headerRow + 1 + index, row, "data"];
}
/** Names, organizations and addresses always contain letters; a model span over
 * digits only (an amount, a date) is a misreading and is ignored. */
const needsLetters = new Set(["TEN", "TO_CHUC", "DIA_CHI"]);

/** Same type and value, same alias, everywhere in the file (and in restore). */
export class AliasBook {
  readonly findings: Finding[] = [];
  private readonly byKey = new Map<string, Finding>();
  private readonly counters = new Map<string, number>();
  private readonly scope: string;
  /** True when an alias text already occurs in the file and must not be reused. */
  private readonly taken: (alias: string) => boolean;
  constructor(scope: string, taken: (alias: string) => boolean = () => false) {
    if (!/^[a-f0-9]{4,8}$/i.test(scope)) throw new Error("Invalid alias scope");
    this.scope = scope;
    this.taken = taken;
  }
  alias(type: string, label: string, value: string, source = "Cột đã chọn"): string {
    const key = `${type}:${value}`;
    const known = this.byKey.get(key);
    if (known) return known.alias;
    let count = this.counters.get(type) ?? 0;
    let alias: string;
    do alias = `[${type}_${++count}_${this.scope}]`;
    while (this.taken(alias));
    this.counters.set(type, count);
    const finding: Finding = {
      id: `${type}_${count}`,
      alias,
      value,
      label,
      reason: source === "Cột đã chọn" ? "Cả cột được ẩn." : "Phát hiện trong ô.",
      source,
    };
    this.byKey.set(key, finding);
    this.findings.push(finding);
    return alias;
  }
}

/** Detected spans to replace in one text, earliest and highest-priority first, as
 * alias replacements. Shared by spreadsheet cells and Word paragraphs, which are
 * formal written text: there a person's name is capitalized, so a name span without
 * a capital letter ("tử", "ngàn", "sân hận") is a misreading and is skipped
 * (decision 0079). The text page keeps every span: chat often has lowercase names. */
export function detectionReplacements(
  text: string,
  detections: readonly Detection[],
  book: AliasBook,
): { start: number; end: number; text: string }[] {
  const ordered = [...detections]
    .filter((d) => d.start >= 0 && d.end <= text.length && d.end > d.start)
    .filter((d) => !needsLetters.has(d.type) || /\p{L}/u.test(text.slice(d.start, d.end)))
    .filter((d) => d.type !== "TEN" || /\p{Lu}/u.test(text.slice(d.start, d.end)))
    .sort(
      (a, b) => b.priority - a.priority || b.end - b.start - (a.end - a.start) || a.start - b.start,
    );
  const taken: Detection[] = [];
  for (const detection of ordered)
    if (!taken.some((other) => other.start < detection.end && other.end > detection.start))
      taken.push(detection);
  return taken
    .sort((a, b) => a.start - b.start)
    .map((detection) => ({
      start: detection.start,
      end: detection.end,
      text: book.alias(
        detection.type,
        detection.label,
        text.slice(detection.start, detection.end),
        "Bạn đã quét",
      ),
    }));
}
/** Replace detected spans in one cell. */
export function maskCell(text: string, detections: readonly Detection[], book: AliasBook): string {
  let output = "";
  let cursor = 0;
  for (const replacement of detectionReplacements(text, detections, book)) {
    output += text.slice(cursor, replacement.start) + replacement.text;
    cursor = replacement.end;
  }
  return output + text.slice(cursor);
}

export interface MaskPlan {
  /** Per sheet, per column. */
  columns: ColumnPlan[][];
  /** Detector results for scanned cells, keyed by `sheet:row:column`. */
  detections: ReadonlyMap<string, readonly Detection[]>;
}
export const cellKey = (sheet: number, row: number, column: number) => `${sheet}:${row}:${column}`;

/** Cells the detector must read: every non-empty cell of a scanned column, and
 * every line above the header (titles and summaries often name the account holder). */
export function scanCells(
  tables: readonly SheetTable[],
  columns: readonly ColumnPlan[][],
): { key: string; text: string }[] {
  const cells: { key: string; text: string }[] = [];
  tables.forEach((table, sheet) => {
    for (const [row, values, part] of sheetRows(table)) {
      if (part === "header") continue;
      values.forEach((text, column) => {
        if ((part === "preamble" || columns[sheet]?.[column]?.mode === "scan") && text.trim())
          cells.push({ key: cellKey(sheet, row, column), text });
      });
    }
  });
  return cells;
}

/** Apply the plan to every data row; lines above the header are scanned. Headers
 * are never masked. */
export function maskTables(
  tables: readonly SheetTable[],
  plan: MaskPlan,
  scope: string,
): { edits: CellEdits; findings: Finding[]; masked: number } {
  const existing = tables
    .flatMap((table) => [...table.preamble, ...table.rows].flat())
    .filter((text) => text.includes("["));
  const book = new AliasBook(scope, (alias) => existing.some((text) => text.includes(alias)));
  let masked = 0;
  const edits: CellEdits = tables.map((table, sheet) => {
    const changes = new Map<number, Map<number, string>>();
    for (const [row, values, part] of sheetRows(table)) {
      if (part === "header") continue;
      values.forEach((text, column) => {
        if (!text.trim()) return;
        const choice: ColumnPlan | undefined =
          part === "preamble" ? { mode: "scan" } : plan.columns[sheet]?.[column];
        if (!choice || choice.mode === "keep") return;
        const next =
          choice.mode === "hide"
            ? book.alias(choice.type, choice.label, text.trim())
            : maskCell(text, plan.detections.get(cellKey(sheet, row, column)) ?? [], book);
        if (next === text) return;
        masked++;
        if (!changes.has(row)) changes.set(row, new Map());
        changes.get(row)!.set(column, next);
      });
    }
    return changes;
  });
  return { edits, findings: book.findings, masked };
}

/** Swap this file's aliases back in every cell of a returned file, headers included
 * (an AI may name a column after an alias). */
export function restoreTables(
  tables: readonly SheetTable[],
  findings: readonly Finding[],
): { edits: CellEdits; restored: number; unknown: string[] } {
  const analysis = { findings: [...findings], spans: [] };
  const unknown = new Set<string>();
  let restored = 0;
  const edits: CellEdits = tables.map((table) => {
    const changes = new Map<number, Map<number, string>>();
    for (const [row, values] of sheetRows(table))
      values.forEach((text, column) => {
        if (!text.includes("[")) return;
        const result = restoreAliases(text, analysis);
        result.unknown.forEach((alias) => unknown.add(alias));
        if (!result.restored) return;
        restored += result.restored;
        if (!changes.has(row)) changes.set(row, new Map());
        changes.get(row)!.set(column, result.text);
      });
    return changes;
  });
  return { edits, restored, unknown: [...unknown] };
}

/** A table with edits applied, for previews. `changed` holds `row:column` keys with
 * the header as row -1 and data rows from 0; `preambleChanged` the same for preamble lines. */
export function applyEdits(
  table: SheetTable,
  edits: Map<number, Map<number, string>> | undefined,
  limit = Infinity,
): {
  preamble: string[][];
  header: string[];
  rows: string[][];
  changed: Set<string>;
  preambleChanged: Set<string>;
} {
  const changed = new Set<string>();
  const preambleChanged = new Set<string>();
  const edit = (
    row: number,
    values: readonly string[],
    key: (column: number) => string,
    into: Set<string>,
  ) =>
    values.map((text, column) => {
      const next = edits?.get(row)?.get(column);
      if (next !== undefined) into.add(key(column));
      return next ?? text;
    });
  return {
    preamble: table.preamble.map((values, row) =>
      edit(row, values, (column) => `${row}:${column}`, preambleChanged),
    ),
    header: edit(table.headerRow, table.header, (column) => `-1:${column}`, changed),
    rows: table.rows
      .slice(0, limit)
      .map((values, index) =>
        edit(table.headerRow + 1 + index, values, (column) => `${index}:${column}`, changed),
      ),
    changed,
    preambleChanged,
  };
}

/** Scanned cells go to the detector in batches of whole cells joined by blank lines,
 * well under the text page's 50 000-character limit; spans are mapped back per cell. */
export const scanSeparator = "\n\n";
export function scanBatches(
  cells: readonly { key: string; text: string }[],
  maxChars = 40_000,
): { text: string; parts: { key: string; start: number; end: number }[] }[] {
  const batches: { text: string; parts: { key: string; start: number; end: number }[] }[] = [];
  let current: (typeof batches)[number] | undefined;
  for (const cell of cells) {
    const text = cell.text.slice(0, maxChars);
    if (!current || current.text.length + scanSeparator.length + text.length > maxChars) {
      current = { text: "", parts: [] };
      batches.push(current);
    } else current.text += scanSeparator;
    const start = current.text.length;
    current.text += text;
    current.parts.push({ key: cell.key, start, end: current.text.length });
  }
  return batches;
}
export function splitDetections(
  batch: { parts: readonly { key: string; start: number; end: number }[] },
  detections: readonly Detection[],
  into: Map<string, Detection[]> = new Map(),
): Map<string, Detection[]> {
  for (const detection of detections)
    // A span over the separator belongs to every cell it touches, clipped to each.
    for (const part of batch.parts) {
      if (detection.start >= part.end || detection.end <= part.start) continue;
      const start = Math.max(detection.start, part.start) - part.start;
      const end = Math.min(detection.end, part.end) - part.start;
      if (end <= start) continue;
      const list = into.get(part.key) ?? [];
      list.push({ ...detection, start, end });
      into.set(part.key, list);
    }
  return into;
}

/** The file's edits without the values the user chose to keep (decision 0079): those
 * go back to their original text, and a cell with nothing left hidden is not edited. */
export function keepCells(
  edits: CellEdits,
  findings: readonly Finding[],
  kept: ReadonlySet<string>,
): CellEdits {
  if (!kept.size) return edits;
  const values = new Map(findings.map((finding) => [finding.alias, finding.value]));
  return edits.map((sheet) => {
    const changes = new Map<number, Map<number, string>>();
    for (const [row, cells] of sheet)
      for (const [column, text] of cells) {
        const next = keepAliases(text, values, kept);
        if (next === null) continue;
        if (!changes.has(row)) changes.set(row, new Map());
        changes.get(row)!.set(column, next);
      }
    return changes;
  });
}
/** Every masked cell's text, for counting aliases. */
export function* editedTexts(edits: CellEdits): Generator<string> {
  for (const sheet of edits) for (const cells of sheet.values()) yield* cells.values();
}
export const editedCells = (edits: CellEdits) =>
  edits.reduce((sum, sheet) => sum + [...sheet.values()].reduce((n, c) => n + c.size, 0), 0);

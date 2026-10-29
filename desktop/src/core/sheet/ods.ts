import JSZip from "jszip";
import { escapeXml, unescapeXml } from "../doc/docx.ts";
import { cleanOdfPackage, odfAuthors } from "../doc/odt.ts";
import type { CellEdits } from "./mask.ts";

/** OpenDocument spreadsheets (.ods, decision 0085), as LibreOffice writes them. The
 * sheets are read from `content.xml` with a tag scanner; the masked copy is the same
 * package with only the hidden cells rewritten, so every other cell keeps its value,
 * formula and style, and the copy stays an .ods. */
export const odsMimeType = "application/vnd.oasis.opendocument.spreadsheet";

interface OdsCell {
  /** The whole cell element in content.xml. */
  start: number;
  end: number;
  /** The opening tag, and whether the cell is a single self-closing tag. */
  open: string;
  selfClosing: boolean;
  column: number;
  repeat: number;
  text: string;
}
interface OdsRow {
  start: number;
  end: number;
  open: string;
  /** Index of the row's first copy in the sheet's grid. */
  row: number;
  repeat: number;
  cells: OdsCell[];
}
export interface OdsSource {
  format: "ods";
  zip: JSZip;
  xml: string;
  sheets: { name: string; rows: OdsRow[] }[];
}

const tag = /<(\/?)([A-Za-z_][\w.:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
const isCell = (element: string) =>
  element === "table:table-cell" || element === "table:covered-table-cell";
const repeatOf = (attributes: string, name: string) =>
  Math.max(1, Number(new RegExp(`${name}="(\\d+)"`).exec(attributes)?.[1] ?? 1));
const attribute = (attributes: string, name: string) =>
  new RegExp(`${name}="([^"]*)"`).exec(attributes)?.[1];

/** A tag with one attribute set to a value, or removed when `value` is null. */
export function withAttribute(open: string, name: string, value: string | null): string {
  const pattern = new RegExp(`\\s${name}="[^"]*"`);
  const without = open.replace(pattern, "");
  if (value === null) return without;
  return without.replace(/^(<[\w.:-]+)/, `$1 ${name}="${value}"`);
}

/** Read every sheet of the spreadsheet: rows, cells (with their repeats) and the text
 * a person sees in each cell. Comments in a cell are not its text. Covered cells (the
 * hidden part of a merged range) read as empty, like Excel's merged cells. */
export function parseOds(xml: string): OdsSource["sheets"] {
  const sheets: OdsSource["sheets"] = [];
  let sheet: OdsSource["sheets"][number] | undefined;
  let row: OdsRow | undefined;
  let cell: (OdsCell & { lines: string[]; inParagraph: boolean }) | undefined;
  let annotation = 0;
  let previousEnd = 0;
  let nextRow = 0;
  let nextColumn = 0;
  tag.lastIndex = 0;
  for (let match = tag.exec(xml); match; match = tag.exec(xml)) {
    const [whole, closing, , attributes = "", selfClosing] = match;
    const element = match[2]!;
    if (cell?.inParagraph && !annotation && match.index > previousEnd)
      cell.lines[cell.lines.length - 1] += unescapeXml(xml.slice(previousEnd, match.index)).replace(
        /[ \t\r\n]+/g,
        " ",
      );
    previousEnd = match.index + whole.length;
    if (element === "office:annotation") {
      if (!selfClosing) annotation += closing ? -1 : 1;
      continue;
    }
    if (element === "table:table") {
      if (closing) sheet = undefined;
      else if (!selfClosing) {
        sheet = { name: unescapeXml(attribute(attributes, "table:name") ?? ""), rows: [] };
        sheets.push(sheet);
        nextRow = 0;
      }
      continue;
    }
    if (!sheet) continue;
    if (element === "table:table-row") {
      if (closing && row) {
        row.end = previousEnd;
        sheet.rows.push(row);
        nextRow += row.repeat;
        row = undefined;
      } else if (!closing && !selfClosing) {
        row = {
          start: match.index,
          end: 0,
          open: whole,
          row: nextRow,
          repeat: repeatOf(attributes, "table:number-rows-repeated"),
          cells: [],
        };
        nextColumn = 0;
      }
      continue;
    }
    if (!row) continue;
    if (isCell(element)) {
      if (closing) {
        if (cell) {
          cell.end = previousEnd;
          row.cells.push({
            start: cell.start,
            end: cell.end,
            open: cell.open,
            selfClosing: cell.selfClosing,
            column: cell.column,
            repeat: cell.repeat,
            text: element === "table:covered-table-cell" ? "" : cell.lines.join("\n").trim(),
          });
          cell = undefined;
        }
        continue;
      }
      const repeat = repeatOf(attributes, "table:number-columns-repeated");
      const base = {
        start: match.index,
        end: previousEnd,
        open: whole,
        selfClosing: !!selfClosing,
        column: nextColumn,
        repeat,
        text: "",
      };
      nextColumn += repeat;
      if (selfClosing) row.cells.push(base);
      else cell = { ...base, lines: [], inParagraph: false };
      continue;
    }
    if (!cell || annotation) continue;
    if (element === "text:p" || element === "text:h") {
      if (!closing && !selfClosing) {
        cell.lines.push("");
        cell.inParagraph = true;
      } else if (closing) cell.inParagraph = false;
      continue;
    }
    if (cell.inParagraph && selfClosing) {
      const literal =
        element === "text:tab"
          ? "\t"
          : element === "text:line-break"
            ? "\n"
            : element === "text:s"
              ? " ".repeat(Math.min(repeatOf(attributes, "text:c"), 1000))
              : "";
      cell.lines[cell.lines.length - 1] += literal;
    }
  }
  // Sheets end with a long run of empty rows (often a million); they are not data.
  for (const { rows } of sheets) {
    let last = rows.length - 1;
    while (last >= 0 && !rows[last]!.cells.some((c) => c.text)) last--;
    rows.length = last + 1;
  }
  return sheets;
}

/** The grid of display strings for one sheet, as the spreadsheet flow expects. Empty
 * rows are kept only between rows with text: ODS files often end with one empty row
 * repeated a million times, which would otherwise become a million-row grid. */
export function odsGrid(rows: readonly OdsRow[]): string[][] {
  const width = Math.max(
    0,
    ...rows.flatMap((r) => r.cells.filter((c) => c.text).map((c) => c.column + c.repeat)),
  );
  const grid: string[][] = [];
  let blank = 0;
  for (const r of rows) {
    if (!r.cells.some((c) => c.text)) {
      blank += r.repeat;
      continue;
    }
    for (; blank > 0; blank--) grid.push(Array.from({ length: width }, () => ""));
    const values = Array.from({ length: width }, () => "");
    for (const c of r.cells)
      if (c.text)
        for (let k = 0; k < c.repeat && c.column + k < width; k++) values[c.column + k] = c.text;
    for (let k = 0; k < r.repeat; k++) grid.push(k ? [...values] : values);
  }
  return grid;
}

export async function readOdsPackage(bytes: Uint8Array): Promise<JSZip | null> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    return null;
  }
  if ((await zip.file("mimetype")?.async("string"))?.trim() !== odsMimeType) return null;
  const manifest = (await zip.file("META-INF/manifest.xml")?.async("string")) ?? "";
  if (manifest.includes("manifest:encryption-data") || !zip.file("content.xml")) return null;
  return zip;
}

/** A hidden value replaces the whole cell: it becomes a plain text cell (as in .xlsx),
 * keeping its style; value, formula and comment go, as they would show the original. */
function maskedCell(cell: OdsCell, text: string): string {
  let open = cell.open.replace(/\s*\/>$/, ">");
  for (const name of [
    "office:value",
    "office:date-value",
    "office:time-value",
    "office:boolean-value",
    "office:string-value",
    "office:currency",
    "table:formula",
    "table:number-columns-repeated",
    "calcext:value-type",
  ])
    open = withAttribute(open, name, null);
  open = withAttribute(open, "office:value-type", "string");
  const lines = text
    .split("\n")
    .map((line) => `<text:p>${escapeXml(line)}</text:p>`)
    .join("");
  return `${open}${lines}</table:table-cell>`;
}
/** The cell's original XML with a different column repeat. */
function repeatedCell(xml: string, cell: OdsCell, repeat: number): string {
  const whole = xml.slice(cell.start, cell.end);
  const open = withAttribute(
    cell.open,
    "table:number-columns-repeated",
    repeat > 1 ? String(repeat) : null,
  );
  return open + whole.slice(cell.open.length);
}
function rowCopy(xml: string, row: OdsRow, edits: Map<number, string> | undefined, repeat = 1) {
  const open = withAttribute(
    row.open,
    "table:number-rows-repeated",
    repeat > 1 ? String(repeat) : null,
  );
  const cellsStart = row.start + row.open.length;
  if (!edits?.size) return open + xml.slice(cellsStart, row.end);
  let out = open;
  let cursor = cellsStart;
  for (const cell of row.cells) {
    const edited = [...edits.keys()].filter(
      (column) => column >= cell.column && column < cell.column + cell.repeat,
    );
    if (!edited.length) continue;
    out += xml.slice(cursor, cell.start);
    // Split a repeated cell around each edited copy.
    let k = 0;
    while (k < cell.repeat) {
      const text = edits.get(cell.column + k);
      if (text !== undefined) {
        out += maskedCell(cell, text);
        k++;
        continue;
      }
      let run = 0;
      while (k + run < cell.repeat && !edits.has(cell.column + k + run)) run++;
      out += repeatedCell(xml, cell, run);
      k += run;
    }
    cursor = cell.end;
  }
  return out + xml.slice(cursor, row.end);
}

/** Write a copy with the edits applied; the opened source is not changed. */
export async function writeOds(source: OdsSource, edits: CellEdits): Promise<Uint8Array> {
  const changes: { start: number; end: number; xml: string }[] = [];
  source.sheets.forEach((sheet, index) => {
    const sheetEdits = edits[index];
    if (!sheetEdits?.size) return;
    for (const row of sheet.rows) {
      const touched = [...sheetEdits.keys()].some((r) => r >= row.row && r < row.row + row.repeat);
      if (!touched) continue;
      let xml = "";
      let k = 0;
      // Split a repeated row around each edited copy.
      while (k < row.repeat) {
        const rowEdits = sheetEdits.get(row.row + k);
        if (rowEdits?.size) {
          xml += rowCopy(source.xml, row, rowEdits);
          k++;
          continue;
        }
        let run = 0;
        while (k + run < row.repeat && !sheetEdits.get(row.row + k + run)?.size) run++;
        xml += rowCopy(source.xml, row, undefined, run);
        k += run;
      }
      changes.push({ start: row.start, end: row.end, xml });
    }
  });
  let content = "";
  let cursor = 0;
  for (const change of changes.sort((a, b) => a.start - b.start)) {
    content += source.xml.slice(cursor, change.start) + change.xml;
    cursor = change.end;
  }
  content = (content + source.xml.slice(cursor)).replace(odfAuthors, "<$1></$1>");
  const zip = await JSZip.loadAsync(await source.zip.generateAsync({ type: "uint8array" }));
  zip.file("content.xml", content);
  return cleanOdfPackage(zip, odsMimeType);
}

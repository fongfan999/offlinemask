import JSZip from "jszip";
import type { Finding } from "../review.ts";

/** Word support (decision 0078): ordinary .docx files, read and written in memory.
 * Text lives in `<w:t>` runs inside `<w:p>` paragraphs; detection reads whole
 * paragraphs and replacements are written back into the runs they cover, so the
 * formatting of every run is kept. A small tag scanner is enough for Word's
 * well-formed XML and works inside a worker, where DOMParser does not exist. */
export type DocError =
  | "unsupported"
  | "unreadable"
  | "empty"
  // PDF only (decision 0149).
  | "password"
  | "scanned"
  | "old-font"
  | "cancelled";
export class DocFileError extends Error {
  readonly code: DocError;
  constructor(code: DocError) {
    super(code);
    this.code = code;
  }
}

/** Parts that hold document text: body (with tables and text boxes), headers,
 * footers, footnotes, endnotes and comments. */
const textPart = /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/;

export interface Segment {
  /** Offsets of the opening tag and of the text inside it in the part's XML. */
  openStart: number;
  openEnd: number;
  textStart: number;
  textEnd: number;
  text: string;
  field?: boolean;
}
/** A paragraph is runs of text (segment indices) and literal tabs or line breaks. */
export type Piece = { segment: number } | { literal: string };
export interface PartModel {
  name: string;
  xml: string;
  segments: Segment[];
  paragraphs: Piece[][];
  /** The table a paragraph is a row of, by paragraph index (sparse). */
  tables: (number | undefined)[];
}

type Cell = Piece[][];
/** Rows of a table read as one paragraph each, cells apart by a tab and a cell's
 * paragraphs by a line break, the way the PDF reader writes rows (decision 0149):
 * detection then sees a row ("Bố\tNguyễn Văn An\t1960\tGiáo viên") the same in Word, ODT
 * and PDF, and the preview shows it as a table. A nested table's rows read inside their
 * cell. Each paragraph keeps its own runs, so replacements write back as before. */
export class TableRows {
  private count = 0;
  private readonly tables: number[] = [];
  private readonly rows: Cell[][] = [];
  private readonly cells: Cell[] = [];
  openTable() {
    this.tables.push(this.count++);
  }
  closeTable() {
    this.tables.pop();
  }
  openRow() {
    this.rows.push([]);
  }
  openCell() {
    this.cells.push([]);
  }
  closeCell() {
    const cell = this.cells.pop();
    if (cell) this.rows.at(-1)?.push(cell);
  }
  /** A paragraph inside an open cell joins that cell; `false` when none is open. */
  paragraph(pieces: Piece[]): boolean {
    const cell = this.cells.at(-1);
    if (!cell) return false;
    cell.push(pieces);
    return true;
  }
  /** The closed row as one paragraph, or nothing when it has no text. */
  closeRow(): { pieces: Piece[]; table: number } | undefined {
    const row = this.rows.pop();
    const table = this.tables.at(-1);
    if (!row || table === undefined) return undefined;
    const pieces: Piece[] = [];
    row.forEach((cell, index) => {
      if (index) pieces.push({ literal: "\t" });
      cell.forEach((paragraph, line) => {
        if (line) pieces.push({ literal: "\n" });
        pieces.push(...paragraph);
      });
    });
    return pieces.some((piece) => "segment" in piece) ? { pieces, table } : undefined;
  }
}
export interface DocParagraph {
  id: number;
  part: string;
  text: string;
  /** A field instruction (`w:instrText`, e.g. "PAGE \\* MERGEFORMAT" or a mailto link):
   * Word syntax, not prose, so only its contact values are ever replaced. */
  field?: boolean;
  /** The table a row is part of (decision 0149): rows of one table share it. */
  table?: number;
}
/** A replacement in paragraph-text offsets. */
export interface Replacement {
  start: number;
  end: number;
  text: string;
}
/** Replacements per paragraph id, plus `mailto:` link targets to rewrite. */
export interface DocEdits {
  paragraphs: Map<number, Replacement[]>;
  links: Map<string, string>;
}
export interface DocSource {
  /** Word (.docx) or OpenDocument text (.odt, decision 0084). */
  format: "docx" | "odt";
  zip: JSZip;
  parts: PartModel[];
  /** Paragraph id → part index and paragraph index within it. */
  index: [number, number][];
  links: { part: string; xml: string }[];
}

const entities: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
export function unescapeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (_, entity: string) =>
    entity[0] === "#"
      ? String.fromCodePoint(
          entity[1]?.toLowerCase() === "x"
            ? parseInt(entity.slice(2), 16)
            : Number(entity.slice(1)),
        )
      : entities[entity.toLowerCase()]!,
  );
}
export function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const tag = /<(\/?)([A-Za-z_][\w.:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
/** Read one XML part into text segments and paragraphs. Deleted tracked-change text
 * (`w:delText`) counts as text: it is still in the file and would otherwise leak.
 * Field codes (`w:instrText`, e.g. a mailto hyperlink) are read as their own lines. */
export function parsePart(name: string, xml: string): PartModel {
  const segments: Segment[] = [];
  const paragraphs: Piece[][] = [];
  const tables: (number | undefined)[] = [];
  const open: Piece[][] = [];
  const rows = new TableRows();
  tag.lastIndex = 0;
  for (let match = tag.exec(xml); match; match = tag.exec(xml)) {
    const [whole, closing, element, , selfClosing] = match;
    if (element === "w:p" && !selfClosing) {
      if (closing) {
        const paragraph = open.pop();
        if (paragraph?.some((piece) => "segment" in piece) && !rows.paragraph(paragraph))
          paragraphs.push(paragraph);
      } else open.push([]);
      continue;
    }
    if (element === "w:tbl" && !selfClosing) {
      if (closing) rows.closeTable();
      else rows.openTable();
      continue;
    }
    if (element === "w:tr" && !selfClosing) {
      if (!closing) {
        rows.openRow();
        continue;
      }
      const row = rows.closeRow();
      if (row && !rows.paragraph(row.pieces)) {
        tables[paragraphs.length] = row.table;
        paragraphs.push(row.pieces);
      }
      continue;
    }
    if (element === "w:tc" && !selfClosing) {
      if (closing) rows.closeCell();
      else rows.openCell();
      continue;
    }
    if (closing) continue;
    if (element === "w:tab" || element === "w:br" || element === "w:cr") {
      open.at(-1)?.push({ literal: element === "w:tab" ? "\t" : "\n" });
      continue;
    }
    if (
      (element === "w:t" || element === "w:delText" || element === "w:instrText") &&
      !selfClosing
    ) {
      const textStart = match.index + whole.length;
      const textEnd = xml.indexOf(`</${element}>`, textStart);
      if (textEnd < 0) throw new DocFileError("unreadable");
      segments.push({
        openStart: match.index,
        openEnd: textStart,
        textStart,
        textEnd,
        text: unescapeXml(xml.slice(textStart, textEnd)),
        ...(element === "w:instrText" ? { field: true } : {}),
      });
      const piece = { segment: segments.length - 1 };
      if (element === "w:instrText" || !open.length) paragraphs.push([piece]);
      else open.at(-1)!.push(piece);
      tag.lastIndex = textEnd + element.length + 3;
    }
  }
  return { name, xml, segments, paragraphs, tables };
}

export function paragraphText(part: PartModel, pieces: readonly Piece[]): string {
  return pieces
    .map((piece) => ("segment" in piece ? part.segments[piece.segment]!.text : piece.literal))
    .join("");
}

/** New text for each segment of a paragraph after replacements. Covered characters
 * are removed; each replacement is written into the first run it covers, so it takes
 * that run's formatting. Tabs and breaks inside a replaced span stay. */
export function rewriteSegments(
  part: PartModel,
  pieces: readonly Piece[],
  replacements: readonly Replacement[],
): Map<number, string> {
  const owners: { segment: number; offset: number }[] = [];
  for (const piece of pieces) {
    if ("segment" in piece)
      for (let offset = 0; offset < part.segments[piece.segment]!.text.length; offset++)
        owners.push({ segment: piece.segment, offset });
    else
      for (let index = 0; index < piece.literal.length; index++)
        owners.push({ segment: -1, offset: 0 });
  }
  const sorted = [...replacements].sort((a, b) => a.start - b.start);
  const removed = new Uint8Array(owners.length);
  const inserts = new Map<number, string>();
  let cursor = 0;
  for (const replacement of sorted) {
    if (replacement.start < cursor || replacement.end > owners.length) continue;
    const first = owners.findIndex(
      (owner, position) =>
        position >= replacement.start && position < replacement.end && owner.segment >= 0,
    );
    if (first < 0) continue;
    for (let position = replacement.start; position < replacement.end; position++)
      if (owners[position]!.segment >= 0) removed[position] = 1;
    inserts.set(first, replacement.text);
    cursor = replacement.end;
  }
  const result = new Map<number, string>();
  owners.forEach((owner, position) => {
    if (owner.segment < 0) return;
    let text = result.get(owner.segment) ?? "";
    if (inserts.has(position)) text += inserts.get(position);
    if (!removed[position]) text += part.segments[owner.segment]!.text[owner.offset];
    result.set(owner.segment, text);
  });
  for (const piece of pieces)
    if ("segment" in piece && !result.has(piece.segment)) result.set(piece.segment, "");
  return result;
}

/** The text with replacements applied, and where each replacement landed. */
export function applyReplacements(text: string, replacements: readonly Replacement[]) {
  let output = "";
  let cursor = 0;
  const marks: { start: number; end: number }[] = [];
  for (const replacement of [...replacements].sort((a, b) => a.start - b.start)) {
    if (replacement.start < cursor) continue;
    output += text.slice(cursor, replacement.start);
    marks.push({ start: output.length, end: output.length + replacement.text.length });
    output += replacement.text;
    cursor = replacement.end;
  }
  return { text: output + text.slice(cursor), marks };
}

export async function openDocx(
  bytes: Uint8Array,
): Promise<{ source: DocSource; paragraphs: DocParagraph[]; notes: string[] }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new DocFileError("unreadable");
  }
  if (!zip.file("word/document.xml")) throw new DocFileError("unreadable");
  const names = Object.keys(zip.files)
    .filter((name) => textPart.test(name))
    // Body first, then headers, footers, notes and comments.
    .sort(
      (a, b) =>
        Number(b === "word/document.xml") - Number(a === "word/document.xml") || a.localeCompare(b),
    );
  const parts: PartModel[] = [];
  for (const name of names) parts.push(parsePart(name, await zip.file(name)!.async("string")));
  const paragraphs: DocParagraph[] = [];
  const index: [number, number][] = [];
  parts.forEach((part, partIndex) =>
    part.paragraphs.forEach((pieces, paragraphIndex) => {
      const text = paragraphText(part, pieces);
      if (!text.trim()) return;
      index.push([partIndex, paragraphIndex]);
      const field = pieces.some(
        (piece) => "segment" in piece && part.segments[piece.segment]!.field,
      );
      const table = part.tables[paragraphIndex];
      paragraphs.push({
        id: index.length - 1,
        part: part.name,
        text,
        ...(field ? { field } : {}),
        ...(table === undefined ? {} : { table: partIndex * 100_000 + table }),
      });
    }),
  );
  if (!paragraphs.length) throw new DocFileError("empty");
  const links: { part: string; xml: string }[] = [];
  for (const name of Object.keys(zip.files).filter((name) => /^word\/_rels\/.+\.rels$/.test(name)))
    links.push({ part: name, xml: await zip.file(name)!.async("string") });
  const notes = ["Hình ảnh, biểu đồ và đối tượng nhúng không được kiểm tra."];
  if (Object.keys(zip.files).some((name) => /^word\/(embeddings|media)\//.test(name)))
    notes[0] =
      "Tài liệu có hình ảnh hoặc đối tượng nhúng; chúng không được kiểm tra và vẫn nằm trong tệp.";
  return { source: { format: "docx", zip, parts, index, links }, paragraphs, notes };
}

/** `mailto:` targets of hyperlinks, which hold email addresses outside the text. */
export function mailtoTargets(source: DocSource): string[] {
  const found = new Set<string>();
  for (const { xml } of source.links)
    for (const match of xml.matchAll(/Target="mailto:([^"?]+)/g)) found.add(unescapeXml(match[1]!));
  return [...found];
}

/** New XML for every text part the edits change, by part index. Each changed segment's
 * text is rewritten in place; tags and every other byte of the part stay as they were. */
export function rewriteParts(source: DocSource, edits: DocEdits): Map<number, string> {
  const perPart = new Map<number, Map<number, string>>();
  for (const [id, replacements] of edits.paragraphs) {
    const [partIndex, paragraphIndex] = source.index[id] ?? [];
    if (partIndex === undefined || paragraphIndex === undefined) continue;
    const part = source.parts[partIndex]!;
    const changes = perPart.get(partIndex) ?? new Map<number, string>();
    for (const [segment, text] of rewriteSegments(
      part,
      part.paragraphs[paragraphIndex]!,
      replacements,
    ))
      if (text !== part.segments[segment]!.text) changes.set(segment, text);
    perPart.set(partIndex, changes);
  }
  const rewritten = new Map<number, string>();
  for (const [partIndex, changes] of perPart) {
    const part = source.parts[partIndex]!;
    let xml = "";
    let cursor = 0;
    for (const [index, segment] of part.segments.entries()) {
      const text = changes.get(index);
      if (text === undefined) continue;
      let openTag = part.xml.slice(segment.openStart, segment.openEnd);
      // Leading or trailing spaces vanish unless the run asks Word to keep them.
      if (/^\s|\s$/.test(text) && !/xml:space=/.test(openTag))
        openTag = openTag.replace(/>$/, ' xml:space="preserve">');
      xml += part.xml.slice(cursor, segment.openStart) + openTag + escapeXml(text);
      cursor = segment.textEnd;
    }
    rewritten.set(partIndex, xml + part.xml.slice(cursor));
  }
  return rewritten;
}

/** Word's document thumbnail (`docProps/thumbnail.*`) is a picture of the first page:
 * it would show the original text, so the masked copy drops it and its relationship. */
async function dropDocxThumbnail(zip: JSZip) {
  const thumbnails = Object.keys(zip.files).filter((name) => /^docProps\/thumbnail\./i.test(name));
  if (!thumbnails.length) return;
  thumbnails.forEach((name) => zip.remove(name));
  const rels = zip.file("_rels/.rels");
  if (rels)
    zip.file(
      "_rels/.rels",
      (await rels.async("string")).replace(
        /<Relationship\b[^>]*Target="\/?docProps\/thumbnail\.[^"]*"[^>]*\/>/gi,
        "",
      ),
    );
}

/** Write a copy with the edits applied. The opened source is not changed, so the
 * same file can be masked again. Author names in the file's properties are cleared. */
export async function writeDocx(source: DocSource, edits: DocEdits): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(await source.zip.generateAsync({ type: "uint8array" }));
  for (const [partIndex, xml] of rewriteParts(source, edits))
    zip.file(source.parts[partIndex]!.name, xml);
  await dropDocxThumbnail(zip);
  for (const { part, xml } of source.links) {
    const next = xml.replace(/Target="mailto:([^"?]+)/g, (whole, address: string) => {
      const alias = edits.links.get(unescapeXml(address));
      return alias ? `Target="mailto:${escapeXml(alias)}` : whole;
    });
    if (next !== xml) zip.file(part, next);
  }
  const core = zip.file("docProps/core.xml");
  if (core) {
    const xml = await core.async("string");
    zip.file(
      "docProps/core.xml",
      xml.replace(/<(dc:creator|cp:lastModifiedBy)>[^<]*<\/\1>/g, "<$1></$1>"),
    );
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/** Known aliases of `findings` in a paragraph, as replacements back to their values. */
export function restoreReplacements(
  text: string,
  findings: readonly Finding[],
): { replacements: Replacement[]; unknown: string[] } {
  const values = new Map(findings.map((finding) => [finding.alias, finding.value]));
  const replacements: Replacement[] = [];
  const unknown: string[] = [];
  for (const match of text.matchAll(/\[[A-Z][A-Z_]*_\d+_[a-f0-9]{4,8}\]/g)) {
    const value = values.get(match[0]);
    if (value === undefined) unknown.push(match[0]);
    else replacements.push({ start: match.index, end: match.index + match[0].length, text: value });
  }
  return { replacements, unknown };
}

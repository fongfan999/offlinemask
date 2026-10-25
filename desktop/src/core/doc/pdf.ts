import { blocksToMarkdown, toBlocks } from "./blocks.ts";
import {
  applyReplacements,
  DocFileError,
  maxDocBytes,
  type DocEdits,
  type DocParagraph,
} from "./docx.ts";

/** PDF support, phase 1 (decision 0149): only PDFs that contain text. The text is read
 * with pdf.js, masked like a Word paragraph, and written out as Markdown built from
 * the masked text alone, so nothing else in the file (hidden text under a box,
 * metadata, attachments, images, earlier revisions) can reach the output. pdf.js is
 * asked for text only: nothing is drawn and no image is decoded, which is most of a
 * viewer's cost and memory. */
export const maxPdfPages = 300;
/** Images at least this many pixels count for the "has images" note; logos and icons
 * are usually smaller. */
const largeImagePixels = 200_000;

export type PdfPageKind = "text" | "no-text" | "old-font";
export interface PdfPage {
  number: number;
  kind: PdfPageKind;
  /** Ids of this page's paragraphs: its text, then form field values, then comments. */
  paragraphs: number[];
}
export interface PdfSource {
  format: "pdf";
  pages: PdfPage[];
  paragraphs: DocParagraph[];
}

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjs: Promise<PdfJs> | undefined;
/** Loaded the first time a PDF opens. pdf.js runs in this thread (its "fake worker"):
 * this is already a worker, and a nested one would hold a second copy of the file. The
 * legacy build also supports the older WebKit of supported macOS versions. */
function loadPdfJs(): Promise<PdfJs> {
  pdfjs ??= Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.mjs"),
  ]).then(([module]) => module);
  return pdfjs;
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
}
interface Piece {
  text: string;
  x: number;
  y: number;
  end: number;
  size: number;
}
interface Line {
  y: number;
  size: number;
  x: number;
  end: number;
  text: string;
  /** The text items on the line, left to right, for finding a table's columns. */
  pieces: Piece[];
  /** Set on the rows of a table; rows of one table share it. */
  table?: number;
  /** A row read inline ("a · b"): a line of its own, never joined to the next. */
  inline?: boolean;
}

/** Pieces left to right as text: a gap wider than about a fifth of the font size is a
 * space (many PDFs place words without spaces), and with `tabs` a gap wider than the
 * font size is a tab, as between table cells or the two halves of a form. */
function joinPieces(pieces: readonly Piece[], tabs: boolean): string {
  let text = "";
  let end = -Infinity;
  for (const piece of pieces) {
    if (text) {
      const gap = piece.x - end;
      const spaced = /\s$/.test(text) || /^\s/.test(piece.text);
      text += tabs && gap > piece.size ? "\t" : gap > piece.size * 0.15 && !spaced ? " " : "";
    }
    text += piece.text;
    end = Math.max(end, piece.end);
  }
  return text;
}

/** Text items into lines, by where they sit on the page rather than the order the file
 * stores them: invoice and report generators often write a header last or a table cell
 * by cell. Items on the same baseline form a line, left to right (`joinPieces`).
 * pdf.js's own space items are skipped: they are wider than the gap they stand for.
 * Two columns of prose therefore read side by side, line by line. */
export function itemsToLines(items: readonly TextItem[]): Line[] {
  const pieces = items
    .filter((item) => item.str.trim())
    .map((item) => {
      const [, , c = 0, d = 0, x = 0, y = 0] = item.transform;
      return { text: item.str, x, y, end: x + item.width, size: Math.hypot(c, d) || 10 };
    })
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Piece[][] = [];
  for (const piece of pieces) {
    const row = rows.at(-1);
    if (row && Math.abs(row[0]!.y - piece.y) < Math.min(row[0]!.size, piece.size) * 0.5)
      row.push(piece);
    else rows.push([piece]);
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    return {
      y: row[0]!.y,
      size: Math.max(...row.map((piece) => piece.size)),
      x: row[0]!.x,
      end: Math.max(...row.map((piece) => piece.end)),
      text: joinPieces(row, true),
      pieces: row,
    };
  });
}

const isRow = (line: Line) => line.text.includes("\t");
/** A line of a form, not of a table: two or more "Label: value" parts side by side. */
const isFormRow = (line: Line) =>
  line.text.split("\t").filter((cell) => labelStart.test(cell.trim())).length >= 2;
const isTableRow = (line: Line) => isRow(line) && !isFormRow(line);
/** A line's words and phrases: pieces closer than half the font size joined. pdf.js
 * splits a word where its font changes, and a word must not straddle two cells; a gap
 * wider than a word space ("Đơn vị tính   Số lượng") parts two cells. */
function words(pieces: readonly Piece[]): Piece[] {
  const groups: Piece[][] = [];
  for (const piece of pieces) {
    const group = groups.at(-1);
    const last = group?.at(-1);
    if (last && piece.x - last.end <= piece.size * 0.5) group!.push(piece);
    else groups.push([piece]);
  }
  return groups.map((group) => ({
    text: joinPieces(group, false),
    x: group[0]!.x,
    y: group[0]!.y,
    end: Math.max(...group.map((piece) => piece.end)),
    size: Math.max(...group.map((piece) => piece.size)),
  }));
}
/** Where a table's columns are: the stretches of x covered by its words, merged where
 * they overlap or touch; the gaps between them are the gutters. */
function columnSpans(pieces: readonly Piece[]): { x: number; end: number }[] {
  const spans: { x: number; end: number }[] = [];
  for (const piece of [...pieces].sort((a, b) => a.x - b.x)) {
    const last = spans.at(-1);
    if (last && piece.x <= last.end) last.end = Math.max(last.end, piece.end);
    else spans.push({ x: piece.x, end: piece.end });
  }
  return spans;
}
/** A row of three or more cells with a piece covering parts of two columns belongs to a
 * different table, unless it has as many cells as the table's rows: a longer product
 * name reaching under a centred heading is still a row of the same table. A row of
 * fewer cells may straddle columns: a total ("Tổng cộng") in a cell merged across them. */
const cellCount = (line: Line) => line.text.split("\t").length;
const bridges = (spans: readonly { x: number; end: number }[], line: Line, region: Line[]) =>
  cellCount(line) >= 3 &&
  !region.some((member) => cellCount(member) === cellCount(line)) &&
  words(line.pieces).some(
    (piece) => spans.filter((span) => piece.x < span.end && piece.end > span.x).length > 1,
  );

/** Lines of a table as its rows, one cell per column. Lines closer together than a line
 * and a quarter are one row whose cells wrap (a header over three lines, a product name
 * over two around its numbers); each cell reads top to bottom. A piece between columns
 * goes to the next column to its right. Two neighbouring columns
 * never filled in the same row, and close together, are one: a centred heading over
 * right-aligned numbers. */
function tableRows(region: readonly Line[], table: number): Line[] {
  // Columns come from rows of three or more cells; a total or a wrapped line may cross them.
  const structural = region.filter((line) => line.text.split("\t").length >= 3);
  const spans = columnSpans(
    (structural.length ? structural : region).flatMap((line) => words(line.pieces)),
  );
  const lineWords = new Map(region.map((line) => [line, words(line.pieces)]));
  const column = (piece: Piece) => {
    const centre = (piece.x + piece.end) / 2;
    const index = spans.findIndex((span) => centre >= span.x && centre <= span.end);
    return index < 0 ? spans.findIndex((span) => piece.x < span.end) : index;
  };
  const size = Math.max(...region.map((line) => line.size));
  for (let index = 0; index + 1 < spans.length;) {
    const together = region.some(
      (line) =>
        lineWords.get(line)!.some((piece) => column(piece) === index) &&
        lineWords.get(line)!.some((piece) => column(piece) === index + 1),
    );
    if (!together && spans[index + 1]!.x - spans[index]!.end < size * 3) {
      spans[index]!.end = spans[index + 1]!.end;
      spans.splice(index + 1, 1);
    } else index++;
  }
  const bands: Line[][] = [];
  for (const line of region) {
    const band = bands.at(-1);
    const previous = band?.at(-1);
    if (previous && previous.y - line.y < Math.max(previous.size, line.size) * 1.25)
      band!.push(line);
    else bands.push([line]);
  }
  return bands.map((band) => {
    const cells = spans.map((_, index) =>
      band
        .map((line) =>
          joinPieces(
            lineWords.get(line)!.filter((piece) => column(piece) === index),
            false,
          ).trim(),
        )
        .filter(Boolean)
        .join(" "),
    );
    return {
      ...band[0]!,
      text: cells.join("\t"),
      pieces: band.flatMap((line) => line.pieces),
      table,
    };
  });
}

/** Finds tables among the lines and lays each out in columns (decision 0149). A table
 * starts at a row of cells and takes the rows below it, and the short lines between
 * them (wrapped cells), until a line that is neither, a gap of more than five lines
 * (invoices leave empty item rows above the total), or a row whose text straddles one of its column gaps (the next table). Tables
 * are numbered from `first`. A form line ("Mã số thuế: … · Mã ĐVQHNS: …") and a lone row
 * read inline, their parts separated by " · ". */
export function alignTables(lines: readonly Line[], first = 0): Line[] {
  let table = first;
  const inline = (line: Line): Line =>
    isRow(line) ? { ...line, text: line.text.split("\t").join(" · "), inline: true } : line;
  const out: Line[] = [];
  const wrapped = (index: number) => {
    let next = index;
    while (lines[next] && !isRow(lines[next]!) && lines[next]!.text.length <= 60) next++;
    return next > index && !!lines[next] && isTableRow(lines[next]!);
  };
  for (let index = 0; index < lines.length;) {
    if (!isTableRow(lines[index]!)) {
      out.push(inline(lines[index++]!));
      continue;
    }
    const region = [lines[index++]!];
    // A heading that wraps in one column only leaves a short line just above the table.
    while (
      out.length &&
      !isRow(out.at(-1)!) &&
      !out.at(-1)!.inline &&
      out.at(-1)!.text.length <= 60 &&
      !labelStart.test(out.at(-1)!.text) &&
      out.at(-1)!.y - region[0]!.y < Math.max(out.at(-1)!.size, region[0]!.size) * 1.25
    )
      region.unshift(out.pop()!);
    while (index < lines.length) {
      const line = lines[index]!;
      const previous = region.at(-1)!;
      if (previous.y - line.y > Math.max(previous.size, line.size) * 5) break;
      const spans = columnSpans(region.flatMap((member) => words(member.pieces)));
      if (isTableRow(line) ? bridges(spans, line, region) : !wrapped(index)) break;
      region.push(line);
      index++;
    }
    const rows = region.filter(isTableRow).length < 2 ? [] : tableRows(region, table);
    // A table needs two rows; wrapped lines may band into one, which reads inline.
    if (rows.length < 2) out.push(...region.map(inline));
    else {
      out.push(...rows);
      table++;
    }
  }
  return out;
}

const listStart = /^\s*([•●▪◦○■□\-–*+]|\d{1,3}[.)]|[a-zđ][.)])\s/iu;
/** "Mã số thuế: …", "Địa chỉ: …", "Điều 2: …": a form or contract line of its own. */
const labelStart = /^[^\t:]{1,40}:(\s|$)/u;
/** Lines into paragraphs. Lines of a paragraph join with a space, so a name wrapped
 * onto the next line is read whole. A larger gap, a line starting elsewhere than the
 * one before, not centred with it and not under a value on it (an indented block), a
 * list item, a labelled line or a table row starts a new paragraph. */
export function linesToParagraphs(lines: readonly Line[]): { text: string; table?: number }[] {
  const paragraphs: { text: string; table?: number }[] = [];
  let previous: Line | undefined;
  for (const line of lines) {
    const text = line.text
      .replace(/[ \u00a0]+/g, " ")
      .replace(/ ?\t ?/g, "\t")
      // Spaces only: a table row may start or end with an empty cell.
      .replace(/^ +| +$/g, "");
    if (!text.trim()) continue;
    const size = Math.max(previous?.size ?? 0, line.size);
    const joins =
      previous &&
      previous.y - line.y > 0 &&
      previous.y - line.y < size * 1.8 &&
      line.table === undefined &&
      previous.table === undefined &&
      !line.inline &&
      !previous.inline &&
      // Left-aligned, centred on the same middle (a title), or within a "Label: value"
      // line above, under its value ("Ký bởi: HỘ KINH DOANH … / NAM").
      (Math.abs(line.x - previous.x) < size * 3 ||
        Math.abs(line.x + line.end - previous.x - previous.end) / 2 < size * 2 ||
        (labelStart.test(previous.text) && line.x > previous.x && line.x < previous.end)) &&
      !listStart.test(text) &&
      !labelStart.test(text);
    if (joins) paragraphs[paragraphs.length - 1]!.text += " " + text;
    else paragraphs.push(line.table === undefined ? { text } : { text, table: line.table });
    previous = line;
  }
  return paragraphs;
}

const vietnameseLetter = /[A-Za-zÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ]/u;
/** Text from fonts in old Vietnamese encodings (TCVN3, VNI) or without a Unicode map
 * comes out as Latin letters Vietnamese does not use ("Céng hßa x· héi"), Latin-1
 * symbols, private-use or control characters. Other scripts are not counted. */
export function looksLikeOldFont(text: string): boolean {
  let letters = 0;
  let odd = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (
      (code < 0x20 && char !== "\t" && char !== "\n") ||
      (code >= 0xe000 && code <= 0xf8ff) ||
      code === 0xfffd ||
      (code >= 0xa1 && code <= 0xbf && !"«»°".includes(char))
    )
      odd++;
    else if (/\p{L}/u.test(char)) {
      letters++;
      if (code >= 0x80 && code <= 0x24f && !vietnameseLetter.test(char)) odd++;
    }
  }
  return letters + odd >= 20 && odd / (letters + odd) > 0.1;
}

/** Pages as "3, 5–7, 9". */
export function pageList(pages: readonly number[]): string {
  const ranges: string[] = [];
  for (let index = 0; index < pages.length;) {
    let end = index;
    while (pages[end + 1] === pages[end]! + 1) end++;
    ranges.push(end > index ? `${pages[index]}–${pages[end]}` : `${pages[index]}`);
    index = end + 1;
  }
  return ranges.join(", ");
}

const ascii = (text: string) => Uint8Array.from(text, (char) => char.charCodeAt(0));
const imageName = ascii("/Image");
const maskName = ascii("Mask");
/** Offsets of `pattern` in `bytes`, found by the native `indexOf` on its first byte. */
function* occurrences(bytes: Uint8Array, pattern: Uint8Array): Generator<number> {
  for (let at = bytes.indexOf(pattern[0]!); at >= 0; at = bytes.indexOf(pattern[0]!, at + 1)) {
    let index = 1;
    while (index < pattern.length && bytes[at + index] === pattern[index]) index++;
    if (index === pattern.length) yield at;
  }
}
const latin1 = new TextDecoder("latin1");
const around = (bytes: Uint8Array, at: number, before: number, after: number) =>
  latin1.decode(bytes.subarray(Math.max(0, at - before), at + after));

/** How many large images the file holds, from the dictionaries of its image streams.
 * Stream dictionaries are never compressed inside object streams, so they can be read
 * from the raw bytes without decoding anything; only a small window around each
 * "/Image" is turned into text. Soft masks and masks are images too but belong to
 * another image, so they are left out. */
export function countLargeImages(bytes: Uint8Array): number {
  const masks = new Set<string>();
  for (const at of occurrences(bytes, maskName)) {
    const reference = /^Mask\s+(\d+)\s+(\d+)\s+R/.exec(around(bytes, at, 0, 32));
    if (reference && (bytes[at - 1] === 0x2f || bytes[at - 2] === 0x2f))
      masks.add(`${reference[1]} ${reference[2]}`);
  }
  let count = 0;
  for (const at of occurrences(bytes, imageName)) {
    if (/[A-Za-z]/.test(String.fromCharCode(bytes[at + imageName.length] ?? 0))) continue;
    const before = around(bytes, at, 1024, 0);
    if (!/\/Subtype\s*$/.test(before)) continue;
    const window = before + around(bytes, at, 0, 1024);
    const width = Number(/\/W(?:idth)?\s+(\d+)/.exec(window)?.[1] ?? 0);
    const height = Number(/\/H(?:eight)?\s+(\d+)/.exec(window)?.[1] ?? 0);
    const object = [...before.matchAll(/(\d+)\s+(\d+)\s+obj\b/g)].at(-1);
    if (width * height >= largeImagePixels && !(object && masks.has(`${object[1]} ${object[2]}`)))
      count++;
  }
  return count;
}

interface Annotation {
  subtype?: string;
  fieldType?: string;
  fieldName?: string;
  alternativeText?: string;
  fieldValue?: unknown;
  checkBox?: boolean;
  radioButton?: boolean;
  contentsObj?: { str?: string };
  titleObj?: { str?: string };
}
/** Form field values and comments: not part of the page's text, but in the file and
 * read by any AI that reads the PDF. */
function annotationTexts(annotations: readonly Annotation[]): string[] {
  const fields: string[] = [];
  const comments: string[] = [];
  for (const annotation of annotations) {
    if (annotation.subtype === "Widget") {
      if (annotation.checkBox || annotation.radioButton) continue;
      const value = Array.isArray(annotation.fieldValue)
        ? annotation.fieldValue.join(", ")
        : typeof annotation.fieldValue === "string"
          ? annotation.fieldValue
          : "";
      if (!value.trim()) continue;
      const label = annotation.alternativeText?.trim() || annotation.fieldName?.trim();
      fields.push(label ? `${label}: ${value.trim()}` : value.trim());
    } else if (annotation.subtype !== "Popup" && annotation.subtype !== "Link") {
      const contents = annotation.contentsObj?.str?.trim();
      if (!contents) continue;
      const author = annotation.titleObj?.str?.trim();
      comments.push(author ? `Ghi chú (${author}): ${contents}` : `Ghi chú: ${contents}`);
    }
  }
  return [...fields, ...comments];
}

/** NFC, since PDFs often store "ệ" as a letter and combining marks, and without the
 * control characters some fonts' Unicode maps add after a letter. */
type PdfPageProxy = Awaited<
  ReturnType<Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>["getPage"]>
>;
/** A page's text items. pdf.js's own `getTextContent` reads its stream with `for await`,
 * which WebKit's ReadableStream does not support (macOS 26.6), so every PDF failed in
 * the desktop app; reading the stream with a reader works everywhere. */
async function pageText(page: PdfPageProxy): Promise<TextItem[]> {
  const reader = page.streamTextContent().getReader();
  const items: TextItem[] = [];
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read())
    for (const item of (chunk.value as { items: object[] }).items)
      if ("str" in item) items.push(item as TextItem);
  return items;
}

// eslint-disable-next-line no-control-regex -- removing control characters is the point
const controls = /[\u0000-\u0008\u000b-\u001f\u007f]/g;
const clean = (text: string) => text.replace(controls, "").normalize("NFC");

export interface PdfReading {
  /** Called after each page. */
  onPage?: (read: number, total: number) => void;
  /** Checked between pages; reading stops with "cancelled" once it returns true. */
  stopped?: () => boolean;
}
/** pdf.js works through promises, which never let a waiting message (such as Hủy) in;
 * a timer every so often does. */
const yieldEvery = 50;
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

export async function openPdf(
  bytes: Uint8Array,
  { onPage, stopped }: PdfReading = {},
): Promise<{ source: PdfSource; paragraphs: DocParagraph[]; notes: string[] }> {
  if (bytes.byteLength > maxDocBytes) throw new DocFileError("too-large");
  const largeImages = countLargeImages(bytes);
  const { getDocument } = await loadPdfJs();
  // No URL is given for CMaps, standard fonts, ICC profiles or WebAssembly, and system
  // fonts are off, so pdf.js never fetches anything; text needs none of them.
  const task = getDocument({
    data: bytes,
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    useWasm: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    enableXfa: false,
    maxImageSize: 0,
    verbosity: 0,
  });
  try {
    let document: Awaited<typeof task.promise>;
    try {
      document = await task.promise;
    } catch (error) {
      throw new DocFileError(
        (error as { name?: string })?.name === "PasswordException" ? "password" : "unreadable",
      );
    }
    if (document.numPages > maxPdfPages) throw new DocFileError("too-many-pages");
    const pages: PdfPage[] = [];
    const paragraphs: DocParagraph[] = [];
    let yielded = performance.now();
    for (let number = 1; number <= document.numPages; number++) {
      if (performance.now() - yielded > yieldEvery) {
        await nextTask();
        yielded = performance.now();
      }
      if (stopped?.()) throw new DocFileError("cancelled");
      const page = await document.getPage(number);
      const items = await pageText(page);
      const text = clean(items.map((item) => item.str).join(""));
      const kind: PdfPageKind =
        text.replace(/\s/g, "").length < 5
          ? "no-text"
          : looksLikeOldFont(text)
            ? "old-font"
            : "text";
      // Tables are numbered per page from page × 1000, unique in the document.
      const texts =
        kind === "text" ? linesToParagraphs(alignTables(itemsToLines(items), number * 1000)) : [];
      texts.push(
        ...annotationTexts((await page.getAnnotations()) as Annotation[]).map((text) => ({ text })),
      );
      const ids: number[] = [];
      for (const { text: paragraph, table } of texts) {
        ids.push(paragraphs.length);
        paragraphs.push({
          id: paragraphs.length,
          part: `page-${number}`,
          text: clean(paragraph),
          ...(table === undefined ? {} : { table }),
        });
      }
      pages.push({ number, kind, paragraphs: ids });
      page.cleanup();
      onPage?.(number, document.numPages);
    }
    if (!pages.some((page) => page.kind === "text")) {
      if (pages.some((page) => page.kind === "old-font")) throw new DocFileError("old-font");
      throw new DocFileError("scanned");
    }
    if (!paragraphs.length) throw new DocFileError("empty");
    const notes: string[] = [];
    const missing = (kind: PdfPageKind) =>
      pages.filter((page) => page.kind === kind).map((page) => page.number);
    const noText = missing("no-text");
    if (noText.length)
      notes.push(
        `Trang ${pageList(noText)} không có chữ đọc được (thường là ảnh scan). Bản đã ẩn sẽ không có nội dung ${noText.length > 1 ? "các trang" : "trang"} này.`,
      );
    const oldFont = missing("old-font");
    if (oldFont.length)
      notes.push(
        `Trang ${pageList(oldFont)} dùng phông chữ cũ nên chưa đọc được. Bản đã ẩn sẽ không có nội dung ${oldFont.length > 1 ? "các trang" : "trang"} này.`,
      );
    if (largeImages)
      notes.push(
        `Tệp có ${largeImages} hình ảnh. Hình ảnh không có trong bản đã ẩn; nếu trong ảnh có chữ cần gửi, hãy gõ lại.`,
      );
    return { source: { format: "pdf", pages, paragraphs }, paragraphs, notes };
  } finally {
    await task.destroy();
  }
}

const placeholders: Record<Exclude<PdfPageKind, "text">, string> = {
  "no-text": "(Trang không có chữ đọc được, thường là ảnh scan — không có trong bản đã ẩn)",
  "old-font": "(Trang dùng phông chữ cũ, chưa đọc được — không có trong bản đã ẩn)",
};
/** The masked document as Markdown: each page under its own heading, its paragraphs
 * with the replacements applied, rows of cells as tables (`blocks.ts`), and a line in
 * place of a page that could not be read. */
export function writePdfText(source: PdfSource, edits: DocEdits): Uint8Array {
  const blocks: string[] = [];
  for (const page of source.pages) {
    blocks.push(`## Trang ${page.number}`);
    if (page.kind !== "text") blocks.push(placeholders[page.kind]);
    blocks.push(
      ...blocksToMarkdown(
        toBlocks(
          page.paragraphs.map((id) => ({
            ...applyReplacements(source.paragraphs[id]!.text, edits.paragraphs.get(id) ?? []),
            table: source.paragraphs[id]!.table,
          })),
        ),
      ),
    );
  }
  return new TextEncoder().encode(blocks.join("\n\n") + "\n");
}

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
  hasEOL: boolean;
}
interface Line {
  y: number;
  size: number;
  x: number;
  end: number;
  text: string;
}

/** Text items into lines: items on the same baseline join, a gap wider than about a
 * fifth of the font size becomes a space (many PDFs place words without spaces), and a
 * wide gap a tab, as between table cells. Items are taken in the file's own order,
 * which is how most PDFs store columns: one column after the other. */
export function itemsToLines(items: readonly TextItem[]): Line[] {
  const lines: Line[] = [];
  let line: Line | undefined;
  let broken = false;
  for (const item of items) {
    const [, , c = 0, d = 0, x = 0, y = 0] = item.transform;
    const size = Math.hypot(c, d) || 10;
    const sameLine =
      line &&
      !broken &&
      Math.abs(y - line.y) < Math.max(line.size, size) * 0.5 &&
      x > line.end - Math.max(line.size, size) * 0.5;
    if (!item.str.trim()) {
      // pdf.js gives a gap as a space item as wide as the gap.
      if (line && sameLine && item.str) {
        line.text += item.width > size * 2 ? "\t" : /\s$/.test(line.text) ? "" : " ";
        line.end = Math.max(line.end, x + item.width);
      }
      broken ||= item.hasEOL;
      continue;
    }
    if (line && sameLine) {
      const gap = x - line.end;
      const spaced = /\s$/.test(line.text) || /^\s/.test(item.str);
      if (!line.text.endsWith("\t"))
        line.text += gap > size * 2 ? "\t" : gap > size * 0.15 && !spaced ? " " : "";
      line.text += item.str;
      line.end = Math.max(line.end, x + item.width);
      line.size = Math.max(line.size, size);
    } else {
      line = { y, size, x, end: x + item.width, text: item.str };
      lines.push(line);
    }
    broken = item.hasEOL;
  }
  return lines;
}

const listStart = /^\s*([•●▪◦○■□\-–*+]|\d{1,3}[.)]|[a-zđ][.)])\s/iu;
/** Lines into paragraphs. Lines of a paragraph join with a space, so a name wrapped
 * onto the next line is read whole. A larger gap, a jump back up (the next column), a
 * list item or a table row starts a new paragraph. */
export function linesToParagraphs(lines: readonly Line[]): string[] {
  const paragraphs: string[] = [];
  let previous: Line | undefined;
  for (const line of lines) {
    const text = line.text
      .replace(/[ \u00a0]+/g, " ")
      .replace(/ ?\t ?/g, "\t")
      .trim();
    if (!text) continue;
    const size = Math.max(previous?.size ?? 0, line.size);
    const joins =
      previous &&
      previous.y - line.y > 0 &&
      previous.y - line.y < size * 1.8 &&
      !text.includes("\t") &&
      !previous.text.includes("\t") &&
      !listStart.test(text);
    if (joins) paragraphs[paragraphs.length - 1] += " " + text;
    else paragraphs.push(text);
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
      const content = await page.getTextContent();
      const items = content.items.filter((item): item is TextItem & typeof item => "str" in item);
      const text = clean(items.map((item) => item.str).join(""));
      const kind: PdfPageKind =
        text.replace(/\s/g, "").length < 5
          ? "no-text"
          : looksLikeOldFont(text)
            ? "old-font"
            : "text";
      const texts = kind === "text" ? linesToParagraphs(itemsToLines(items)).map(clean) : [];
      texts.push(...annotationTexts((await page.getAnnotations()) as Annotation[]).map(clean));
      const ids: number[] = [];
      for (const paragraph of texts) {
        ids.push(paragraphs.length);
        paragraphs.push({ id: paragraphs.length, part: `page-${number}`, text: paragraph });
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
 * with the replacements applied, and a line in place of a page that could not be read. */
export function writePdfText(source: PdfSource, edits: DocEdits): Uint8Array {
  const blocks: string[] = [];
  for (const page of source.pages) {
    blocks.push(`## Trang ${page.number}`);
    if (page.kind !== "text") blocks.push(placeholders[page.kind]);
    for (const id of page.paragraphs)
      blocks.push(
        applyReplacements(source.paragraphs[id]!.text, edits.paragraphs.get(id) ?? []).text,
      );
  }
  return new TextEncoder().encode(blocks.join("\n\n") + "\n");
}

import { blocksToMarkdown, toBlocks } from "./blocks.ts";
import { applyReplacements, DocFileError, type DocEdits, type DocParagraph } from "./docx.ts";

/** Text in pictures (decision 0180). A scanned PDF page or an image file is read by
 * the operating system's own text recognition (Apple's Vision framework on macOS; the
 * native `ocr` module), which returns lines of text with their boxes. The lines are
 * placed on the page like pdf.js's text items, so the same reading by place (lines,
 * tables, "Label: value" forms) applies, and the masked copy is the same text-only
 * Markdown as a text PDF's: nothing of the picture itself can reach the AI. */

/** One recognised word (or a whole line, where the engine gives no boxes for its
 * parts) and its box, in fractions of the picture, origin top left. */
export interface OcrLine {
  text: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The font size, in fractions of the picture's height, where the engine can tell it
   * from the print (OfflineMask's own reader, decision 0181); the same for every word of a
   * line. */
  size?: number;
  /** Which line the word is on, where the engine numbers its lines; otherwise the words
   * of a line are the ones that share its y and height. */
  line?: number;
}
export interface OcrPage {
  lines: OcrLine[];
}
/** Reads a PNG or JPEG picture of the given size in pixels. Rejects when no engine is
 * available. */
export type OcrEngine = (image: Uint8Array, width: number, height: number) => Promise<OcrPage>;

/** A pdf.js text item built from a recognised word: in the picture's pixels, with y
 * upwards as on a PDF page. The engine's boxes are too loose to stand for the font
 * size (the same print gets boxes from 1.3 to 2 times its size), so the size comes
 * from how much room a line's letters take, each kind of letter at the width it has in
 * the document fonts measured (`advances`, in font sizes: a least-squares fit over
 * 2 628 pieces of the text PDFs, which puts 90 % of lines within ±8 % of their size).
 * The words of one line share its box's y and height, which tells them apart. A word
 * that is only a bar is a table rule the engine read as text (`unbar`). */
export interface OcrTextItem {
  str: string;
  transform: number[];
  width: number;
}
const advances = { lower: 0.571, upper: 0.731, digit: 0.611, other: 0.366 };
const boxToFontSize = 1.3;
const bodyShare = 0.15;
/** The room a word's letters take, in font sizes. */
function advance(text: string): number {
  let sum = 0;
  for (const char of text.normalize("NFC")) {
    if (/\s/u.test(char)) continue;
    sum += /\p{Ll}/u.test(char)
      ? advances.lower
      : /\p{Lu}/u.test(char)
        ? advances.upper
        : /\p{N}/u.test(char)
          ? advances.digit
          : advances.other;
  }
  return sum;
}
/** A bar inside a word is a table rule the engine read as text between two cells it
 * glued ("21/10/2026|FT26203861639"): the word is parted there, each part keeping its
 * share of the box and the rule its own, a letter and a half wide, so the parts stand
 * apart as two cells do. A word that is only bars is dropped. */
const ruleLetters = 1.5;
function unbar(word: OcrLine): OcrLine[] {
  const text = word.text.replace(/^\|+|\|+$/g, "");
  const parts = text.split("|").map((part, index, all) => ({
    text: index + 1 < all.length ? `${part} ` : part,
    letters: part.replace(/\s/g, "").length,
  }));
  const letters = parts.reduce((sum, part) => sum + part.letters, 0);
  if (!letters) return [];
  if (parts.length === 1) return [{ ...word, text }];
  const unit = word.width / (letters + ruleLetters * (parts.length - 1));
  let x = word.x;
  const out: OcrLine[] = [];
  for (const part of parts) {
    if (part.letters) out.push({ ...word, text: part.text, x, width: unit * part.letters });
    x += unit * (part.letters + ruleLetters);
  }
  return out;
}
export function ocrTextItems(page: OcrPage, width: number, height: number): OcrTextItem[] {
  const words = page.lines.flatMap(unbar).filter((line) => line.text.trim());
  const sizes = new Map<string | number, number>();
  const lineKey = (word: OcrLine) => word.line ?? `${word.y}:${word.height}`;
  for (const key of new Set(words.map(lineKey))) {
    const line = words.filter((word) => lineKey(word) === key);
    const letters = line.reduce((sum, word) => sum + word.text.trim().length, 0);
    const room = line.reduce((sum, word) => sum + advance(word.text), 0);
    const across = line.reduce((sum, word) => sum + word.width * width, 0);
    const box = line[0]!.height * height;
    const widths = letters >= 3 && room > 0 ? across / room : box / boxToFontSize;
    // Widths grow with bold print and the print's height does not: an engine that measures
    // the height gets the mean of the two (decision 0181).
    const measured = line[0]!.size;
    const estimate = measured ? (widths + measured * height) / 2 : widths;
    sizes.set(key, Math.max(1, Math.min(box, estimate)));
  }
  // An estimate is good to about a tenth, and most lines of a page share its body size: a
  // measured line that close to the page's median takes the median, so a gap the reader
  // weighs in font sizes (the end of a table, five lines) is weighed the same on every line.
  // Headings and small print stay apart. Only for engines that measure (decision 0181).
  if (words.some((word) => word.size)) {
    const all = [...sizes.values()].sort((a, b) => a - b);
    const median = all[Math.floor(all.length / 2)]!;
    for (const [key, size] of sizes)
      if (Math.abs(size / median - 1) <= bodyShare) sizes.set(key, median);
  }
  return words.map((word) => {
    const size = sizes.get(lineKey(word))!;
    return {
      str: word.text,
      transform: [size, 0, 0, size, word.x * width, height - (word.y + word.height) * height],
      width: word.width * width,
    };
  });
}

/** Width and height of a PNG (IHDR) or JPEG (its first frame header), without
 * decoding the picture. */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e)
    return { width: view.getUint32(16), height: view.getUint32(20) };
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    while (at + 9 < bytes.length && bytes[at] === 0xff) {
      const marker = bytes[at + 1]!;
      const length = view.getUint16(at + 2);
      // SOF0–SOF15 except the tables markers: height then width follow the precision.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { width: view.getUint16(at + 7), height: view.getUint16(at + 5) };
      at += 2 + length;
    }
  }
  return undefined;
}
export const isPng = (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50;
export const isJpeg = (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8;

/** Too large a picture takes long and gives nothing better: a page scanned at 300 dpi
 * is about 2 500 × 3 500. */
export const maxImagePixels = 25_000_000;

export interface ImageSource {
  format: "image";
  paragraphs: DocParagraph[];
}

/** What tells the user the text came from a picture. */
export const ocrNote =
  "Chữ được đọc từ ảnh bằng nhận dạng ký tự nên có thể sai sót. Hãy xem lại bản đã ẩn trước khi gửi.";

/** The paragraphs of a picture, read by place like a PDF page (`pdf.ts`). */
export type PlaceReader = (
  items: OcrTextItem[],
  table: number,
) => { text: string; table?: number }[];

export async function openImage(
  bytes: Uint8Array,
  engine: OcrEngine | undefined,
  read: PlaceReader,
): Promise<{ source: ImageSource; paragraphs: DocParagraph[]; notes: string[] }> {
  if (!engine) throw new DocFileError("no-ocr");
  const size = imageSize(bytes);
  if (!size || !size.width || !size.height) throw new DocFileError("unreadable");
  if (size.width * size.height > maxImagePixels) throw new DocFileError("memory");
  let page: OcrPage;
  try {
    page = await engine(bytes, size.width, size.height);
  } catch {
    throw new DocFileError("unreadable");
  }
  const paragraphs: DocParagraph[] = read(ocrTextItems(page, size.width, size.height), 1000).map(
    ({ text, table }, id) => ({
      id,
      part: "image",
      text,
      ...(table === undefined ? {} : { table }),
    }),
  );
  if (!paragraphs.length) throw new DocFileError("empty");
  return { source: { format: "image", paragraphs }, paragraphs, notes: [ocrNote] };
}

/** The masked picture as Markdown: its paragraphs with the replacements applied, rows
 * of cells as tables, and nothing else. */
export function writeImageText(source: ImageSource, edits: DocEdits): Uint8Array {
  const blocks = blocksToMarkdown(
    toBlocks(
      source.paragraphs.map((paragraph) => ({
        ...applyReplacements(paragraph.text, edits.paragraphs.get(paragraph.id) ?? []),
        table: paragraph.table,
      })),
    ),
  );
  return new TextEncoder().encode(blocks.join("\n\n") + "\n");
}

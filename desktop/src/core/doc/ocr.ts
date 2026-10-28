import { blocksToMarkdown, toBlocks } from "./blocks.ts";
import {
  applyReplacements,
  DocFileError,
  maxDocBytes,
  type DocEdits,
  type DocParagraph,
} from "./docx.ts";

/** Text in pictures (decision 0171). A scanned PDF page or an image file is read by
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
}
export interface OcrPage {
  lines: OcrLine[];
}
/** Reads a PNG or JPEG picture. Rejects when no engine is available. */
export type OcrEngine = (image: Uint8Array) => Promise<OcrPage>;

/** A pdf.js text item built from a recognised word: in the picture's pixels, with y
 * upwards as on a PDF page. The engine's boxes are too loose to stand for the font
 * size (the same print gets boxes from 1.3 to 2 times its size), so the size comes
 * from how much room a line's letters take, each kind of letter at the width it has in
 * the document fonts measured (`advances`, in font sizes: a least-squares fit over
 * 2 628 pieces of the text PDFs, which puts 90 % of lines within ±8 % of their size).
 * The words of one line share its box's y and height, which tells them apart. A word
 * that is only a bar is a table rule the engine read as text. */
export interface OcrTextItem {
  str: string;
  transform: number[];
  width: number;
}
const advances = { lower: 0.571, upper: 0.731, digit: 0.611, other: 0.366 };
const boxToFontSize = 1.3;
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
export function ocrTextItems(page: OcrPage, width: number, height: number): OcrTextItem[] {
  const words = page.lines.filter((line) => line.text.trim() && line.text.trim() !== "|");
  const sizes = new Map<string, number>();
  const lineKey = (word: OcrLine) => `${word.y}:${word.height}`;
  for (const key of new Set(words.map(lineKey))) {
    const line = words.filter((word) => lineKey(word) === key);
    const letters = line.reduce((sum, word) => sum + word.text.trim().length, 0);
    const room = line.reduce((sum, word) => sum + advance(word.text), 0);
    const across = line.reduce((sum, word) => sum + word.width * width, 0);
    const box = line[0]!.height * height;
    const estimate = letters >= 3 && room > 0 ? across / room : box / boxToFontSize;
    sizes.set(key, Math.max(1, Math.min(box, estimate)));
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
  if (bytes.byteLength > maxDocBytes) throw new DocFileError("too-large");
  if (!engine) throw new DocFileError("no-ocr");
  const size = imageSize(bytes);
  if (!size || !size.width || !size.height) throw new DocFileError("unreadable");
  if (size.width * size.height > maxImagePixels) throw new DocFileError("too-large");
  let page: OcrPage;
  try {
    page = await engine(bytes);
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

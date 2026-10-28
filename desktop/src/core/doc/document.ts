import { mailtoTargets, openDocx, writeDocx, type DocEdits, type DocSource } from "./docx.ts";
import { isJpeg, isPng, openImage, writeImageText, type ImageSource } from "./ocr.ts";
import { odtMailtoTargets, openOdt, writeOdt } from "./odt.ts";
import { openPdf, readByPlace, writePdfText, type PdfReading, type PdfSource } from "./pdf.ts";
import { openPlain, writePlain, type PlainSource } from "./plain.ts";

export type DocumentSource = DocSource | PdfSource | PlainSource | ImageSource;
export type DocumentFormat = DocumentSource["format"];

/** An ODF package starts with an uncompressed `mimetype` entry, so its name sits right
 * after the first local file header; anything else is read as Word. */
function isOdf(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes.subarray(30, 38)) === "mimetype";
}
/** A PDF says so in its first kilobyte ("%PDF-"), usually at the very start. */
function isPdf(bytes: Uint8Array) {
  return new TextDecoder("latin1").decode(bytes.subarray(0, 1024)).includes("%PDF-");
}
const plainName = /\.(md|txt)$/i;

/** Open a Word, OpenDocument text or PDF file (decisions 0078, 0084, 0149), a PNG or
 * JPEG picture read by text recognition (decision 0171), or a .md or .txt file
 * returned by the AI for one of the last two. */
export async function openDocument(bytes: Uint8Array, name = "", reading: PdfReading = {}) {
  if (isPdf(bytes)) return { ...(await openPdf(bytes, reading)), mailto: [] as string[] };
  if (isPng(bytes) || isJpeg(bytes))
    return { ...(await openImage(bytes, reading.ocr, readByPlace)), mailto: [] as string[] };
  if (plainName.test(name)) return { ...openPlain(bytes), mailto: [] as string[] };
  const opened = isOdf(bytes) ? await openOdt(bytes) : await openDocx(bytes);
  return {
    ...opened,
    mailto:
      opened.source.format === "odt"
        ? odtMailtoTargets(opened.source)
        : mailtoTargets(opened.source),
  };
}
export async function writeDocument(source: DocumentSource, edits: DocEdits): Promise<Uint8Array> {
  if (source.format === "pdf") return writePdfText(source, edits);
  if (source.format === "image") return writeImageText(source, edits);
  if (source.format === "plain") return writePlain(source, edits);
  return source.format === "odt" ? writeOdt(source, edits) : writeDocx(source, edits);
}

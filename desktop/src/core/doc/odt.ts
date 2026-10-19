import JSZip from "jszip";
import {
  DocFileError,
  escapeXml,
  maxDocBytes,
  paragraphText,
  rewriteParts,
  unescapeXml,
  type DocEdits,
  type DocParagraph,
  type DocSource,
  type PartModel,
  type Piece,
  type Segment,
} from "./docx.ts";

/** OpenDocument text (.odt, decision 0084), as written by LibreOffice and others.
 * Unlike Word, text sits directly in `<text:p>`/`<text:h>` and their spans, links and
 * fields; runs of spaces, tabs and line breaks are elements. The same paragraph model,
 * replacements and writer as Word are used, so formatting is kept the same way. */
export const odtMimeType = "application/vnd.oasis.opendocument.text";
/** Body, then headers and footers (in the master pages of styles.xml). */
const textParts = ["content.xml", "styles.xml"];
const mailto = /xlink:href="mailto:([^"?]+)/g;

const tag = /<(\/?)([A-Za-z_][\w.:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
const paragraphElement = (element: string) => element === "text:p" || element === "text:h";
/** Character data in the text namespace (paragraphs, spans, links, fields such as the
 * author's name) is document text. Metadata inside a paragraph, such as a comment's
 * `dc:creator` and `dc:date`, and drawing titles are not. */
const holdsText = (element: string | undefined) => !!element?.startsWith("text:");

function literal(element: string, attributes: string): string | null {
  if (element === "text:tab") return "\t";
  if (element === "text:line-break") return "\n";
  if (element === "text:s") {
    const count = Number(/text:c="(\d+)"/.exec(attributes)?.[1] ?? 1);
    return " ".repeat(Math.min(Math.max(count, 1), 1000));
  }
  return null;
}

/** Read one ODF XML part into text segments (character data between tags) and
 * paragraphs. Whitespace in character data collapses to one space, as ODF displays it.
 * Notes, comments, text boxes and tracked deletions are paragraphs of their own. */
export function parseOdtPart(name: string, xml: string): PartModel {
  const segments: Segment[] = [];
  const paragraphs: Piece[][] = [];
  const open: Piece[][] = [];
  const elements: string[] = [];
  let previousEnd = 0;
  tag.lastIndex = 0;
  for (let match = tag.exec(xml); match; match = tag.exec(xml)) {
    const [whole, closing, , attributes, selfClosing] = match;
    const element = match[2]!;
    if (open.length && holdsText(elements.at(-1)) && match.index > previousEnd) {
      const raw = xml.slice(previousEnd, match.index);
      const text = unescapeXml(raw).replace(/[ \t\r\n]+/g, " ");
      if (text) {
        segments.push({
          openStart: previousEnd,
          openEnd: previousEnd,
          textStart: previousEnd,
          textEnd: match.index,
          text,
        });
        open.at(-1)!.push({ segment: segments.length - 1 });
      }
    }
    previousEnd = match.index + whole.length;
    if (closing) {
      if (elements.at(-1) === element) elements.pop();
      if (paragraphElement(element)) {
        const paragraph = open.pop();
        if (paragraph?.some((piece) => "segment" in piece)) paragraphs.push(paragraph);
      }
      continue;
    }
    if (selfClosing) {
      const text = open.length ? literal(element, attributes ?? "") : null;
      if (text) open.at(-1)!.push({ literal: text });
      continue;
    }
    elements.push(element);
    if (paragraphElement(element)) open.push([]);
  }
  return { name, xml, segments, paragraphs };
}

export async function openOdt(
  bytes: Uint8Array,
): Promise<{ source: DocSource; paragraphs: DocParagraph[]; notes: string[] }> {
  if (bytes.byteLength > maxDocBytes) throw new DocFileError("too-large");
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new DocFileError("unreadable");
  }
  const mimetype = await zip.file("mimetype")?.async("string");
  if (mimetype?.trim() !== odtMimeType || !zip.file("content.xml"))
    throw new DocFileError("unreadable");
  // A password-protected document stores its XML encrypted; there is no text to read.
  const manifest = (await zip.file("META-INF/manifest.xml")?.async("string")) ?? "";
  if (manifest.includes("manifest:encryption-data")) throw new DocFileError("unreadable");
  const parts: PartModel[] = [];
  for (const name of textParts) {
    const file = zip.file(name);
    if (file) parts.push(parseOdtPart(name, await file.async("string")));
  }
  const paragraphs: DocParagraph[] = [];
  const index: [number, number][] = [];
  parts.forEach((part, partIndex) =>
    part.paragraphs.forEach((pieces, paragraphIndex) => {
      const text = paragraphText(part, pieces);
      if (!text.trim()) return;
      index.push([partIndex, paragraphIndex]);
      paragraphs.push({ id: index.length - 1, part: part.name, text });
    }),
  );
  if (!paragraphs.length) throw new DocFileError("empty");
  const notes = ["Hình ảnh, biểu đồ và đối tượng nhúng không được kiểm tra."];
  if (Object.keys(zip.files).some((name) => /^(Pictures|Object [^/]*)\//.test(name)))
    notes[0] =
      "Tài liệu có hình ảnh hoặc đối tượng nhúng; chúng không được kiểm tra và vẫn nằm trong tệp.";
  return {
    source: {
      format: "odt",
      zip,
      parts,
      index,
      links: parts.map((part) => ({ part: part.name, xml: part.xml })),
    },
    paragraphs,
    notes,
  };
}

/** `mailto:` targets of links, which hold email addresses outside the text. */
export function odtMailtoTargets(source: DocSource): string[] {
  const found = new Set<string>();
  for (const { xml } of source.links)
    for (const match of xml.matchAll(mailto)) found.add(unescapeXml(match[1]!));
  return [...found];
}

/** Author names in ODF XML: document properties, comments and tracked changes. */
export const odfAuthors = /<(dc:creator|meta:initial-creator)>[^<]*<\/\1>/g;

/** What every masked ODF copy needs besides its edited text: author names cleared in
 * `meta.xml`, the first-page thumbnail (a picture of the original) removed with its
 * manifest entry, and `mimetype` kept the first, uncompressed entry. */
export async function cleanOdfPackage(zip: JSZip, mimeType: string): Promise<Uint8Array> {
  const meta = zip.file("meta.xml");
  if (meta) zip.file("meta.xml", (await meta.async("string")).replace(odfAuthors, "<$1></$1>"));
  const thumbnails = Object.keys(zip.files).filter((name) => name.startsWith("Thumbnails/"));
  if (thumbnails.length) {
    thumbnails.forEach((name) => zip.remove(name));
    const manifest = zip.file("META-INF/manifest.xml");
    if (manifest)
      zip.file(
        "META-INF/manifest.xml",
        (await manifest.async("string")).replace(
          /<manifest:file-entry\b[^>]*manifest:full-path="Thumbnails\/[^"]*"[^>]*\/>/g,
          "",
        ),
      );
  }
  zip.file("mimetype", mimeType, { compression: "STORE" });
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/** Write a copy with the edits applied; the opened source is not changed. Author names
 * (document properties, comments, tracked changes) are cleared, and the first-page
 * thumbnail, a picture of the original text, is removed. `mimetype` stays the first,
 * uncompressed entry, as ODF requires. */
export async function writeOdt(source: DocSource, edits: DocEdits): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(await source.zip.generateAsync({ type: "uint8array" }));
  const rewritten = rewriteParts(source, edits);
  source.parts.forEach((part, partIndex) => {
    const xml = (rewritten.get(partIndex) ?? part.xml)
      .replace(mailto, (whole, address: string) => {
        const alias = edits.links.get(unescapeXml(address));
        return alias ? `xlink:href="mailto:${escapeXml(alias)}` : whole;
      })
      .replace(odfAuthors, "<$1></$1>");
    if (xml !== part.xml) zip.file(part.name, xml);
  });
  return cleanOdfPackage(zip, odtMimeType);
}

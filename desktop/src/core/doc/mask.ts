import type { Detection } from "../detection/types.ts";
import type { Finding } from "../review.ts";
import { aliasValues } from "../restore.ts";
import { AliasBook, detectionReplacements } from "../sheet/mask.ts";
import {
  applyReplacements,
  restoreReplacements,
  type DocEdits,
  type DocParagraph,
  type Replacement,
} from "./docx.ts";

const emailShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Field instructions carry Word syntax ("PAGE", "MERGEFORMAT", "HYPERLINK"), never prose. */
const prose = new Set(["TEN", "DIA_CHI", "TO_CHUC"]);

/** Mask every paragraph with its detections; one alias per type and value across the
 * document, and `mailto:` link targets get the same email alias as the text. */
export function maskParagraphs(
  paragraphs: readonly DocParagraph[],
  detections: ReadonlyMap<number, readonly Detection[]>,
  scope: string,
  mailto: readonly string[] = [],
  /** A folder's shared book (decision 0171); its findings then cover every file. */
  shared?: AliasBook,
): { edits: DocEdits; findings: Finding[]; masked: number } {
  const existing = paragraphs
    .map((paragraph) => paragraph.text)
    .filter((text) => text.includes("["));
  const book =
    shared ?? new AliasBook(scope, (alias) => existing.some((text) => text.includes(alias)));
  const edits: DocEdits = { paragraphs: new Map(), links: new Map() };
  let masked = 0;
  for (const paragraph of paragraphs) {
    const found = detections.get(paragraph.id) ?? [];
    const replacements = detectionReplacements(
      paragraph.text,
      paragraph.field ? found.filter((d) => !prose.has(d.type)) : found,
      book,
    );
    if (!replacements.length) continue;
    masked += replacements.length;
    edits.paragraphs.set(paragraph.id, replacements);
  }
  for (const address of mailto)
    if (emailShape.test(address)) edits.links.set(address, book.alias("EMAIL", "Email", address));
  return { edits, findings: book.findings, masked };
}

/** Swap this document's aliases back in a returned document. */
export function restoreParagraphs(
  paragraphs: readonly DocParagraph[],
  findings: readonly Finding[],
  mailto: readonly string[] = [],
): { edits: DocEdits; restored: number; unknown: string[] } {
  const edits: DocEdits = { paragraphs: new Map(), links: new Map() };
  const values = aliasValues(findings);
  const unknown = new Set<string>();
  let restored = 0;
  for (const paragraph of paragraphs) {
    if (!paragraph.text.includes("[")) continue;
    const result = restoreReplacements(paragraph.text, values);
    result.unknown.forEach((alias) => unknown.add(alias));
    if (!result.replacements.length) continue;
    restored += result.replacements.length;
    edits.paragraphs.set(paragraph.id, result.replacements);
  }
  for (const address of mailto) {
    const value = values.get(address);
    if (value) edits.links.set(address, value);
  }
  return { edits, restored, unknown: [...unknown] };
}

const pagePart = /^page-(\d+)$/;
/** How many paragraphs a preview shows: the first 20, or for a PDF its whole first page
 * if that is longer, up to 200 (decision 0149). */
export function previewLength(paragraphs: readonly DocParagraph[], least: number): number {
  const first = paragraphs[0]?.part;
  if (!first || !pagePart.test(first)) return least;
  const onFirstPage = paragraphs.findIndex((paragraph) => paragraph.part !== first);
  return Math.min(200, Math.max(least, onFirstPage < 0 ? paragraphs.length : onFirstPage));
}
/** First paragraphs with their replacements applied, and where each landed; a PDF's
 * paragraphs also say which page and which table they are on. */
export function previewParagraphs(
  paragraphs: readonly DocParagraph[],
  edits: ReadonlyMap<number, readonly Replacement[]> | undefined,
  limit: number,
): { text: string; marks: { start: number; end: number }[]; page?: number; table?: number }[] {
  return paragraphs.slice(0, limit).map((paragraph) => {
    const page = pagePart.exec(paragraph.part)?.[1];
    const applied = applyReplacements(paragraph.text, edits?.get(paragraph.id) ?? []);
    return {
      ...applied,
      ...(page ? { page: Number(page) } : {}),
      ...(paragraph.table === undefined ? {} : { table: paragraph.table }),
    };
  });
}

/** The document's edits without the values the user chose to keep (decision 0079). */
export function keepReplacements(edits: DocEdits, kept: ReadonlySet<string>): DocEdits {
  if (!kept.size) return edits;
  const paragraphs = new Map<number, Replacement[]>();
  for (const [id, replacements] of edits.paragraphs) {
    const left = replacements.filter((replacement) => !kept.has(replacement.text));
    if (left.length) paragraphs.set(id, left);
  }
  return {
    paragraphs,
    links: new Map([...edits.links].filter(([, alias]) => !kept.has(alias))),
  };
}
/** Every alias the document's edits write, for counting. */
export function* editedAliases(edits: DocEdits): Generator<string> {
  for (const replacements of edits.paragraphs.values())
    for (const replacement of replacements) yield replacement.text;
  yield* edits.links.values();
}
export const editedPlaces = (edits: DocEdits) =>
  [...edits.paragraphs.values()].reduce((sum, list) => sum + list.length, 0);

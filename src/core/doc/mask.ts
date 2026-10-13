import type { Detection } from "../detection/types.ts";
import type { Finding } from "../review.ts";
import { AliasBook, detectionReplacements } from "../sheet/mask.ts";
import {
  applyReplacements,
  restoreReplacements,
  type DocEdits,
  type DocParagraph,
  type Replacement,
} from "./docx.ts";

const emailShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mask every paragraph with its detections; one alias per type and value across the
 * document, and `mailto:` link targets get the same email alias as the text. */
export function maskParagraphs(
  paragraphs: readonly DocParagraph[],
  detections: ReadonlyMap<number, readonly Detection[]>,
  scope: string,
  mailto: readonly string[] = [],
): { edits: DocEdits; findings: Finding[]; masked: number } {
  const existing = paragraphs
    .map((paragraph) => paragraph.text)
    .filter((text) => text.includes("["));
  const book = new AliasBook(scope, (alias) => existing.some((text) => text.includes(alias)));
  const edits: DocEdits = { paragraphs: new Map(), links: new Map() };
  let masked = 0;
  for (const paragraph of paragraphs) {
    const replacements = detectionReplacements(
      paragraph.text,
      detections.get(paragraph.id) ?? [],
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
  const unknown = new Set<string>();
  let restored = 0;
  for (const paragraph of paragraphs) {
    if (!paragraph.text.includes("[")) continue;
    const result = restoreReplacements(paragraph.text, findings);
    result.unknown.forEach((alias) => unknown.add(alias));
    if (!result.replacements.length) continue;
    restored += result.replacements.length;
    edits.paragraphs.set(paragraph.id, result.replacements);
  }
  const values = new Map(findings.map((finding) => [finding.alias, finding.value]));
  for (const address of mailto) {
    const value = values.get(address);
    if (value) edits.links.set(address, value);
  }
  return { edits, restored, unknown: [...unknown] };
}

/** First paragraphs with their replacements applied, and where each landed. */
export function previewParagraphs(
  paragraphs: readonly DocParagraph[],
  edits: ReadonlyMap<number, readonly Replacement[]> | undefined,
  limit: number,
): { text: string; marks: { start: number; end: number }[] }[] {
  return paragraphs
    .slice(0, limit)
    .map((paragraph) => applyReplacements(paragraph.text, edits?.get(paragraph.id) ?? []));
}

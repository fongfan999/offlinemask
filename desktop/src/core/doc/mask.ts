import { fold, searchIndex } from "../detection/labelled-fields.ts";
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
/** Field instructions carry Word syntax ("PAGE", "MERGEFORMAT", "HYPERLINK"), never prose. */
const prose = new Set(["TEN", "DIA_CHI", "TO_CHUC"]);

const alphanumeric = /[\p{L}\p{N}]/u;
/** A value hidden once is hidden wherever else it appears whole in the document, with
 * the same alias (decision 0171): the detector reads each paragraph on its own, and
 * a value's second occurrence may sit where its cue is missing, a transfer line whose
 * account number text recognition garbled before the name, or a form whose label a
 * line break split. Only values that mean the same wherever they stand: a person's
 * name of two words or more, or six characters with a digit (an account, a phone, an
 * identity number). Not places or organizations: "Thành phố Hồ Chí Minh" hidden as a
 * residence is kept inside "Ủy ban nhân dân Thành phố Hồ Chí Minh" (decision 0159), and
 * repeating it there masked 28 such phrases on the scanned set. These lose to any
 * detection at the same place.
 *
 * A name is also found with other tone marks, or none, where every word of it is
 * capitalised (decision 0175): text recognition reads a copier's "NGÔ" under a signature
 * as "NGÕ", and a transfer writes the name without marks. */
export function repeatedValues(
  paragraphs: readonly DocParagraph[],
  detections: ReadonlyMap<number, readonly Detection[]>,
): Map<number, Detection[]> {
  const values = new Map<string, Detection>();
  for (const paragraph of paragraphs)
    for (const detection of detections.get(paragraph.id) ?? []) {
      const value = paragraph.text.slice(detection.start, detection.end);
      const qualifies =
        (detection.type === "TEN" && /\S\s+\S/u.test(value.trim())) ||
        (!prose.has(detection.type) && value.length >= 6 && /\p{N}/u.test(value));
      if (qualifies && !values.has(value)) values.set(value, detection);
    }
  const names = new Map<string, Detection>();
  for (const [value, detection] of values) {
    const folded = fold(value).replace(/\s+/gu, " ").trim();
    if (detection.type === "TEN" && !names.has(folded)) names.set(folded, detection);
  }
  const repeats = new Map<number, Detection[]>();
  for (const paragraph of paragraphs) {
    const own = detections.get(paragraph.id) ?? [];
    const extra: Detection[] = [];
    const add = (at: number, end: number, detection: Detection, taken: readonly Detection[]) => {
      const whole =
        !(at > 0 && alphanumeric.test(paragraph.text[at - 1]!)) &&
        !(end < paragraph.text.length && alphanumeric.test(paragraph.text[end]!));
      if (!whole || taken.some((other) => other.start < end && other.end > at)) return;
      extra.push({
        ...detection,
        start: at,
        end,
        source: "Giá trị đã ẩn ở chỗ khác trong tài liệu",
        reason: "Cùng giá trị đã được ẩn ở đoạn khác của tài liệu.",
        priority: 1,
      });
    };
    for (const [value, detection] of values)
      for (
        let at = paragraph.text.indexOf(value);
        at >= 0;
        at = paragraph.text.indexOf(value, at + 1)
      )
        add(at, at + value.length, detection, own);
    if (names.size) {
      const search = searchIndex(paragraph.text);
      const spaced = search.value.replace(/\s/gu, " ");
      for (const [value, detection] of names)
        for (let at = spaced.indexOf(value); at >= 0; at = spaced.indexOf(value, at + 1)) {
          const start = search.starts[at]!;
          const end = search.ends[at + value.length - 1]!;
          const words = paragraph.text.slice(start, end).split(/\s+/u);
          if (words.every((word) => /^\p{Lu}/u.test(word)))
            add(start, end, detection, [...own, ...extra]);
        }
    }
    if (extra.length) repeats.set(paragraph.id, extra);
  }
  return repeats;
}

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
  const repeats = repeatedValues(paragraphs, detections);
  let masked = 0;
  for (const paragraph of paragraphs) {
    const found = [...(detections.get(paragraph.id) ?? []), ...(repeats.get(paragraph.id) ?? [])];
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

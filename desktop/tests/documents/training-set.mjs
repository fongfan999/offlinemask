// Turns synthetic documents into training records for the pack's models (decision
// 0163): the plain text the app's readers produce, with character spans labelled
// PERSON, LOCATION or ORGANIZATION from each document's hide list, the keep list as
// explicit negatives and the ignore list as spans the loss must not count.
//
// The hide list names values, not categories; the category is read off the value with
// the detection vocabulary, so the generator needs no second list and a value the
// vocabulary cannot place (a phone, an account, a date, a code) stays unlabelled: the
// structured rules hide those, not the models.
import organizations from "../../src/core/detection/vocabulary/organizations.json" with { type: "json" };
import units from "../../src/core/detection/vocabulary/units.json" with { type: "json" };
import { openDocument } from "../../src/core/doc/document.ts";

/** Seeds no training set may hold: 1–7 are the 0153 set, 8–26 the wider set of 0160,
 * both measured by every decision since. The owner's private sets are never generated,
 * so they are held out by construction. */
export const heldOutSeeds = { from: 1, to: 26 };
export const isHeldOut = (seed) => seed >= heldOutSeeds.from && seed <= heldOutSeeds.to;

export const labels = ["PERSON", "LOCATION", "ORGANIZATION"];

const fold = (text) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A regex source matching any of the words at a word boundary, in the given form. */
const anyWord = (words, form) =>
  `(?:${[...new Set(words.map(form))]
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|")})`;
const organizationStart = new RegExp(
  `^${anyWord([...organizations.legalForms, ...organizations.kinds], (w) => w.toLowerCase())}(?!\\p{L})`,
  "u",
);
const organizationStartFolded = new RegExp(
  `^${anyWord([...organizations.legalForms, ...organizations.kinds], fold)}(?!\\p{L})`,
  "u",
);
const addressWord = new RegExp(
  `(?<!\\p{L})${anyWord([...units.addressWords, ...units.addressUnits], (w) => w.toLowerCase())}(?!\\p{L})`,
  "u",
);
/** A name: letters only, as a document prints it or in capitals, up to six syllables. */
const personShape = /^\p{L}+(?:[ \p{L}]+)?$/u;

/** The model label of a hidden value, or undefined for a value the models do not learn. */
export function labelOf(value) {
  const lower = value.toLowerCase();
  const folded = fold(value);
  if (organizationStart.test(lower) || organizationStartFolded.test(folded)) return "ORGANIZATION";
  if (/^(số\s+)?\d/u.test(lower) && /\p{L}/u.test(value)) return "LOCATION";
  // Address words keep their tone marks (decision 0161): "Ngô" is a family name, "ngõ" a lane.
  if (addressWord.test(lower)) return "LOCATION";
  if (personShape.test(value) && value.trim().split(/\s+/u).length <= 6) return "PERSON";
  return undefined;
}

/** Every place `value` stands in `text`, whole-word, allowing the reader to have changed
 * a run of whitespace (a line break, two spaces) inside it. Offsets in UTF-16 units. */
export function occurrences(text, value, within) {
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${value.trim().split(/\s+/u).map(escape).join("\\s+")}(?![\\p{L}\\p{N}])`,
    "gu",
  );
  const found = [];
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    const end = start + match[0].length;
    if (within && (start < within.start || end > within.end)) continue;
    found.push({ start, end });
  }
  return found;
}

/** Spans for one list over one paragraph: `{ value, in }` entries only inside their
 * context, everything else wherever it stands. `label` maps a value to its label, or
 * to undefined to skip it. */
function spansOf(text, entries, label) {
  const spans = [];
  for (const entry of entries) {
    const value = typeof entry === "string" ? entry : entry.value;
    const kind = label(value);
    if (!kind) continue;
    const contexts =
      typeof entry === "string" ? [undefined] : occurrences(text, entry.in).map((at) => at);
    for (const within of contexts)
      for (const at of occurrences(text, value, within)) spans.push({ ...at, label: kind });
  }
  return spans;
}

/** Longest first; a span overlapping one already taken is dropped. */
function resolve(spans) {
  const taken = [];
  for (const span of [...spans].sort((a, b) => a.start - b.start || b.end - a.end))
    if (!taken.some((other) => span.start < other.end && span.end > other.start)) taken.push(span);
  return taken;
}

/** UTF-16 offsets become code-point offsets, which is how Python indexes a string. */
function codePoints(text) {
  if (!/[\uD800-\uDFFF]/u.test(text)) return (offset) => offset;
  const map = [];
  let point = 0;
  for (let i = 0; i < text.length; i++) {
    map[i] = point;
    const code = text.charCodeAt(i);
    if (code < 0xd800 || code > 0xdbff) point++;
  }
  map[text.length] = point;
  return (offset) => map[offset];
}

/** Training records for the documents of one seed: one per paragraph the reader
 * produced, in document order, with the document's identity so a trainer can pack
 * consecutive paragraphs as the app's scanner joins them. Returns the records and a
 * tally of hidden values by label (`structured` is what no label fits). */
export async function trainingRecords(documents) {
  const records = [];
  const tally = { PERSON: 0, LOCATION: 0, ORGANIZATION: 0, structured: 0, unmatched: [] };
  for (const { name, bytes, expect } of documents) {
    const { kind, layout, variant, seed } = expect.generated;
    const opened = await openDocument(bytes, name);
    const document = `seed-${seed}/${name}`;
    const texts = opened.paragraphs.map((paragraph) => paragraph.text);
    const hidden = expect.hide ?? [];
    for (const entry of hidden) {
      const value = typeof entry === "string" ? entry : entry.value;
      const label = labelOf(value);
      if (!label) tally.structured++;
      else tally[label]++;
      const context = typeof entry === "string" ? value : entry.in;
      if (label && !texts.some((text) => occurrences(text, context).length))
        tally.unmatched.push({ document, value });
    }
    texts.forEach((text, index) => {
      if (!/\p{L}/u.test(text)) return;
      const at = codePoints(text);
      const convert = (span) => ({ ...span, start: at(span.start), end: at(span.end) });
      const spans = resolve(spansOf(text, hidden, labelOf)).map(convert);
      const negatives = resolve(spansOf(text, expect.keep ?? [], () => "KEEP")).map(
        ({ start, end }) => ({ start, end }),
      );
      const ignore = resolve(spansOf(text, expect.ignore ?? [], () => "IGNORE")).map(
        ({ start, end }) => ({ start, end }),
      );
      records.push({
        id: `${document}#${index}`,
        document,
        seed,
        kind,
        layout,
        variant,
        format: name.split(".").at(-1),
        paragraph: index,
        text,
        spans,
        negatives,
        ignore,
      });
    });
  }
  return { records, tally };
}

/** "100-131" or "100" into the seeds it names, rejecting any held-out seed. */
export function seedRange(text) {
  const match = /^(\d+)(?:-(\d+))?$/.exec(text ?? "");
  if (!match) throw new Error(`Not a seed range: ${JSON.stringify(text)}`);
  const from = Number(match[1]);
  const to = Number(match[2] ?? match[1]);
  if (to < from) throw new Error(`Empty seed range: ${text}`);
  const seeds = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const held = seeds.filter(isHeldOut);
  if (held.length)
    throw new Error(
      `Seeds ${heldOutSeeds.from}–${heldOutSeeds.to} are held out for measurement (decisions 0153 and 0160); ${held.join(", ")} cannot be exported.`,
    );
  return seeds;
}

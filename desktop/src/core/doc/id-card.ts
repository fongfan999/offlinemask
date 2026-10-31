import { searchIndex } from "../detection/labelled-fields.ts";
import type { Detection } from "../detection/types.ts";
import { vocabulary } from "../detection/vocabulary.ts";
import type { DocParagraph } from "./docx.ts";

/** A citizen identity card copied into a document (decision 0176), the way contracts and
 * applications are filed: everything on it is the holder's (the number, name, dates, home
 * town, residence, distinguishing marks and the machine-readable lines, which repeat them),
 * and its printed wording is the same on every card. Its labels are small and bilingual,
 * so text recognition garbles most of them ("Ngty dm/Dac cbữ: 04/08/1968") and no label
 * rule can find the values after them. So the card is found by its title in capitals
 * ("CĂN CƯỚC CÔNG DÂN") or its machine-readable lines ("IDVNM…"), and from there to the
 * end of those lines all of its text is hidden but the printed wording. A card's lines may
 * be joined into one paragraph or split over several; the card ends with its machine
 * lines, at the end of its page, or after `longest` paragraphs. */
const card = vocabulary.wording.identityCard;
/** A copier's specks may be read as a dot or a colon between the title's words ("CĂN.
 * CƯỚC: CÔNG DÂN", decision 0178). */
const front = new RegExp(
  card.fronts.replaceAll("[^\\S\\r\\n]+", "[^\\S\\r\\n]*[.:,·]?[^\\S\\r\\n]+"),
  "gu",
);
const wording = new RegExp(card.wording, "gu");
/** TD1's first line, as read: "IDVNM", the 0 of "ID" sometimes read as "O" or "0". */
const machineStart = /i[do0]vnm/gu;
const longest = 25;
/** Text that is only spaces and punctuation at a piece's ends. */
const edge = /^[\s·:;,./\\|()\-–]+|[\s·:;,./\\|()\-–]+$/gu;

function finding(start: number, end: number): Detection {
  return {
    start,
    end,
    type: "GIAY_TO",
    label: "Căn cước",
    priority: 1,
    source: "Căn cước công dân · id-card-v1",
    reason: "Thông tin trên căn cước công dân được sao trong tài liệu.",
  };
}

/** The holder's text in `text` between `from` and `to`: the stretch less the card's
 * wording and what is already detected, each piece trimmed of punctuation. */
function pieces(
  text: string,
  from: number,
  to: number,
  taken: readonly Detection[],
  search = searchIndex(text),
): { values: Detection[]; wording: [number, number][] } {
  const printed: [number, number][] = [];
  for (const match of search.value.matchAll(wording)) {
    const start = search.starts[match.index]!;
    const end = search.ends[match.index + match[0].length - 1]!;
    if (end > from) printed.push([start, end]);
  }
  // Another rule's find inside the printed wording is dropped (`maskParagraphs`).
  const kept = taken.filter(
    (detection) =>
      !printed.some(([start, end]) => detection.start >= start && detection.end <= end),
  );
  const holes = [...kept.map((detection) => [detection.start, detection.end] as const), ...printed];
  holes.sort((a, b) => a[0] - b[0]);
  const out: Detection[] = [];
  let at = from;
  const emit = (start: number, end: number) => {
    const piece = text.slice(start, end);
    const lead = piece.length - piece.replace(/^[\s·:;,./\\|()\-–]+/u, "").length;
    const trimmed = piece.replace(edge, "");
    if (/[\p{L}\p{N}]/u.test(trimmed))
      out.push(finding(start + lead, start + lead + trimmed.length));
  };
  for (const [start, end] of holes) {
    if (end <= at || start >= to) continue;
    if (start > at) emit(at, Math.min(start, to));
    at = Math.max(at, end);
  }
  if (at < to) emit(at, to);
  return { values: out, wording: printed };
}

const capitalised = (text: string) => text.split(/\s+/u).every((word) => /^\p{Lu}/u.test(word));

export function cardValues(
  paragraphs: readonly DocParagraph[],
  taken: (id: number) => readonly Detection[],
): Map<number, { values: Detection[]; wording: [number, number][] }> {
  const found = new Map<number, { values: Detection[]; wording: [number, number][] }>();
  /** The card being read: its page, the paragraphs it may still take, and once its first
   * machine line is passed, how many more machine lines may follow. */
  let zone: { part: string; left: number; machine?: number } | undefined;
  for (const paragraph of paragraphs) {
    const { text } = paragraph;
    const search = searchIndex(text);
    let from: number | undefined;
    if (zone && zone.part !== paragraph.part) zone = undefined;
    if (zone?.machine !== undefined) {
      // After the first machine line, only more of them: capitals, digits and fillers.
      if (zone.machine > 0 && !/\p{Ll}/u.test(text) && text.trim().length >= 10) {
        zone.machine--;
        from = 0;
      } else zone = undefined;
    } else if (zone) {
      if (zone.left-- > 0) from = 0;
      else zone = undefined;
    }
    if (!zone)
      for (const match of search.value.matchAll(front)) {
        const start = search.starts[match.index]!;
        const end = search.ends[match.index + match[0].length - 1]!;
        if (!capitalised(text.slice(start, end))) continue;
        zone = { part: paragraph.part, left: longest };
        from = end;
        break;
      }
    for (const match of search.value.matchAll(machineStart)) {
      const start = search.starts[match.index]!;
      if (!/^[I1l][DO0]VNM/u.test(text.slice(start))) continue;
      // The other two lines follow, joined to this one or as paragraphs of their own.
      from = Math.min(from ?? start, start);
      zone = { part: paragraph.part, left: 0, machine: 2 };
      break;
    }
    if (from === undefined) continue;
    found.set(paragraph.id, pieces(text, from, text.length, taken(paragraph.id), search));
  }
  return found;
}

import type { Detection } from "./types.ts";
import { vocabulary } from "./vocabulary.ts";

const unit = new RegExp(
  `^(?:${vocabulary.units.addressUnitAlternation}\\s+|${vocabulary.units.addressAbbreviationAlternation}\\.\\s*)`,
);
const addressContext = new RegExp(`${vocabulary.labels.addressContext}\\b`);
const factWords = new RegExp(`\\b${vocabulary.labels.factWords}\\b`);
const house = /^\d{1,5}[a-z]?(?:\/\d{1,5}[a-z]?)*\s+/;
/** The provinces and cities (the 34 since July 2025 and the names before), a closed public
 * list like the countries of 0155: an address ends after one of them (decision 0160). */

/** Where a labelled address ends when the reader joined the next sentence to it
 * ("… TP. Hồ Chí Minh Tổng số tháng …"): after the province or city, when a capitalized
 * word follows without a comma. Returns the end within `value`, or undefined. */
const provinceAfterKind = new RegExp(
  `(?:^|[\\s,])${vocabulary.places.kindAlternation}\\.?[^\\S\\r\\n]*${vocabulary.places.provinceAlternation}(?![\\p{L}\\p{M}])(?:,[^\\S\\r\\n]*việt nam)?`,
  "giu",
);
export function provinceEnd(value: string): number | undefined {
  const text = value.normalize("NFC");
  for (const match of text.matchAll(provinceAfterKind)) {
    const end = match.index + match[0].length;
    // Case matters here: a new sentence starts with a capital, prose does not.
    if (/^[^\S\r\n]+(?!Việt Nam)\p{Lu}/u.test(text.slice(end))) return end;
  }
  return undefined;
}

const road = new RegExp(`^${vocabulary.units.roadAlternation}\\s+`);
const properValue =
  /^(?:[\p{Lu}\p{N}][\p{L}\p{M}\p{N}/-]*)(?:\s+[\p{Lu}\p{N}][\p{L}\p{M}\p{N}/-]*){0,9}$/u;
const splitUnit = new RegExp(`(?:^|\\s)${vocabulary.units.addressUnitOrRoadAlternation}$`);

function continuesAddressLine(before: string, after: string) {
  // Join one wrapped component only. Final acceptance still requires a proper
  // value and textual address-model evidence; never bridge a blank paragraph.
  if (/^[^\S\r\n]*[\r\n]/u.test(after)) return false;
  const lead = folded(before).trim();
  const trailingUnit = splitUnit.exec(lead);
  if (trailingUnit && (!lead.slice(0, trailingUnit.index).trim() || addressContext.test(lead)))
    return true;
  const number = /(?:^|\s)\d{1,5}[a-z]?(?:\/\d{1,5}[a-z]?)*$/u.exec(lead);
  if (!number || !road.test(folded(after).trimStart())) return false;
  const context = lead.slice(0, number.index).trim();
  return !context || addressContext.test(context) || /(?:^|\s)o$/u.test(context);
}

function folded(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
}

/** Components stop at sentence/field boundaries, including a tab (a table cell, decision
 * 0155); administrative abbreviations keep their dots. */
function components(text: string) {
  const result: { start: number; end: number }[] = [];
  let start = 0;
  function push(end: number) {
    while (start < end && /\s/u.test(text[start]!)) start++;
    while (end > start && /\s/u.test(text[end - 1]!)) end--;
    if (end > start) result.push({ start, end });
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (!/[,;!?\r\n.\t]/u.test(char)) continue;
    if (char === "\r" || char === "\n") {
      const next = i + (char === "\r" && text[i + 1] === "\n" ? 2 : 1);
      if (
        i - start <= 180 &&
        continuesAddressLine(text.slice(start, i), text.slice(next, next + 80))
      ) {
        i = next - 1;
        continue;
      }
    }
    if (char === ".") {
      const word = text.slice(start, i).match(/([\p{L}]+)$/u)?.[1] ?? "";
      if (/^(p|q|tp|tx|tt)$/i.test(word)) continue;
      if (/\d/.test(text[i - 1] ?? "") && /\d/.test(text[i + 1] ?? "")) continue;
    }
    push(i);
    start = i + 1;
  }
  push(text.length);
  return result;
}

/** Extend existing model address evidence over bounded, explicit address components.
 * This is a boundary policy, not a standalone address recognizer or an address gazetteer.
 */
export function completeAddressBoundaries(
  text: string,
  detections: readonly Detection[],
): Detection[] {
  const seeds = detections.filter((d) => d.type === "DIA_CHI");
  if (!seeds.length) return [...detections];
  const candidates: { start: number; end: number; seeded: boolean }[] = [];
  const parts = components(text);
  for (const [index, component] of parts.entries()) {
    if (component.end - component.start > 180) continue;
    // A numbered street before a comma is seeded by the ward or city after it ("370 Huỳnh
    // Văn Bánh, Phường Hải Châu …"), which the model found (decision 0160).
    const following = parts[index + 1];
    const continues =
      !!following &&
      /^[^\S\r\n]*,[^\S\r\n]*$/u.test(text.slice(component.end, following.start)) &&
      seeds.some((d) => d.start < following.end && d.end > following.start);
    const source = text.slice(component.start, component.end);
    // Build a folded index only for matching labels; keep exact source offsets.
    let search = "";
    const offsets: number[] = [];
    for (const { segment, index } of new Intl.Segmenter("vi", { granularity: "grapheme" }).segment(
      source,
    )) {
      const value = folded(segment);
      search += value;
      for (let i = 0; i < value.length; i++) offsets.push(index);
    }
    // Try only word boundaries, so a prefix inside a name cannot start an address.
    for (const match of search.matchAll(/(?:^|\s)(?=\S)/g)) {
      const at = match.index + match[0].length;
      const tail = search.slice(at);
      const prefix = tail.match(unit)?.[0];
      const number = tail.match(house)?.[0];
      const start = component.start + offsets[at]!;
      // A word inside an organization's or a person's name ("… Tân Phong 370 Huỳnh Văn
      // Bánh": "Phong" is not a room) cannot start the address (decision 0160).
      if (
        detections.some(
          (d) => (d.type === "TO_CHUC" || d.type === "TEN") && d.start < start && d.end > start,
        )
      )
        continue;
      const seeded = seeds.some((d) => d.start < component.end && d.end > start);
      const raw = text.slice(start, component.end).normalize("NFC");
      const valueStart = at + (prefix?.length ?? 0);
      const value = source.slice(offsets[valueStart] ?? source.length).normalize("NFC");
      const hasContext = addressContext.test(folded(text.slice(Math.max(0, start - 90), start)));
      // Known labels may use numeric values; bare streets require a proper name.
      const numberedStreet = /^so\s+\d{1,5}[a-z]?(?:\/\d{1,5}[a-z]?)*\s+/u.exec(tail);
      const numberedValue = numberedStreet
        ? source.slice(offsets[at + numberedStreet[0].length] ?? source.length).normalize("NFC")
        : "";
      const typed =
        (!!prefix && properValue.test(value)) ||
        (!!numberedStreet && properValue.test(numberedValue) && /\p{L}/u.test(numberedValue));
      const roadPrefix = number ? tail.slice(number.length).match(road)?.[0] : undefined;
      const streetNameStart = at + (number?.length ?? 0) + (roadPrefix?.length ?? 0);
      const streetName = source.slice(offsets[streetNameStart] ?? source.length).normalize("NFC");
      const street =
        !!number &&
        properValue.test((roadPrefix ? streetName : raw).split(",")[0]!.trim()) &&
        /\p{L}/u.test(raw) &&
        (seeded || continues || hasContext);
      const locality =
        at === 0 && seeds.some((d) => d.start <= start && d.end > start) && properValue.test(raw);
      if (!(typed || street || locality) || factWords.test(tail)) continue;
      candidates.push({ start, end: component.end, seeded });
      break;
    }
  }
  const additions: Detection[] = [];
  let group: typeof candidates = [];
  function flush() {
    // A room/floor number alone is ambiguous in ordinary building prose.
    // Extend labels only when this connected address has textual model evidence.
    if (
      group.some(
        (c) =>
          c.seeded &&
          seeds.some(
            (d) =>
              d.start < c.end &&
              d.end > c.start &&
              /\p{L}/u.test(text.slice(Math.max(d.start, c.start), Math.min(d.end, c.end))),
          ),
      )
    ) {
      const first = group[0]!,
        last = group[group.length - 1]!;
      let start = first.start,
        end = last.end;
      // A boundary repair cannot discard a tail already covered by an address
      // prediction merely because the new prefix has stronger priority.
      let expanded = true;
      while (expanded) {
        expanded = false;
        for (const seed of seeds)
          if (seed.start < end && seed.end > start) {
            if (seed.start < start || seed.end > end) expanded = true;
            start = Math.min(start, seed.start);
            end = Math.max(end, seed.end);
          }
      }
      additions.push({
        start,
        end,
        type: "DIA_CHI",
        label: "Địa chỉ",
        priority: 51,
        source: "Gói nhận diện · địa chỉ",
        reason: "Gộp các thành phần địa chỉ liền nhau. Hãy kiểm tra lại phạm vi được ẩn.",
      });
    }
    group = [];
  }
  for (const candidate of candidates) {
    const previous = group[group.length - 1];
    // Never bridge prose, semicolons, sentence endings, or more than one line break.
    const between = previous ? text.slice(previous.end, candidate.start) : "";
    if (
      previous &&
      (between.length > 12 || !/^[^\S\r\n]*,?[^\S\r\n]*(?:\r?\n[^\S\r\n]*)?$/u.test(between))
    )
      flush();
    group.push(candidate);
  }
  flush();
  return [...detections, ...additions];
}

import ipaddr from "ipaddr.js";
import type { Detection } from "./types.ts";
import { vocabulary } from "./vocabulary.ts";
import {
  fold,
  searchIndex,
  reconcileLabelledFields,
  type LabelledFields,
} from "./labelled-fields.ts";

const horizontal = "[^\\S\\r\\n]";
const fieldLabels = new RegExp(
  `(?<![a-z0-9_])(${vocabulary.labels.birthDate}|${vocabulary.labels.operationalDates})(?![a-z0-9_])`,
  "g",
);
const birthLabel = new RegExp(`^${vocabulary.labels.birthDate}$`);
const datePrefix = new RegExp(
  `^(?:ngay${horizontal}+)?(\\d{1,2})${horizontal}+thang${horizontal}+(\\d{1,2})${horizontal}+nam${horizontal}+(\\d{4})(?![a-z0-9_/])`,
);
const numericDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?![a-z0-9_/])/;
const legalPrefix = new RegExp(
  `(?<![a-z0-9_])${vocabulary.organizations.legalPrefixAlternation}(?![a-z0-9_])`,
  "g",
);
const bridge = new RegExp(
  `^${horizontal}*(?:[:：=]${horizontal}*|${horizontal}+(?:(?:cua${horizontal}+(?:khach(?:${horizontal}+hang)?|toi)${horizontal}+)?(?:duoc${horizontal}+ghi${horizontal}+)?(?:la${horizontal}+)?)?)`,
);
const { tradeSyllables, compounds } = vocabulary.organizations;
const { provinces } = vocabulary.places;
const nameStop = new RegExp(
  `^(?:${vocabulary.organizations.nameStopAlternation}|${vocabulary.organizations.nameStopNumberedAlternation}[^\\S\\r\\n]+\\d+)(?![\\p{L}\\p{M}])`,
  "iu",
);
const unitStop = new RegExp(
  `^${vocabulary.organizations.nameUnitStopAlternation}(?![\\p{L}\\p{M}])(?![^\\S\\r\\n]+khám)`,
  "iu",
);
const partyLabel = new RegExp(
  `(?:${vocabulary.organizations.partyLabelAlternation}(?: [a-z]| \\d{1,2}| [a-z]+(?: [a-z]+)?)?)[^\\S\\r\\n]*[:：][^\\S\\r\\n]*$`,
  "u",
);

function calendarDate(match: RegExpExecArray) {
  const [, day, month, year] = match.map(Number);
  if (!day || !month || !year || year < 1900) return false;
  const value = new Date(Date.UTC(year, month - 1, day));
  return (
    value.getUTCFullYear() === year &&
    value.getUTCMonth() === month - 1 &&
    value.getUTCDate() === day
  );
}
function finding(start: number, end: number, type: string, label: string): Detection {
  return {
    start,
    end,
    type,
    label,
    priority: 125,
    source: "Ngữ nghĩa trường · context-fields-v2",
    reason: "Giá trị theo định dạng và ngữ cảnh trường; hãy kiểm tra lại phạm vi được ẩn.",
  };
}

/** Exact source spans; no normalization of returned values and no network APIs. */
export function detectContextFields(
  text: string,
  seeds: readonly Detection[] = [],
): LabelledFields {
  const fields: LabelledFields = { detections: [], labels: [], emptyValues: [] };
  // Inspect maximal tokens: never accept the valid prefix of an invalid address.
  for (const match of text.matchAll(/[\p{L}\p{M}\p{N}_:.%\/-]+/gu)) {
    let value = match[0];
    const label = /^(?:ip|ipv6):/iu.exec(value)?.[0] ?? "";
    const start = match.index + label.length;
    value = value.slice(label.length);
    if (!value.includes(":") || value.length > 128 || value.includes("/")) continue;
    if (value.endsWith(".")) value = value.slice(0, -1); // sentence punctuation only
    if (
      value === "::" &&
      !/\bip(?:v6)?\s*[:：=]?\s*$/iu.test(text.slice(Math.max(0, match.index - 20), match.index))
    )
      continue;
    if (!ipaddr.IPv6.isValid(value)) continue;
    fields.detections.push(finding(start, start + value.length, "IP", "Địa chỉ IP"));
  }
  const search = searchIndex(text);
  const ipv4Label =
    /(?<![a-z0-9_])(?:dia chi )?ip(?:v4)?(?: dang nhap)?(?![a-z0-9_])[^\S\r\n]*(?:[:：=][^\S\r\n]*|[^\S\r\n]+)/gu;
  for (const match of search.value.matchAll(ipv4Label)) {
    const at = match.index + match[0].length;
    const token = /^[\p{L}\p{M}\p{N}_:.%\/-]+/u.exec(search.value.slice(at))?.[0];
    if (!token) continue;
    const value = token.endsWith(".") ? token.slice(0, -1) : token;
    if (!ipaddr.IPv4.isValidFourPartDecimal(value)) continue;
    const start = search.starts[at]!,
      end = search.ends[at + value.length - 1]!;
    fields.detections.push(finding(start, end, "IP", "Địa chỉ IP"));
  }
  for (const match of search.value.matchAll(fieldLabels)) {
    const labelStart = match.index,
      labelEnd = labelStart + match[0].length;
    const after = search.value.slice(labelEnd, labelEnd + 140);
    const birthday = birthLabel.test(match[1]!);
    // A bounded capitalized name followed by an explicit copula. Do not suppress
    // that intervening name when reconciling the field label with model evidence.
    const originalAfter = text.slice(search.ends[labelEnd - 1]!, search.ends[labelEnd - 1]! + 180);
    const named = birthday
      ? /^[^\S\r\n]+(?:của|cua)[^\S\r\n]+(?:[\p{Lu}][\p{L}\p{M}'’ʼ-]*[^\S\r\n]+){1,6}(?:là|la)[^\S\r\n]+/u.exec(
          originalAfter.normalize("NFC"),
        )?.[0]
      : undefined;
    const namedBridge = named ? fold(named) : undefined;
    const separator = namedBridge ?? bridge.exec(after)?.[0];
    if (!separator) continue;
    const at = labelEnd + separator.length,
      tail = search.value.slice(at, at + 100);
    const label = match[1]!;
    let value: RegExpExecArray | null;
    if (birthday || label.startsWith("ngay ")) {
      value = datePrefix.exec(tail) ?? numericDate.exec(tail);
      if (!value || !calendarDate(value)) continue;
    } else if (/^(phien ban|version)/.test(label)) {
      value = /^\d{1,4}(?:\.\d{1,4}){2,3}(?![a-z0-9_+-]|\.\d)/u.exec(tail);
    } else if (/^(ma http|http status)/.test(label)) {
      value = /^[1-5]\d{2}(?![a-z0-9_]|\.\d)/u.exec(tail);
    } else {
      value = /^\d{1,6}(?![a-z0-9_]|[.,]\d)/u.exec(tail);
    }
    if (!value) continue;
    const start = search.starts[at]!,
      end = search.ends[at + value[0].length - 1]!;
    fields.labels.push({
      start: search.starts[labelStart]!,
      end: namedBridge ? search.ends[labelEnd - 1]! : start,
    });
    if (birthday) fields.detections.push(finding(start, end, "NGAY_SINH", "Ngày sinh"));
    else fields.emptyValues.push({ start, end }); // validated operational facts stay visible
  }

  for (const match of search.value.matchAll(legalPrefix)) {
    const start = search.starts[match.index]!,
      prefixEnd = search.ends[match.index + match[0].length - 1]!;
    let cursor = prefixEnd,
      end = prefixEnd,
      capitals = 0,
      acronym = false,
      tokens = 0,
      last = "";
    for (; tokens < 12; tokens++) {
      // A name never continues into the next table cell (a tab). An abbreviation with its
      // period before another capital ("TP. HCM") is one token (decision 0159).
      const token =
        /^[^\S\r\n\t]+([\p{Lu}]{1,3}\.(?=[^\S\r\n]+[\p{Lu}\p{N}])|[\p{L}\p{M}\p{N}]+(?:[-'’][\p{L}\p{M}\p{N}]+)*)/u.exec(
          text.slice(cursor, cursor + 160),
        );
      if (!token || cursor + token[0].length - start > 180) break;
      const word = token[1]!.normalize("NFC"),
        lower = word.toLowerCase();
      // Words are compared with their tone marks: "tại" is not "tải", "Phòng" is not "Phong".
      const ahead = text
        .slice(cursor, cursor + 60)
        .normalize("NFC")
        .trimStart();
      const pair = `${last} ${lower}`;
      if (
        // Prose ("đã", "tôi"), an article ("Điều 2"), a page, an address ("Số 47 …", or a
        // bare number once the name has two capitals) and a department or ward line the
        // reader joined to the name ("Phòng Đào tạo", "Khoa Nhi") end a name; a compound
        // ("Đa khoa", "Bách khoa") and a province ("Hải Phòng") do not (decisions 0159–0161).
        nameStop.test(ahead) ||
        (unitStop.test(ahead) && !compounds.has(pair) && !provinces.has(pair)) ||
        (capitals >= 2 && /^\d+(?:\/\d+)?\s+\p{L}/u.test(ahead))
      )
        break;
      const capital = /^[\p{Lu}\p{N}]/u.test(word);
      // A lowercase word continues a name only as a trade syllable ("Vận tải", "Xây dựng")
      // or a connector ("và", "cổ phần") from the vocabulary.
      if (!capital && !tradeSyllables.has(lower)) break;
      if (capital) capitals++;
      acronym ||= /^[\p{Lu}]{2,}[\p{N}]*$/u.test(word);
      cursor += token[0].length;
      // Never end on a dangling lowercase connector, except the syllable that completes a
      // compound ("Trung ương", "Đa khoa", "Đại học").
      if (capital || compounds.has(pair)) end = cursor;
      last = lower;
    }
    if (end === prefixEnd || (capitals < 2 && !acronym)) continue;
    // Reject an overlong name rather than quietly complete just its first tokens.
    if (tokens === 12 && /^[^\S\r\n]+[\p{Lu}\p{N}]/u.test(text.slice(cursor))) continue;
    // A contract names its parties with the same legal prefix ("BÊN A: CÔNG TY …").
    const labelled = partyLabel.test(fold(text.slice(Math.max(0, start - 70), start)));
    // Model evidence anywhere on the name, the prefix included, seeds the completion;
    // a model may read "Nông sản Suối Mơ" as a place, which is still a name after the prefix.
    const seeded = seeds.some(
      (d) => ["TO_CHUC", "TEN", "DIA_CHI"].includes(d.type) && d.start < end && d.end > start,
    );
    // A legal prefix and name all in capitals ("CONG TY TNHH THUONG MAI …" in a salary
    // transfer) is a company without a label or a model's word for it (decision 0154).
    const shouted = !/\p{Ll}/u.test(text.slice(start, end)) && capitals >= 2;
    if (!labelled && !seeded && !shouted) continue;
    fields.detections.push(finding(start, end, "TO_CHUC", "Tổ chức"));
  }
  return fields;
}

export function reconcileContextFields(text: string, detections: readonly Detection[]) {
  return reconcileLabelledFields(text, detections, detectContextFields(text, detections));
}

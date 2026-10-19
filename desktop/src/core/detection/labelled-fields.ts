import type { Detection } from "./types.ts";
import { textGraphemes } from "../unicode.ts";

// Labels identify a bounded field, not an arbitrary person or place in prose.
const nameLabels =
  "ho va ten|ho ten|ten khach hang|ten nguoi nhan|ten nguoi gui|ten tren giay to|khach hang|nguoi thu huong|nguoi yeu cau|nguoi nhan|nguoi gui";
const addressLabels =
  "dia chi lien he|dia chi nhan thu|dia chi thuong tru|dia chi|noi nhan|noi o|thuong tru|d/c";
const otherLabels =
  "email|dien thoai|sdt|so dien thoai|stk|so tai khoan|tai khoan|cccd|cmnd|ma giao dich|ma khach hang|ngay sinh|ngay tiep nhan|so tien|noi dung|phi";
const fields = new RegExp(
  `(?<![a-z0-9_])(${nameLabels}|${addressLabels}|${otherLabels})[^\\S\\r\\n]*[:：][^\\S\\r\\n]*`,
  "g",
);
const names = new RegExp(`^(?:${nameLabels})$`);
const addresses = new RegExp(`^(?:${addressLabels})$`);
const missing =
  /^(?:chua (?:cung cap|co thong tin|xac dinh)|dang cap nhat|de trong|khong co|n\/a|null|[-–—]+)$/;
const prose =
  /\b(?:chua|dang cho|can bo sung|yeu cau|de nghi|se duoc|vui long|khong co|tong cong|so tien|giao dich)\b/;
const nameValue =
  /^[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*(?:[^\S\r\n]+[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*){0,7}$/u;
const addressValue = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}\s,./'’–-]*$/u;

export function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
}

/** NFC/NFD labels share a search form; all returned offsets belong to the original text. */
export function searchIndex(text: string) {
  let value = "";
  const starts: number[] = [],
    ends: number[] = [];
  for (const { segment, index } of textGraphemes(text)) {
    const folded = fold(segment);
    value += folded;
    for (let i = 0; i < folded.length; i++) {
      starts.push(index);
      ends.push(index + segment.length);
    }
  }
  return { value, starts, ends };
}

export interface LabelledFields {
  detections: Detection[];
  emptyValues: { start: number; end: number }[];
  labels: { start: number; end: number }[];
}

export function detectLabelledFields(text: string): LabelledFields {
  const search = searchIndex(text);
  const matches = [...search.value.matchAll(fields)].map((match) => ({
    label: match[1]!,
    start: search.starts[match.index!]!,
    valueStart: search.ends[match.index! + match[0].length - 1]!,
  }));
  const result: LabelledFields = {
    detections: [],
    emptyValues: [],
    labels: matches.map((field) => ({ start: field.start, end: field.valueStart })),
  };
  for (const [index, field] of matches.entries()) {
    const isName = names.test(field.label),
      isAddress = addresses.test(field.label);
    if (!isName && !isAddress) continue;
    let start = field.valueStart;
    const limit = matches[index + 1]?.start ?? text.length;
    // A label on its own line may introduce a value on the next line, not a blank paragraph.
    const newline = text.slice(start, limit).match(/^\r?\n[^\S\r\n]*/u);
    if (newline) start += newline[0].length;
    let end = start;
    for (; end < limit; end++) {
      const character = text[end]!;
      if (/[;!?\r\n:：]/u.test(character) || (isName && character === ",")) break;
      if (character === ".") {
        const word = fold(text.slice(start, end)).match(/([a-z]+)$/)?.[1];
        if (isAddress && word && /^(p|q|tp|tx|tt)$/.test(word)) continue;
        break;
      }
    }
    if (isAddress) {
      // Exported records also use comma + contact/postcode labels without a colon.
      // These labels describe another field and must not become part of the address.
      const body = searchIndex(text.slice(start, end));
      const boundary =
        /,[^\S\r\n]*(?:email|dien thoai|sdt|so dien thoai|stk|so tai khoan|tai khoan|cccd|cmnd|ma buu chinh|ma giao dich|ma khach hang|ngay sinh|so tien|phi)\b/u.exec(
          body.value,
        );
      if (boundary) end = start + body.starts[boundary.index]!;
    }
    while (end > start && /[\s,]/u.test(text[end - 1]!)) end--;
    if (end <= start || end - start > (isName ? 120 : 260)) continue;
    const value = text.slice(start, end),
      folded = fold(value).replace(/\s+/gu, " ").trim();
    if (missing.test(folded)) {
      result.emptyValues.push({ start, end });
      continue;
    }
    if (prose.test(folded) || (isName && /^(?:cong ty|phong ban|bo phan)\b/.test(folded))) continue;
    if (
      isName
        ? !nameValue.test(value)
        : !addressValue.test(value) ||
          !/\p{L}/u.test(value) ||
          value.trim().split(/\s+/u).length < 2
    )
      continue;
    result.detections.push({
      start,
      end,
      type: isName ? "TEN" : "DIA_CHI",
      label: isName ? "Họ và tên" : "Địa chỉ",
      priority: 120,
      source: "Nhãn trường · labelled-fields-v1",
      reason: "Giá trị sau nhãn họ tên hoặc địa chỉ. Hãy kiểm tra lại nội dung trường.",
    });
  }
  return result;
}

/** Explicit field meaning takes precedence even when only one category is selected.
 * Drop conflicting model pieces only inside a recognized value; preserve outside tails.
 */
export function reconcileLabelledFields(
  text: string,
  detections: readonly Detection[],
  fields: LabelledFields,
): Detection[] {
  let remaining = [...detections];
  for (const field of [...fields.detections, ...fields.emptyValues, ...fields.labels]) {
    remaining = remaining.flatMap((detection) => {
      if (detection.end <= field.start || detection.start >= field.end) return [detection];
      const pieces: Detection[] = [];
      if (detection.start < field.start) pieces.push({ ...detection, end: field.start });
      if (detection.end > field.end) pieces.push({ ...detection, start: field.end });
      return pieces
        .map((piece) => {
          while (piece.start < piece.end && /\s/u.test(text[piece.start]!)) piece.start++;
          while (piece.end > piece.start && /\s/u.test(text[piece.end - 1]!)) piece.end--;
          return piece;
        })
        .filter((piece) => /[\p{L}\p{N}]/u.test(text.slice(piece.start, piece.end)));
    });
  }
  return [...remaining, ...fields.detections];
}

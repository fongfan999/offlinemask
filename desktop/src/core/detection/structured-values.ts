import {
  fold,
  searchIndex,
  reconcileLabelledFields,
  type LabelledFields,
} from "./labelled-fields.ts";
import type { Detection } from "./types.ts";

const specifications = [
  {
    label: "Tên đăng nhập",
    type: "NGUOI_DUNG",
    pattern: "ten dang nhap|username|user name",
    kind: "secret",
  },
  {
    label: "Mật khẩu",
    type: "MAT_KHAU",
    pattern: "mat khau(?: tam thoi| tam)?|password",
    kind: "secret",
  },
  {
    label: "Khóa truy cập",
    type: "KHOA",
    pattern: "api[ _-]?key(?: thu nghiem)?|khoa api|khoa truy cap|access[ _-]?token",
    kind: "secret",
  },
  {
    label: "Số tài khoản",
    type: "STK",
    pattern:
      "(?:so tai khoan|tai khoan|stk)(?: nguoi nhan| thu huong| nguoi gui| nhan)?(?: so)?|account number",
    kind: "account",
  },
  {
    label: "Số thẻ",
    type: "THE",
    pattern: "(?:so the|the thu nghiem(?: so)?|card number)(?: thu nghiem)?",
    kind: "card",
  },
  { label: "Mã bảo mật thẻ", type: "CVV", pattern: "(?:ma )?(?:cvv|cvc)(?:2)?", kind: "cvv" },
  {
    label: "Mã PIN",
    type: "PIN",
    pattern: "(?:ma )?pin(?: the)?(?: cua toi)?(?: thu nghiem)?",
    kind: "pin",
  },
  {
    label: "Hộ chiếu",
    type: "GIAY_TO",
    pattern: "(?:ho chieu|passport(?: number)?)(?: so)?",
    kind: "passport",
  },
  {
    label: "Mã số thuế",
    type: "GIAY_TO",
    // Since July 2025 a person's or a household business's tax code is their 12-digit
    // CCCD: "Mã số thuế (CCCD):", "MST/CCCD chủ hộ:" (decision 0151).
    pattern:
      "(?:ma so thue|mst)(?:[^\\S\\r\\n]*\\([^\\S\\r\\n]*cccd[^\\S\\r\\n]*\\)|[^\\S\\r\\n]*\\/[^\\S\\r\\n]*cccd)?(?: chu ho)?|tax (?:id|number)",
    kind: "tax",
  },
  {
    label: "Mã bưu chính",
    type: "DIA_CHI",
    pattern: "ma buu chinh|postal code|postcode|zip code",
    kind: "postcode",
  },
  { label: "", type: "", pattern: "ngay giao dich|ngay tiep nhan|ngay xu ly", kind: "date" },
  { label: "", type: "", pattern: "so tien|phi giao dich", kind: "amount" },
] as const;
const labelPattern = specifications.map((spec) => `(${spec.pattern})`).join("|");
const labels = new RegExp(`(?<![a-z0-9_])(?:${labelPattern})(?![a-z0-9_])`, "g");
const placeholder =
  /^(?:chua (?:cung cap|co thong tin|xac dinh)|dang cap nhat|de trong|khong co|n\/a|null|[-–—]+)$/;
const prose = /^(?:chua |dang |can |vui long |khong |yeu cau |de nghi )/;
const quotes: Record<string, string> = { '"': '"', "'": "'", "“": "”", "‘": "’", "`": "`" };

/** Read an opaque value without interpreting punctuation or decoding escapes.
 * Quotes delimit spaces/separators; bare values end at whitespace or a separated comma/semicolon.
 * A bare final period remains masked because it may belong to the secret.
 */
function secretSpan(
  text: string,
  start: number,
): { start: number; end: number; consumedEnd: number } | undefined {
  const closing = quotes[text[start]!];
  if (closing) {
    let escaped = false;
    for (let end = start + 1; end < text.length && end - start <= 1024; end++) {
      const char = text[end]!;
      if (/[\r\n]/u.test(char)) return;
      if (!escaped && char === closing)
        return end > start + 1 ? { start: start + 1, end, consumedEnd: end + 1 } : undefined;
      if (!escaped && char === "\\") escaped = true;
      else escaped = false;
    }
    return; // Never return a truncated or unterminated quoted credential.
  }
  let end = start;
  while (end < text.length && !/\s/u.test(text[end]!)) {
    if (/[,;]/u.test(text[end]!) && (end + 1 === text.length || /\s/u.test(text[end + 1]!))) break;
    end++;
  }
  if (end === start || end - start > 1024) return;
  return { start, end, consumedEnd: end };
}

/** Prose needs stronger evidence than an explicit assignment. Do not interpret
 * ordinary instructions after “password” as a value just because they are nearby.
 */
function secretSeparator(rest: string) {
  const assignment = /^[^\S\r\n]*[:：=][^\S\r\n]*/u.exec(rest);
  if (assignment) return { length: assignment[0].length, explicit: true };
  const search = searchIndex(rest.slice(0, 80));
  const copula = /^[^\S\r\n]+(?:la|is)[^\S\r\n]+/u.exec(search.value);
  if (copula) return { length: search.ends[copula[0].length - 1]!, explicit: false };
  const space = /^[^\S\r\n]+/u.exec(rest);
  return space ? { length: space[0].length, explicit: false } : undefined;
}

function opaqueProseValue(text: string, span: { start: number; end: number }) {
  // Quotation marks explicitly delimit even an all-letter or space-containing value.
  if (quotes[text[span.start - 1]!]) return true;
  const value = text.slice(span.start, span.end);
  const tail = fold(text.slice(span.end, span.end + 80));
  if (/^[^\S\r\n]+(?:ky tu|chu so|characters?|digits?)\b/u.test(tail)) return false;
  return (
    /^\d{4,}$/u.test(value) ||
    (/\p{L}/u.test(value) &&
      (/[\p{N}_@#=+/\\!$%&*~`|{}\[\]<>^-]/u.test(value) ||
        /[\p{L}\p{N}][.][\p{L}\p{N}]/u.test(value)))
  );
}

function validDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/u.exec(value);
  if (!match) return false;
  const day = Number(match[1]),
    month = Number(match[2]),
    year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 1900 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function detectStructuredValues(text: string): LabelledFields {
  const search = searchIndex(text);
  const result: LabelledFields = { detections: [], emptyValues: [], labels: [] };
  let consumedEnd = 0;
  for (const match of search.value.matchAll(labels)) {
    const labelStart = search.starts[match.index!]!;
    if (labelStart < consumedEnd) continue; // A quoted secret can itself contain label-looking text.
    const spec = specifications[match.slice(1).findIndex((value) => value !== undefined)]!;
    const labelEnd = search.ends[match.index! + match[0].length - 1]!;
    const rest = text.slice(labelEnd);
    const secret = ["secret", "card", "cvv", "pin"].includes(spec.kind)
      ? secretSeparator(rest)
      : undefined;
    const separator =
      /^[^\S\r\n]*[:：=][^\S\r\n]*/u.exec(rest) ??
      (["account", "postcode", "passport", "tax"].includes(spec.kind)
        ? /^[^\S\r\n]+/u.exec(rest)
        : null);
    if (!separator && !secret) continue;
    const start = labelEnd + (secret?.length ?? separator![0].length);
    const line = text
      .slice(start)
      .split(/[\r\n;]/u, 1)[0]!
      .trim();
    const missing = line.replace(/[.,]$/u, "").trim();
    // Unquoted placeholders are kept; quoted strings such as "null" are literal secrets.
    if (!quotes[text[start]!] && placeholder.test(fold(missing))) {
      result.labels.push({ start: labelStart, end: start });
      result.emptyValues.push({ start, end: start + missing.length });
      continue;
    }
    let span: { start: number; end: number; consumedEnd: number } | undefined;
    if (spec.kind === "secret") {
      if (!quotes[text[start]!] && prose.test(fold(line))) continue;
      span = secretSpan(text, start);
      if (span && !secret?.explicit && !opaqueProseValue(text, span)) continue;
    } else {
      const tail = text.slice(start);
      const pattern =
        spec.kind === "card"
          ? /^\d(?:[ -]?\d){12,18}(?![\p{L}\p{N}_/-]|[ .-]?\d)/u
          : spec.kind === "cvv"
            ? /^\d{3,4}(?![\p{L}\p{N}_/-]|[ .-]?\d)/u
            : spec.kind === "pin"
              ? /^\d{4,6}(?![\p{L}\p{N}_/-]|[ .-]?\d)/u
              : spec.kind === "account"
                ? /^\d(?:[ -]?\d){5,19}(?![\p{L}\p{N}_]|[ -]?\d)/u
                : spec.kind === "passport"
                  ? /^[a-z]{1,2}\d{6,8}(?![\p{L}\p{N}_-])/iu
                  : spec.kind === "tax"
                    ? /^(?:\d{10}(?:-\d{3})?|\d{12}|\d{13})(?![\p{L}\p{N}_-]|[ -]\d)/u
                    : spec.kind === "postcode"
                      ? /^\d{5,6}(?![\p{L}\p{N}_-])/u
                      : spec.kind === "date"
                        ? /^\d{2}\/\d{2}\/\d{4}(?![\p{L}\p{N}_/])/u
                        : /^(?:\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)[^\S\r\n]*(?:đồng|vnd|đ|₫)(?![\p{L}\p{N}_])/iu;
      const value = pattern.exec(tail)?.[0];
      if (
        value &&
        ["card", "cvv", "pin"].includes(spec.kind) &&
        /^[^\S\r\n]+(?:ky tu|chu so|characters?|digits?)\b/u.test(
          fold(tail.slice(value.length, value.length + 40)),
        )
      )
        continue;
      if (!value || (spec.kind === "date" && !validDate(value))) continue;
      span = { start, end: start + value.length, consumedEnd: start + value.length };
    }
    if (!span) continue;
    consumedEnd = span.consumedEnd;
    result.labels.push({ start: labelStart, end: start });
    if (spec.kind === "date" || spec.kind === "amount") {
      // Reconciliation exclusion ranges retain validated, explicitly labelled transaction facts.
      result.emptyValues.push({ start: span.start, end: span.end });
    } else {
      result.detections.push({
        start: span.start,
        end: span.end,
        type: spec.type,
        label: spec.label,
        priority: 130,
        source: "Nhãn giá trị · structured-values-v3",
        reason:
          "Giá trị đầy đủ sau nhãn trường; không xác minh chủ sở hữu hoặc tính hợp lệ của thông tin.",
      });
    }
  }
  // Header evidence owns only its account cells, never neighbouring columns.
  for (const detection of tabularAccounts(text)) {
    if (!result.detections.some((d) => d.start < detection.end && d.end > detection.start))
      result.detections.push(detection);
  }
  return result;
}

export function reconcileStructuredValues(
  text: string,
  detections: readonly Detection[],
): Detection[] {
  return reconcileLabelledFields(text, detections, detectStructuredValues(text));
}

/** Plain-text TSV only. Require an exact account header and a second known header.
 * A blank line or inconsistent row width terminates the table.
 */
function tabularAccounts(text: string): Detection[] {
  const detections: Detection[] = [];
  let width = 0,
    accountColumns: number[] = [];
  const accountHeader = /^(?:so tai khoan|tai khoan|stk|account number)$/u;
  const companionHeader =
    /^(?:ho ten|ho va ten|so tien|email|ngan hang|noi dung|name|amount|bank)$/u;
  for (const line of text.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/gu)) {
    const cells = line[0].replace(/[\r\n]+$/u, "").split("\t");
    const headers = cells.map((cell) => fold(cell.trim()));
    const columns = headers.flatMap((cell, index) => (accountHeader.test(cell) ? [index] : []));
    if (
      columns.length &&
      headers.some((cell) => companionHeader.test(cell)) &&
      cells.length <= 12
    ) {
      width = cells.length;
      accountColumns = columns;
      continue;
    }
    if (cells.length !== width) {
      width = 0;
      accountColumns = [];
      continue;
    }
    let offset = line.index;
    for (const [index, cell] of cells.entries()) {
      const value = cell.trim();
      if (accountColumns.includes(index) && /^\d(?:[ -]?\d){5,19}$/u.test(value)) {
        const start = offset + cell.indexOf(value);
        detections.push({
          start,
          end: start + value.length,
          type: "STK",
          label: "Số tài khoản",
          priority: 130,
          source: "Cột tài khoản · structured-values-v3",
          reason: "Giá trị trong cột có nhãn số tài khoản; hãy kiểm tra lại.",
        });
      }
      offset += cell.length + 1;
    }
  }
  return detections;
}

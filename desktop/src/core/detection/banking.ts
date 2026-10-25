import { familyNames, isSyllable } from "./person-cues.ts";
import type { Detection } from "./types.ts";

interface Rule {
  type: string;
  label: string;
  pattern: RegExp;
  reason: string;
}
// Domain recognizers supplement the model. No handwritten name/email/phone detector.
const rules: readonly Rule[] = [
  {
    type: "STK",
    label: "Số tài khoản",
    pattern:
      // "TK" is how statements write it ("chuyen tien den TK 0123456789"); a label may
      // carry up to three words before its colon ("Số tài khoản nhận lương:"). Six digits
      // at least, so a ledger account ("Nợ TK 331") stays (decision 0154).
      /(?<![\p{L}\p{N}_])(?:số tài khoản|tài khoản|stk|tk|account(?: number)?)(?:(?:[^\S\r\n]+[\p{L}\p{M}]+){1,3}[^\S\r\n]*[:：]|\s+số)?\s*[:：#-]?\s*(\d(?:[ -]?\d){5,19})(?![\p{L}\p{N}_]|[ -]?\d)/giu,
    reason: "Dãy số sau nhãn tài khoản; cần kiểm tra lại theo ngữ cảnh.",
  },
  {
    type: "CCCD",
    label: "Số giấy tờ tùy thân",
    pattern:
      /(?<![\p{L}\p{N}_])(?:cccd|cmnd|căn cước(?: công dân)?|chứng minh nhân dân)\s*(?:số\s*)?[:：#-]?\s*(\d{12}|\d{9})(?![\p{L}\p{N}_])/giu,
    reason: "Dãy 9 hoặc 12 chữ số sau nhãn giấy tờ; chưa xác minh tính hợp lệ.",
  },
  {
    type: "GD",
    label: "Mã giao dịch",
    pattern:
      /(?<![\p{L}\p{N}_])(?:mã giao dịch|giao dịch có mã|transaction (?:id|reference))\s*[:：#-]?\s*([A-Z0-9][A-Z0-9_-]{2,39})(?![\p{L}\p{N}_-])/giu,
    reason: "Mã sau nhãn giao dịch.",
  },
  {
    type: "KH",
    label: "Mã khách hàng",
    pattern:
      /(?<![\p{L}\p{N}_])(?:mã khách hàng|mã kh|customer (?:id|code))\s*[:：#-]?\s*([A-Z0-9][A-Z0-9_-]{2,39})(?![\p{L}\p{N}_-])/giu,
    reason: "Mã sau nhãn khách hàng.",
  },
];

const nameWord = "[A-Z]{1,7}";
const name = `((?:${nameWord} ){1,4}${nameWord})`;
/** Where a transfer line puts a person (decision 0154): the sender at the start of the
 * text or after "CT DEN:<ref>", before "chuyen tien", "chuyen khoan" or "CK"; the
 * recipient after "TK <number>", ending the cell. */
const transferNames = [
  new RegExp(
    `(?:(?<=(?:^|\\t|\\n)[^\\S\\r\\n]*)|(?<=CT DEN:[A-Z0-9]+ ))${name}(?= (?:chuyen tien|chuyen khoan|CK|ck)(?![A-Za-z]))`,
    "g",
  ),
  new RegExp(`(?<=(?<![A-Za-z])TK \\d{6,20} )${name}(?=[^\\S\\r\\n]*(?:$|\\t|\\n))`, "g"),
];
/** Unaccented names in capitals in bank transfer text ("HOANG MINH KHOA chuyen tien den TK
 * 0123 TRAN NGOC CHAU"), which the models were not trained on. A name starts with a family
 * name, every word is a syllable, and it sits where a transfer puts a person; so "LE PHI
 * DICH VU" (a fee) or "TRA LUONG THANG 9" is not one. */
export function detectTransferNames(text: string): Detection[] {
  if (!/(?:chuyen tien|chuyen khoan|CT DEN|\bCK\b|\bTK \d)/u.test(text)) return [];
  const found: Detection[] = [];
  for (const match of transferNames.flatMap((pattern) => [...text.matchAll(pattern)])) {
    const words = match[1]!.split(" ");
    if (!familyNames.has(words[0]!.toLowerCase()) || !words.every((word) => isSyllable(word)))
      continue;
    const start = match.index!;
    found.push({
      start,
      end: start + match[1]!.length,
      type: "TEN",
      label: "Họ và tên",
      reason: "Họ tên không dấu trong nội dung chuyển khoản; cần kiểm tra lại.",
      source: "Nội dung chuyển khoản · banking-v1",
      priority: 100,
    });
  }
  return found;
}

export function detectBankingIdentifiers(text: string): Detection[] {
  return rules.flatMap((rule) =>
    [...text.matchAll(rule.pattern)].map((match) => {
      const value = match[1]!;
      const start = match.index! + match[0].lastIndexOf(value);
      return {
        start,
        end: start + value.length,
        type: rule.type,
        label: rule.label,
        reason: rule.reason,
        source: "Nhãn nghiệp vụ ngân hàng · banking-v1",
        priority: 100,
      };
    }),
  );
}

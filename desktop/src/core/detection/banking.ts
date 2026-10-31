import { familyNames, isSyllable } from "./person-cues.ts";
import type { Detection } from "./types.ts";
import { vocabulary } from "./vocabulary.ts";

interface Rule {
  type: string;
  label: string;
  pattern: RegExp;
  reason: string;
}
// Domain recognizers supplement the model. No handwritten name/email/phone detector.
const blank = "[^\\S\\r\\n]+";
const blanks = "[^\\S\\r\\n]*";
/** A label from the vocabulary, an optional separator, then the value's pattern. */
const labelled = (label: string, value: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}_])${label}\\s*[:：#-]?\\s*${value}`, "giu");
/** A code: letters, digits, "_" and "-", three to forty characters. */
const code = "([A-Z0-9][A-Z0-9_-]{2,39})(?![\\p{L}\\p{N}_-])";
const rules: readonly Rule[] = [
  {
    type: "STK",
    label: "Số tài khoản",
    // "TK" is how statements write it ("chuyen tien den TK 0123456789"); a label may carry
    // up to three words before its colon ("Số tài khoản nhận lương:"). Six digits at
    // least, so a ledger account ("Nợ TK 331") stays (decision 0154).
    pattern: labelled(
      `${vocabulary.labels.account}(?:(?:${blank}[\\p{L}\\p{M}]+){1,3}${blanks}[:：]|\\s+số)?`,
      "(\\d(?:[ -]?\\d){5,19})(?![\\p{L}\\p{N}_]|[ -]?\\d)",
    ),
    reason: "Dãy số sau nhãn tài khoản; cần kiểm tra lại theo ngữ cảnh.",
  },
  {
    type: "STK",
    label: "Số tài khoản",
    // Transfer wording puts the account right after "den" ("chuyen tien den TK
    // 0123456789"). The "TK" may come out of text recognition as a letter or nothing
    // (decision 0180: "chuyen tien den T 96873162835"), so after "chuyen tien den" or
    // "chuyen khoan den" a number six digits or longer is an account whatever one short
    // token sits between; with "TK" there, the rule above already has it. On a copier scan
    // the "TK" may be read as a cell of its own, joined as "TK · 1091834078" (decision 0186).
    pattern: new RegExp(
      `(?<=(?:chuyen tien|chuyen khoan|ck) den(?:${blank}(?!tk${blank}\\d)[A-Za-z]{1,2})?(?:${blank}·)?${blank})(\\d{6,20})(?![\\p{L}\\p{N}_]|[ -]?\\d)`,
      "giu",
    ),
    reason: "Dãy số sau 'chuyen tien den' trong nội dung chuyển khoản.",
  },
  {
    type: "CCCD",
    label: "Số giấy tờ tùy thân",
    // "Số định danh cá nhân" is the official name of the 12-digit number (decision 0159).
    // A copier scan may read the "số" after "CCCD" with another mark ("só", decision 0186).
    pattern: labelled(
      `${vocabulary.labels.identifier}\\s*(?:s[oóòỏõọôốồổỗộơớờởỡợ]\\s*)?`,
      "(\\d{12}|\\d{9})(?![\\p{L}\\p{N}_])",
    ),
    reason: "Dãy 9 hoặc 12 chữ số sau nhãn giấy tờ; chưa xác minh tính hợp lệ.",
  },
  {
    type: "GD",
    label: "Mã giao dịch",
    pattern: labelled(vocabulary.labels.transaction, code),
    reason: "Mã sau nhãn giao dịch.",
  },
  {
    type: "KH",
    label: "Mã khách hàng",
    pattern: labelled(vocabulary.labels.customer, code),
    reason: "Mã sau nhãn khách hàng.",
  },
  {
    type: "MA_SO",
    label: "Mã số",
    // The codes an organization gives a person: employee, student, patient, health-insurance
    // card, social-insurance book, subscriber and member numbers (decision 0160).
    pattern: labelled(vocabulary.labels.personalCode, code),
    reason: "Mã sau nhãn mã số nhân viên, sinh viên, bệnh nhân, thẻ bảo hiểm hoặc thuê bao.",
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

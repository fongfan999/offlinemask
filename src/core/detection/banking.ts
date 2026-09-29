import type { Detection } from "./types.ts";

interface Rule { type: string; label: string; pattern: RegExp; reason: string; }
// Domain recognizers supplement the model. No handwritten name/email/phone detector.
const rules: readonly Rule[] = [
  {
    type: "STK", label: "Số tài khoản",
    pattern: /(?<![\p{L}\p{N}_])(?:số tài khoản|tài khoản|stk|account(?: number)?)\s*[:：#-]?\s*(\d(?:[ -]?\d){5,19})(?![\p{L}\p{N}_]|[ -]?\d)/giu,
    reason: "Dãy số sau nhãn tài khoản; cần kiểm tra lại theo ngữ cảnh.",
  },
  {
    type: "CCCD", label: "Số giấy tờ tùy thân",
    pattern: /(?<![\p{L}\p{N}_])(?:cccd|cmnd|căn cước(?: công dân)?|chứng minh nhân dân)\s*(?:số\s*)?[:：#-]?\s*(\d{12}|\d{9})(?![\p{L}\p{N}_])/giu,
    reason: "Dãy 9 hoặc 12 chữ số sau nhãn giấy tờ; chưa xác minh tính hợp lệ.",
  },
  {
    type: "GD", label: "Mã giao dịch",
    pattern: /(?<![\p{L}\p{N}_])(?:mã giao dịch|giao dịch có mã|transaction (?:id|reference))\s*[:：#-]?\s*([A-Z0-9][A-Z0-9_-]{2,39})(?![\p{L}\p{N}_-])/giu,
    reason: "Mã sau nhãn giao dịch.",
  },
  {
    type: "KH", label: "Mã khách hàng",
    pattern: /(?<![\p{L}\p{N}_])(?:mã khách hàng|mã kh|customer (?:id|code))\s*[:：#-]?\s*([A-Z0-9][A-Z0-9_-]{2,39})(?![\p{L}\p{N}_-])/giu,
    reason: "Mã sau nhãn khách hàng.",
  },
];

export function detectBankingIdentifiers(text: string): Detection[] {
  return rules.flatMap((rule) => [...text.matchAll(rule.pattern)].map((match) => {
    const value = match[1]!;
    const start = match.index! + match[0].lastIndexOf(value);
    return {
      start, end: start + value.length, type: rule.type, label: rule.label,
      reason: rule.reason, source: "Nhãn nghiệp vụ ngân hàng · banking-v1", priority: 100,
    };
  }));
}

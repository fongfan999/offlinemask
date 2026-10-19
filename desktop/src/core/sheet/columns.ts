/** What happens to one spreadsheet column (decision 0076):
 * - `hide`: every non-empty cell becomes an alias of `type`, like a mapped column in Mailchimp;
 * - `scan`: each cell is read by the text detector, as on the text page;
 * - `keep`: the column is copied unchanged (amounts, dates, statuses).
 */
export type ColumnPlan =
  { mode: "hide"; type: string; label: string } | { mode: "scan" } | { mode: "keep" };

export interface ColumnKind {
  type: string;
  label: string;
}
const kinds = {
  name: { type: "TEN", label: "Họ và tên" },
  phone: { type: "SDT", label: "Số điện thoại" },
  email: { type: "EMAIL", label: "Email" },
  account: { type: "STK", label: "Số tài khoản" },
  card: { type: "THE", label: "Số thẻ" },
  citizen: { type: "CCCD", label: "CCCD/CMND" },
  document: { type: "GIAY_TO", label: "Số giấy tờ" },
  address: { type: "DIA_CHI", label: "Địa chỉ" },
  transaction: { type: "GD", label: "Mã giao dịch" },
  customer: { type: "KH", label: "Mã khách hàng" },
  birth: { type: "NGAY_SINH", label: "Ngày sinh" },
  organization: { type: "TO_CHUC", label: "Tổ chức" },
  username: { type: "NGUOI_DUNG", label: "Tên đăng nhập" },
  other: { type: "AN", label: "Thông tin riêng tư" },
} satisfies Record<string, ColumnKind>;
/** The kinds a user can pick for a hidden column, in menu order. */
export const columnKinds: readonly ColumnKind[] = Object.values(kinds);

/** Lowercase, strip Vietnamese marks and punctuation: "Số ĐT (di động)" → "so dt di dong". */
export function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Header phrases, matched as whole words in the normalized header. More specific first. */
const headerRules: readonly [RegExp, ColumnPlan][] = [
  // Money and dates stay readable for the AI. Balances of nine or ten digits would
  // otherwise look like phone numbers that lost their leading zero.
  [
    /^(?!ngay sinh)(so du|so tien|thanh tien|tong tien|tong cong|tong|so luong|don gia|gia|phi|le phi|lai|ghi no|ghi co|no|co|amount|balance|total|price|fee|debit|credit|quantity|ngay|ngay giao dich|thoi gian|date|time)( .*)?$/,
    { mode: "keep" },
  ],
  // The other side of a payment mixes people with shops and services (PHARMACITY,
  // QR VIETTEL); scanning hides the people and keeps the merchants for the AI.
  [
    /\b(nguoi nhan|nguoi gui|gui nhan|nguoi thu huong|don vi thu huong|ben nhan|ben chuyen|doi tac|doi ung|counterparty|recipient|sender|payee|beneficiary|merchant)\b/,
    { mode: "scan" },
  ],
  [
    /\b(ghi chu|noi dung|mo ta|dien giai|nhan xet|phan hoi|note|notes|description|comment|comments|message|remark)\b/,
    { mode: "scan" },
  ],
  [
    /\b(ma giao dich|ma gd|transaction|txn|so tham chieu|ma tham chieu|reference|ref)\b/,
    { mode: "hide", ...kinds.transaction },
  ],
  [
    /\b(ma khach hang|ma kh|customer id|customer code|client id)\b/,
    { mode: "hide", ...kinds.customer },
  ],
  [/\b(so the|card number|card no|so the tin dung)\b/, { mode: "hide", ...kinds.card }],
  [
    /\b(so tai khoan|stk|tai khoan ngan hang|account number|account no|iban|bank account)\b/,
    { mode: "hide", ...kinds.account },
  ],
  [/\b(cccd|cmnd|can cuoc|chung minh|national id|id number)\b/, { mode: "hide", ...kinds.citizen }],
  [
    /\b(ho chieu|passport|ma so thue|mst|tax id|tax code|giay to)\b/,
    { mode: "hide", ...kinds.document },
  ],
  [/\b(email|e mail|thu dien tu)\b/, { mode: "hide", ...kinds.email }],
  [
    /\b(so dien thoai|dien thoai|sdt|so dt|dt|di dong|phone|mobile|tel|telephone|hotline|zalo)\b/,
    { mode: "hide", ...kinds.phone },
  ],
  [/\b(dia chi|address|noi o|thuong tru|tam tru|cho o)\b/, { mode: "hide", ...kinds.address }],
  [
    /\b(ngay sinh|nam sinh|sinh nhat|dob|date of birth|birthday|birth date)\b/,
    { mode: "hide", ...kinds.birth },
  ],
  [/\b(ten dang nhap|username|user name|login)\b/, { mode: "hide", ...kinds.username }],
  [
    /\b(cong ty|doanh nghiep|to chuc|company|organization|organisation|employer)\b/,
    { mode: "hide", ...kinds.organization },
  ],
  [
    /^(ten|ho ten|ho va ten|name|full name|fullname|customer|khach hang|contact|lien he)$/,
    { mode: "hide", ...kinds.name },
  ],
  [
    /\b(ho ten|ho va ten|ten khach hang|ten khach|ten nguoi|ten chu|chu tai khoan|chu the|nguoi lien he|nguoi dai dien|ten nhan vien|nhan vien|full name|first name|last name|customer name|contact name)\b/,
    { mode: "hide", ...kinds.name },
  ],
];

const emailValue = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneValue = /^(?:\+?84|0)?[1-9]\d{8,9}$/;
const titleCaseName = /^\p{Lu}[\p{Ll}\p{M}]+(?:\s\p{Lu}[\p{Ll}\p{M}]+){1,4}$/u;

/** Suggest a plan from the header and a sample of values. A suggestion only; the
 * user can change every column before anything is masked. */
export function suggestColumn(header: string, samples: readonly string[]): ColumnPlan {
  const normalized = normalizeHeader(header);
  for (const [rule, plan] of headerRules) if (rule.test(normalized)) return plan;
  const values = samples.map((value) => value.trim()).filter(Boolean);
  if (!values.length) return { mode: "keep" };
  const share = (test: (value: string) => boolean) => values.filter(test).length / values.length;
  if (share((value) => emailValue.test(value)) >= 0.6) return { mode: "hide", ...kinds.email };
  if (share((value) => phoneValue.test(value.replace(/[\s.()-]/g, ""))) >= 0.6)
    return { mode: "hide", ...kinds.phone };
  if (share((value) => titleCaseName.test(value)) >= 0.6) return { mode: "hide", ...kinds.name };
  // Sentences may mention people, numbers or places; read them cell by cell.
  if (share((value) => value.length >= 30 && /\s/.test(value)) >= 0.4) return { mode: "scan" };
  return { mode: "keep" };
}

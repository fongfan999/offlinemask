import { restoreAliases, aliasTokens, type Restoration } from "./restore.ts";
import type { Finding } from "./review.ts";
import type { Session } from "./sessions.ts";

/** What the quick action should do with the text on the clipboard (decision 0090).
 * - `restore`: it holds at least one alias of a session seen in this launch;
 * - `unknown`: it holds alias-shaped tokens, but none of them is ours;
 * - `mask`: ordinary text;
 * - `empty`: nothing to work on. */
export type QuickDirection = "mask" | "restore" | "unknown" | "empty";

/** The alias table of a private session. Samples use demo aliases outside the
 * alias shape, so they never take part. */
export function sessionFindings(session: Session): readonly Finding[] {
  if (session.fixture === "private-text-v1") return session.analysis.findings;
  if (session.fixture === "private-sheet-v1" || session.fixture === "private-doc-v1")
    return session.findings;
  return [];
}

export function quickDirection(
  text: string,
  tables: readonly (readonly Finding[])[],
): QuickDirection {
  if (!text.trim()) return "empty";
  const tokens = aliasTokens(text);
  if (!tokens.length) return "mask";
  const known = new Set(tables.flat().map((finding) => finding.alias));
  return tokens.some((token) => known.has(token)) ? "restore" : "unknown";
}

/** Alias scopes are unique per app instance, so every table seen in this launch
 * can be searched at once; an alias never belongs to two sessions. */
export function restoreFromTables(
  text: string,
  tables: readonly (readonly Finding[])[],
): Restoration {
  return restoreAliases(text, { findings: tables.flat(), spans: [] });
}

const count = (n: number) => n.toLocaleString("vi-VN");

/** Status lines shown in the floating panel after a quick action. */
export const quickMessages = {
  empty: "Chưa có văn bản trong clipboard. Sao chép trước, rồi thử lại.",
  unknown: "Mã thay thế trong clipboard không thuộc văn bản nào đang mở, nên được giữ nguyên.",
  nothing: "Không thấy thông tin cần ẩn. Clipboard được giữ nguyên.",
  noAliases: "Không thấy mã thay thế nào trong clipboard để khôi phục.",
  busy: "Đang ẩn một văn bản khác. Thử lại sau giây lát.",
  clipboard: "Chưa đọc hoặc ghi được clipboard. Thử sao chép lại.",
  failed: "Chưa thực hiện được thao tác. Nội dung được giữ nguyên, hãy thử lại.",
  // Short on purpose: in place the change is visible, otherwise one line says where it is.
  masked: (n: number, replaced = false) =>
    replaced ? `Đã ẩn ${count(n)} thông tin` : `Đã ẩn ${count(n)} thông tin · dán để dùng`,
  restored: (n: number, unknown: number, replaced = false) =>
    (replaced
      ? `Đã khôi phục ${count(n)} thông tin`
      : `Đã khôi phục ${count(n)} thông tin · dán để dùng`) +
    (unknown ? ` · ${count(unknown)} mã lạ giữ nguyên` : ""),
  /** The opt-in clipboard watch noticed something (decision 0095). */
  offer: (n: number) =>
    `Văn bản vừa sao chép có ${count(n)} thông tin nhạy cảm. Bấm Ẩn thông tin để ẩn trước khi dán.`,
  /** What a click on the circle will do, shown while it is hovered (decision 0096). */
  hintMask: "Ẩn thông tin",
  hintRestore: "Khôi phục thông tin",
  /** The restore preview's heading, the confirmation after its copy button, and the
   * case where the AI reply holds no alias of a session still known (decision 0096). */
  previewTitle: (n: number) =>
    n === 1 ? "Đã khôi phục 1 thông tin" : `Đã khôi phục ${count(n)} thông tin`,
  maskedTitle: (n: number) => `Đã ẩn ${count(n)} thông tin`,
  previewCopied: "Đã sao chép. Dán vào nơi bạn cần.",
  /** The popover's question over a fresh selection (decision 0096). */
  selectMask: "Ẩn thông tin trong phần vừa chọn? Kết quả thay ngay tại chỗ.",
  selectRestore: "Khôi phục mã thay thế trong phần vừa chọn? Kết quả thay ngay tại chỗ.",
  /** A Finder service handed over more than one file (decision 0094). */
  oneFile: (name: string) => `Mỗi lần một tệp: đã mở “${name}”.`,
  /** Shown once per launch when the selection could not be taken for lack of permission. */
  permissionHint: "Muốn thay ngay tại chỗ? Cấp quyền Trợ năng trong Cài đặt › Thao tác nhanh.",
} as const;

/** Where each alias sits in masked text, for highlighting in the preview. */
export function aliasMarks(
  text: string,
  findings: readonly Finding[],
): { start: number; end: number }[] {
  const aliases = new Set(findings.map((finding) => finding.alias));
  const marks: { start: number; end: number }[] = [];
  for (const token of text.matchAll(/\[[A-Z][A-Z_]*_\d+_[a-f0-9]{4,8}\]/g)) {
    if (aliases.has(token[0]))
      marks.push({ start: token.index, end: token.index + token[0].length });
  }
  return marks;
}

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
  masked: (n: number, replaced = false) =>
    replaced
      ? `Đã ẩn ${count(n)} thông tin ngay tại chỗ bạn chọn. Bản đã ẩn cũng nằm trong clipboard.`
      : `Đã ẩn ${count(n)} thông tin. Bản đã ẩn đang trong clipboard, dán vào AI được rồi.`,
  restored: (n: number, unknown: number, replaced = false) =>
    (replaced
      ? `Đã khôi phục ${count(n)} mã thay thế ngay tại chỗ bạn chọn.`
      : `Đã khôi phục ${count(n)} mã thay thế. Bản khôi phục đang trong clipboard.`) +
    (unknown ? ` ${count(unknown)} mã khác không thuộc văn bản nào đang mở, giữ nguyên.` : ""),
  /** The opt-in clipboard watch noticed something (decision 0095). */
  offer: (n: number) =>
    `Văn bản vừa sao chép có ${count(n)} thông tin nhạy cảm. Bấm Ẩn thông tin để ẩn trước khi dán.`,
  /** A Finder service handed over more than one file (decision 0094). */
  oneFile: (name: string) => `Mỗi lần một tệp: đã mở “${name}”.`,
  /** Shown once per launch when the selection could not be taken for lack of permission. */
  permissionHint: "Muốn thay ngay tại chỗ? Cấp quyền Trợ năng trong Cài đặt › Thao tác nhanh.",
} as const;

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

/** A session's alias table as kept for restoring, with what pruning needs to know. */
export interface KeptTable {
  findings: readonly Finding[];
  /** When the session was made, in milliseconds. */
  createdAt: number;
  /** Whether the session is still in the app's list (open, recent or history). */
  listed: boolean;
  /** Its rough memory, from `tableBytes`. */
  bytes: number;
}

/** How long, and how much, the tables of sessions no longer listed are kept (decision 0177). */
export const keptTableLimits = { maxAgeMs: 7 * 24 * 60 * 60 * 1000, maxBytes: 32 * 1024 * 1024 };

/** Rough memory of a table: two bytes per UTF-16 unit of its strings, plus the object. */
export function tableBytes(findings: readonly Finding[]): number {
  let bytes = 0;
  for (const finding of findings)
    bytes +=
      64 +
      2 *
        (finding.id.length +
          finding.label.length +
          finding.value.length +
          finding.alias.length +
          finding.reason.length +
          finding.source.length);
  return bytes;
}

/** Ids of tables to forget at `now`: unlisted ones older than the age limit, then the oldest
 * unlisted ones until all tables fit the size limit. Listed sessions are never dropped here;
 * their own lifetime (the open screen, or history's keep period) governs them. */
export function staleTables(
  tables: ReadonlyMap<string, KeptTable>,
  now: number,
  limits = keptTableLimits,
): string[] {
  const drop: string[] = [];
  let total = 0;
  const unlisted: [string, KeptTable][] = [];
  for (const [id, table] of tables) {
    if (!table.listed) {
      if (now - table.createdAt > limits.maxAgeMs) {
        drop.push(id);
        continue;
      }
      unlisted.push([id, table]);
    }
    total += table.bytes;
  }
  unlisted.sort((a, b) => a[1].createdAt - b[1].createdAt);
  for (const [id, table] of unlisted) {
    if (total <= limits.maxBytes) break;
    drop.push(id);
    total -= table.bytes;
  }
  return drop;
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
    replaced ? `Đã ẩn ${count(n)} thông tin` : `Đã ẩn ${count(n)} thông tin - dán để dùng`,
  /** The preview's title when the selection changed while masking ran (decision 0127). */
  maskedMoved: "Vùng chọn đã đổi",
  restored: (n: number, unknown: number, replaced = false) =>
    (replaced
      ? `Đã khôi phục ${count(n)} thông tin`
      : `Đã khôi phục ${count(n)} thông tin - dán để dùng`) +
    (unknown ? ` - ${count(unknown)} mã lạ giữ nguyên` : ""),
  /** What a click on the circle will do, shown while it is hovered (decision 0096). */
  hintMask: "Ẩn thông tin",
  hintRestore: "Khôi phục thông tin",
  /** Codes of a session this launch does not know (decision 0096). */
  hintUnknown: "Không tìm thấy bản gốc",
  unknownTitle: "Không tìm thấy bản gốc",
  unknownBody:
    "Các mã thay thế này được tạo trong một lần mở trước và chưa được lưu lại, nên không khôi phục được. Đặt mật mã để giữ lịch sử giữa các lần mở OfflineMask.",
  unknownBodySaved:
    "Các mã thay thế này không thuộc văn bản nào trong lịch sử trên máy này, nên không khôi phục được.",
  /** Why the last selection got no circle, for Cài đặt › Thao tác nhanh. */
  skipped: {
    plain: "đoạn đó không có thông tin cần ẩn",
    busy: "đang xử lý một văn bản khác",
    locked: "OfflineMask đang khóa",
    empty: "chưa có chữ nào được chọn",
  },
  /** The restore preview's heading, the confirmation after its copy button, and the
   * case where the AI reply holds no alias of a session still known (decision 0096). */
  previewTitle: "Đã khôi phục",
  maskedTitle: "Đã ẩn",
  previewCopied: "Đã sao chép. Dán vào nơi bạn cần.",
  /** The popover's question over a fresh selection (decision 0096). */
  selectMask: "Ẩn thông tin trong phần vừa chọn? Kết quả thay ngay tại chỗ.",
  selectRestore: "Khôi phục mã thay thế trong phần vừa chọn? Kết quả thay ngay tại chỗ.",
  /** A Finder service handed over more than one file (decision 0094). */
  oneFile: (name: string) => `Mỗi lần một tệp: đã mở "${name}".`,
  /** Shown once per launch when the selection could not be taken for lack of permission. */
  permissionHint: "Muốn thay ngay tại chỗ? Cấp quyền Trợ năng trong Cài đặt > Thao tác nhanh.",
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

import { fileKind } from "./file-kind.ts";
import { normalizeHeader, type ColumnPlan } from "./sheet/columns.ts";

/** Masking a whole folder (decision 0171): which files it takes, how many the machine
 * opens at once, how long it will take, and which sheets share a column layout. */

/** Documents (Word, OpenDocument, PDF, text) or spreadsheets. */
export type FolderKind = "word" | "excel";
export interface FolderEntry {
  /** Path inside the chosen folder, "/"-separated, without the folder's own name. */
  path: string;
  file: File;
}

/** System litter that is never listed: hidden files, Office lock files, Windows thumbnails. */
const litter = /^(\.|~\$)|^(thumbs\.db|desktop\.ini)$/i;
export const isLitter = (name: string) => litter.test(name);
export const maxFolderFiles = 5_000;
export const maxFolderFileBytes = 20 * 1024 * 1024;

export function folderKind(name: string): FolderKind | null {
  const kind = fileKind(name);
  return kind === "text" || kind === "word" ? "word" : kind === "excel" ? "excel" : null;
}
/** Why a file of the folder is left out, or null when it is taken. */
export function skipReason(entry: FolderEntry): string | null {
  const kind = fileKind(entry.file.name);
  if (kind === "legacy-doc") return "Tệp .doc cũ: mở bằng Word và lưu lại thành .docx.";
  if (!folderKind(entry.file.name)) return "Chưa hỗ trợ loại tệp này.";
  if (entry.file.size > maxFolderFileBytes) return "Tệp lớn hơn 20 MB.";
  return null;
}

/** Path order, folders and files together, as a file manager in Vietnamese sorts them. */
export function sortEntries<T extends { path: string }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => a.path.localeCompare(b.path, "vi", { numeric: true }));
}

export interface MachineResources {
  cores: number;
  /** Installed memory in bytes, when the system says. */
  memory: number | null;
}
const gib = 1024 ** 3;
/** File workers that open and write files while the model reads: one per four processors
 * (the model's session uses four threads), at most one per 4 GB, between one and four. */
export function fileWorkers({ cores, memory }: MachineResources): number {
  const byCores = Math.floor(cores / 4);
  const byMemory = memory ? Math.floor(memory / (4 * gib)) : 2;
  return Math.max(1, Math.min(4, byCores, byMemory));
}

/** Reading pace before a run has measured one (decision 0171): the shipped model on the
 * native runtime read 1 800–2 200 characters a second of real statements and letters on
 * an Apple-silicon Mac (29 Oct 2026). */
export const assumedCharsPerSecond = 2_000;
/** Loading the model before the first text. */
export const modelLoadSeconds = 5;
/** Above this, the page suggests a machine dedicated to OfflineMask. */
export const dedicatedMachineSeconds = 60 * 60;
export const estimateSeconds = (chars: number, perSecond = assumedCharsPerSecond) =>
  chars ? modelLoadSeconds + chars / perSecond : 0;
/** "dưới 1 phút", "khoảng 25 phút", "khoảng 3 giờ", "khoảng 1 giờ 30 phút". */
export function roughDuration(seconds: number): string {
  if (seconds < 60) return "dưới 1 phút";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `khoảng ${minutes} phút`;
  const halfHours = Math.round(seconds / 1800);
  const hours = Math.floor(halfHours / 2);
  return halfHours % 2 ? `khoảng ${hours} giờ 30 phút` : `khoảng ${hours} giờ`;
}

/** Sheets with the same headers share a layout and one set of column choices. */
export const layoutKey = (header: readonly string[]) =>
  header.map((cell) => normalizeHeader(cell)).join("|");

/** Characters the model reads in one sheet under a layout's choices: lines above the
 * header always, and the columns set to scan. */
export function scannedChars(
  sheet: { preambleChars: number; columnChars: readonly number[] },
  plans: readonly ColumnPlan[],
): number {
  return sheet.columnChars.reduce(
    (sum, chars, column) => sum + (plans[column]?.mode === "scan" ? chars : 0),
    sheet.preambleChars,
  );
}

/** Run `task` over `items`, at most `limit` at a time; `slot` says which of the
 * `limit` lanes runs it, so a lane can keep its own file worker. */
export async function mapPool<T>(
  items: readonly T[],
  limit: number,
  task: (item: T, slot: number, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lane = async (slot: number) => {
    while (next < items.length) {
      const index = next++;
      await task(items[index]!, slot, index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, (_, slot) => lane(slot)),
  );
}

/** "Hồ sơ" → "Hồ sơ (OfflineMasked)", then "Hồ sơ (OfflineMasked 2)" and on, to try in turn
 * until one does not exist yet. */
export function* outputFolderNames(root: string): Generator<string> {
  yield `${root} (OfflineMasked)`;
  for (let n = 2; ; n++) yield `${root} (OfflineMasked ${n})`;
}

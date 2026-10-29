/** The memory OfflineMask allows itself (decision 0173): by default a quarter of the
 * machine's, between 1 and 4 GB, so a large file never takes the whole machine. A file
 * whose opening would need more is refused with the figures, before it is read. Cài đặt ›
 * Nâng cao offers other shares, for a machine kept for OfflineMask above all. */
const gib = 1024 ** 3;
export type MemoryChoice = "low" | "normal" | "high" | "dedicated";
export const memoryChoices: readonly {
  id: MemoryChoice;
  label: string;
  share: number;
  detail: string;
}[] = [
  {
    id: "low",
    label: "Ít",
    share: 1 / 8,
    detail: "1/8 bộ nhớ của máy, khi máy còn chạy nhiều việc khác.",
  },
  {
    id: "normal",
    label: "Mặc định",
    share: 1 / 4,
    detail: "1/4 bộ nhớ của máy, hợp với đa số máy.",
  },
  { id: "high", label: "Nhiều", share: 1 / 2, detail: "1/2 bộ nhớ của máy, cho tệp lớn." },
  {
    id: "dedicated",
    label: "Tối đa",
    share: 3 / 4,
    detail: "3/4 bộ nhớ của máy, khi máy chỉ dùng để chạy OfflineMask.",
  },
];
/** Assumed when the system does not say how much memory it has. */
const assumedMemory = 8 * gib;
/** What the app's web view can hold at once, whatever the machine has. Windows' WebView2
 * (Chromium) keeps the page and all its workers under one 4 GB JavaScript heap: measured
 * 29 Oct 2026, two workers at 1,8 GB each ran and two at 2,5 GB took the page down. The
 * app itself needs some of it, so a job gets at most 3 GB. */
export const engineCeiling = 3 * gib;
/** Never under 1 GB nor over the web view's ceiling. */
export function memoryBudget(memory: number | null, choice: MemoryChoice = "normal"): number {
  const share = memoryChoices.find((entry) => entry.id === choice)?.share ?? 1 / 4;
  return Math.min(engineCeiling, Math.max(1 * gib, (memory ?? assumedMemory) * share));
}

/** Peak memory per byte, measured by opening generated files the way the app does
 * (29 Oct 2026, Node): a CSV about 11 times its size, text about 3 times, a workbook
 * 12 to 14 times its unzipped XML, a Word document about 11 times. The figures are
 * rounded up. An .xls is not measured and counts like a workbook's XML. */
const perByte: Record<string, number> = {
  csv: 12,
  txt: 4,
  md: 4,
  xlsx: 15,
  ods: 15,
  xls: 15,
  docx: 13,
  odt: 13,
};
/** A PDF's own bytes stay in memory while it is read (pdf.js keeps them and its index). */
const pdfPerByte = 3;
/** And each character it yields costs about 50 bytes (paragraphs, positions, the copy
 * sent back from the worker); checked page by page, since a scan and a text PDF of the
 * same size need very different amounts. */
export const pdfCharBytes = 50;

/** Uncompressed size of a zip (xlsx, docx, ods, odt), from its central directory alone,
 * without inflating anything; null when the file is not a zip it can read. */
export async function unzippedSize(file: Blob): Promise<number | null> {
  const tailLength = Math.min(file.size, 65_557);
  const tail = new DataView(await file.slice(file.size - tailLength).arrayBuffer());
  let end = -1;
  for (let at = tail.byteLength - 22; at >= 0; at--)
    if (tail.getUint32(at, true) === 0x06054b50) {
      end = at;
      break;
    }
  if (end < 0) return null;
  const size = tail.getUint32(end + 12, true);
  const offset = tail.getUint32(end + 16, true);
  if (offset + size > file.size) return null;
  const directory = new DataView(await file.slice(offset, offset + size).arrayBuffer());
  let total = 0;
  for (let at = 0; at + 46 <= directory.byteLength;) {
    if (directory.getUint32(at, true) !== 0x02014b50) return null;
    total += directory.getUint32(at + 24, true);
    at +=
      46 +
      directory.getUint16(at + 28, true) +
      directory.getUint16(at + 30, true) +
      directory.getUint16(at + 32, true);
  }
  return total;
}

/** Memory needed to open a file, in bytes. */
export async function memoryNeed(file: File): Promise<number> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "pdf") return file.size * pdfPerByte;
  const factor = perByte[extension] ?? 12;
  if (["xlsx", "ods", "docx", "odt"].includes(extension))
    // A zip that cannot be read counts as ten times its size, a typical ratio.
    return ((await unzippedSize(file)) ?? file.size * 10) * factor;
  return file.size * factor;
}

/** "2 GB", "1,5 GB", "800 MB". */
export function memorySize(bytes: number): string {
  if (bytes >= gib) {
    const value = Math.round((bytes / gib) * 10) / 10;
    return `${value.toLocaleString("vi-VN")} GB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024 ** 2)).toLocaleString("vi-VN")} MB`;
}
/** The refusal is two lines, what happened and what to do; a card shows them as two
 * lines, a list as one sentence after the other. */
const moreMemory = (split: string, canRaise: boolean) =>
  canRaise ? `${split}, hoặc cho phép dùng nhiều hơn trong Cài đặt › Nâng cao.` : `${split}.`;
/** `canRaise`: whether another choice in Cài đặt would allow more; at the web view's
 * ceiling none does, and only splitting helps. */
export function memoryMessage(need: number, allowed: number, canRaise = true): string {
  return `Tệp này cần khoảng ${memorySize(need)} bộ nhớ, quá mức OfflineMask tự giới hạn trên máy này (${memorySize(allowed)}).\n${moreMemory("Hãy chia nhỏ tệp", canRaise)}`;
}
export function pdfMemoryMessage(allowed: number, canRaise = true): string {
  return `PDF này cần nhiều bộ nhớ hơn mức OfflineMask tự giới hạn trên máy này (${memorySize(allowed)}).\n${moreMemory("Hãy tách thành các tệp nhỏ hơn", canRaise)}`;
}

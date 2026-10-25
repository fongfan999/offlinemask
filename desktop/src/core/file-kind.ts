import type { Format } from "./sessions.ts";

/** Which page opens a file, by its name (decision 0089; shared with the Finder
 * service of decision 0094). */
export type FileKind = Format | "legacy-doc" | "upcoming" | "unknown";

export function fileKind(name: string): FileKind {
  const lower = name.toLowerCase();
  if (/\.(txt|md)$/.test(lower)) return "text";
  if (/\.(xlsx|xls|ods|csv)$/.test(lower)) return "excel";
  if (/\.(docx|odt|pdf)$/.test(lower)) return "word";
  if (/\.doc$/.test(lower)) return "legacy-doc";
  if (/\.(jpe?g|png|heic|webp)$/.test(lower)) return "upcoming";
  return "unknown";
}

/** Why a file cannot open, in the words of the home page's start box. */
export const fileKindErrors: Record<Exclude<FileKind, Format>, string> = {
  "legacy-doc": "Tệp .doc cũ hãy mở bằng Word và lưu lại thành .docx trước.",
  upcoming: "Hình ảnh sắp được hỗ trợ. Hiện mở được Excel, CSV, Word, PDF và tệp văn bản.",
  unknown:
    "Chưa mở được loại tệp này. Hãy dùng Excel (.xlsx, .xls), .ods, .csv, Word (.docx), .odt, .pdf hoặc .txt.",
};

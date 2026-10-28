import type { Format } from "./sessions.ts";

/** Which page opens a file, by its name (decision 0089; shared with the Finder
 * service of decision 0094). A PNG or JPEG picture opens on Tài liệu where the machine
 * reads text in pictures (`images`, decision 0171) and is "upcoming" elsewhere. */
export type FileKind = Format | "legacy-doc" | "upcoming" | "unknown";

export function fileKind(name: string, { images = false } = {}): FileKind {
  const lower = name.toLowerCase();
  if (/\.(txt|md)$/.test(lower)) return "text";
  if (/\.(xlsx|xls|ods|csv)$/.test(lower)) return "excel";
  if (/\.(docx|odt|pdf)$/.test(lower)) return "word";
  if (/\.doc$/.test(lower)) return "legacy-doc";
  if (images && /\.(jpe?g|png)$/.test(lower)) return "word";
  if (/\.(jpe?g|png|heic|webp)$/.test(lower)) return "upcoming";
  return "unknown";
}

/** Why a file cannot open, in the words of the home page's start box. */
export const fileKindErrors: Record<Exclude<FileKind, Format>, string> = {
  "legacy-doc": "Tệp .doc cũ hãy mở bằng Word và lưu lại thành .docx trước.",
  upcoming:
    "Máy này chưa đọc được chữ trong hình ảnh (cần macOS 14 trở lên; trên Windows sắp có). Hiện mở được Excel, CSV, Word, PDF và tệp văn bản.",
  unknown:
    "Chưa mở được loại tệp này. Hãy dùng Excel (.xlsx, .xls), .ods, .csv, Word (.docx), .odt, .pdf hoặc .txt.",
};

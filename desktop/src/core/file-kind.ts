import type { Format } from "./sessions.ts";

/** Which page opens a file, by its name (decision 0089; shared with the Finder
 * service of decision 0094). A PNG or JPEG picture opens on Tài liệu where the machine
 * reads text in pictures (`images`, decisions 0180 and 0191: every release since 2.6.1);
 * elsewhere, which is the browser preview or a build without the reading models, no picture
 * opens. HEIC and WebP are not read even where pictures are. */
export type FileKind = Format | "legacy-doc" | "no-picture-reader" | "picture-format" | "unknown";

export function fileKind(name: string, { images = false } = {}): FileKind {
  const lower = name.toLowerCase();
  if (/\.(txt|md)$/.test(lower)) return "text";
  if (/\.(xlsx|xls|ods|csv)$/.test(lower)) return "excel";
  if (/\.(docx|odt|pdf)$/.test(lower)) return "word";
  if (/\.doc$/.test(lower)) return "legacy-doc";
  if (/\.(jpe?g|png|heic|webp)$/.test(lower)) {
    if (!images) return "no-picture-reader";
    return /\.(jpe?g|png)$/.test(lower) ? "word" : "picture-format";
  }
  return "unknown";
}

/** Why a file cannot open, in the words of the home page's start box. */
export const fileKindErrors: Record<Exclude<FileKind, Format>, string> = {
  "legacy-doc": "Tệp .doc cũ hãy mở bằng Word và lưu lại thành .docx trước.",
  "no-picture-reader":
    "Máy này chưa đọc được chữ trong hình ảnh. Hiện mở được Excel, CSV, Word, PDF và tệp văn bản.",
  "picture-format":
    "Ảnh .heic và .webp chưa mở được. Hãy lưu lại thành .jpg hoặc .png rồi thử lại.",
  unknown:
    "Chưa mở được loại tệp này. Hãy dùng Excel (.xlsx, .xls), .ods, .csv, Word (.docx), .odt, .pdf hoặc .txt.",
};

import { isTauri } from "@tauri-apps/api/core";
import type { CellEdits, SheetTable } from "../core/sheet/mask.ts";
import type { FileError } from "../core/sheet/files.ts";
import type { DocumentFormat } from "../core/doc/document.ts";
import type { DocEdits, DocParagraph } from "../core/doc/docx.ts";
import type { FilesRequest, FilesResponse } from "../workers/files.worker.ts";
import { recognizeImage } from "./ocr.ts";

export const fileErrorMessages: Record<FileError, string> = {
  unsupported: "Chỉ hỗ trợ tệp Excel (.xlsx, .xls), .ods và .csv.",
  "too-large": "Tệp lớn hơn 20 MB. Hãy chia nhỏ tệp rồi thử lại.",
  "too-many-rows": "Tệp có hơn 100.000 dòng. Hãy chia nhỏ tệp rồi thử lại.",
  unreadable:
    "Chưa đọc được tệp này. Hãy kiểm tra tệp mở được trong Excel hoặc LibreOffice và không có mật khẩu.",
  empty: "Tệp không có dữ liệu.",
};
export class SheetAdapterError extends Error {
  readonly code: FileError;
  constructor(code: FileError) {
    super(fileErrorMessages[code]);
    this.code = code;
  }
}

/** One worker for the app; each opened file is a handle into it. */
export function createSheetFiles() {
  let worker: Worker | undefined;
  let sequence = 0;
  const waiting = new Map<
    number,
    { resolve: (value: FilesResponse) => void; progress?: (done: number, total: number) => void }
  >();
  function ensure() {
    if (worker) return worker;
    worker = new Worker(new URL("../workers/files.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<FilesResponse>) => {
      if (event.data.type === "progress") {
        waiting.get(event.data.id)?.progress?.(event.data.done, event.data.total);
        return;
      }
      if (event.data.type === "ocr") {
        // A page or picture to read with the system's text recognition (decision 0171).
        const { id, image, width, height } = event.data;
        void recognizeImage(new Uint8Array(image), width, height).then(
          (page) => worker?.postMessage({ type: "ocr-result", id, page } satisfies FilesRequest),
          () => worker?.postMessage({ type: "ocr-result", id, error: true } satisfies FilesRequest),
        );
        return;
      }
      waiting.get(event.data.id)?.resolve(event.data);
      waiting.delete(event.data.id);
    };
    return worker;
  }
  function send(
    request: FilesRequest,
    transfer: Transferable[] = [],
    progress?: (done: number, total: number) => void,
  ): Promise<FilesResponse> {
    return new Promise((resolve) => {
      const answered = request.type !== "close" && request.type !== "cancel";
      if (answered) waiting.set(request.id, { resolve, progress });
      ensure().postMessage(request, transfer);
      if (!answered) resolve({ type: "failed", id: -1, code: "unreadable" });
    });
  }
  return {
    async open(file: File): Promise<{ handle: string; tables: SheetTable[]; notes: string[] }> {
      const handle = crypto.randomUUID();
      const bytes = await file.arrayBuffer();
      const reply = await send({ type: "open", id: ++sequence, handle, name: file.name, bytes }, [
        bytes,
      ]);
      if (reply.type === "failed") throw new SheetAdapterError(reply.code as FileError);
      if (reply.type !== "opened") throw new SheetAdapterError("unreadable");
      return { handle, tables: reply.tables, notes: reply.notes };
    },
    async write(handle: string, edits: CellEdits): Promise<Uint8Array> {
      const reply = await send({ type: "write", id: ++sequence, handle, edits });
      if (reply.type !== "written") throw new SheetAdapterError("unreadable");
      return new Uint8Array(reply.bytes);
    },
    /** Open a document; a PDF reports its pages through `progress` and stops when
     * `signal` aborts (the promise then rejects with code "cancelled"). With `ocr`,
     * pages without text and pictures are read by the system's text recognition. */
    async openDoc(
      file: File,
      {
        progress,
        signal,
        ocr = false,
      }: {
        progress?: (done: number, total: number) => void;
        signal?: AbortSignal;
        ocr?: boolean;
      } = {},
    ): Promise<{
      handle: string;
      format: DocumentFormat;
      paragraphs: DocParagraph[];
      notes: string[];
      mailto: string[];
    }> {
      const handle = crypto.randomUUID();
      const bytes = await file.arrayBuffer();
      const id = ++sequence;
      const cancel = () => void send({ type: "cancel", id });
      signal?.addEventListener("abort", cancel, { once: true });
      const reply = await send(
        { type: "open-doc", id, handle, name: file.name, bytes, ocr },
        [bytes],
        progress,
      ).finally(() => signal?.removeEventListener("abort", cancel));
      if (reply.type === "failed") throw new SheetAdapterError(reply.code as FileError);
      if (reply.type !== "opened-doc") throw new SheetAdapterError("unreadable");
      return {
        handle,
        format: reply.format,
        paragraphs: reply.paragraphs,
        notes: reply.notes,
        mailto: reply.mailto,
      };
    },
    async writeDoc(handle: string, edits: DocEdits): Promise<Uint8Array> {
      const reply = await send({ type: "write-doc", id: ++sequence, handle, edits });
      if (reply.type !== "written") throw new SheetAdapterError("unreadable");
      return new Uint8Array(reply.bytes);
    },
    close(handle: string) {
      void send({ type: "close", handle });
    },
  };
}
export type SheetFiles = ReturnType<typeof createSheetFiles>;

const mimeTypes = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  md: "text/markdown",
  txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
};
const fileKinds = {
  xlsx: "Excel",
  csv: "CSV",
  md: "Markdown",
  txt: "Văn bản",
  docx: "Word",
  odt: "OpenDocument",
  ods: "OpenDocument",
} as const;
/** The suffixes of saved copies' names, in every format, with the product name as the
 * verb (decision 0150): "Sổ khách (OfflineMasked).xlsx" and, once the AI's file has its
 * values back, "Sổ khách (OfflineUnmasked).xlsx". Copies masked before end in "(đã ẩn)". */
export const maskedSuffix = "OfflineMasked";
export const unmaskedSuffix = "OfflineUnmasked";
const maskedMark = / \((offlinemasked|đã ẩn)\)(?=\.[^.]+$)/i;
/** A returned file's name without the masked suffix, to name its restored copy. */
export const withoutMaskedSuffix = (name: string) => name.replace(maskedMark, "");
/** "Sổ khách.xlsx" + "OfflineMasked" → "Sổ khách (OfflineMasked).xlsx". */
export function exportName(original: string, suffix: string): string {
  const dot = original.lastIndexOf(".");
  const base = dot > 0 ? original.slice(0, dot) : original;
  const extension = dot > 0 ? original.slice(dot) : "";
  return `${base} (${suffix})${extension}`;
}

/** Save a copy where the user chooses. The desktop app asks with the system save
 * dialog, which also grants write access to exactly that file; the browser preview
 * downloads it. Returns false when the user cancels. */
export async function saveFile(bytes: Uint8Array, name: string): Promise<boolean> {
  const extension = name.toLowerCase().split(".").pop();
  const format =
    extension && extension in mimeTypes ? (extension as keyof typeof mimeTypes) : "xlsx";
  if (isTauri()) {
    const [{ save }, { writeFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const path = await save({
      defaultPath: name,
      filters: [{ name: fileKinds[format], extensions: [format] }],
    });
    if (!path) return false;
    await writeFile(path, bytes);
    return true;
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeTypes[format] }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

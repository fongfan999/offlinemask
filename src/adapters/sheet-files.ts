import { isTauri } from "@tauri-apps/api/core";
import type { CellEdits, SheetTable } from "../core/sheet/mask.ts";
import type { FileError } from "../core/sheet/files.ts";
import type { DocEdits, DocParagraph } from "../core/doc/docx.ts";
import type { FilesRequest, FilesResponse } from "../workers/files.worker.ts";

export const fileErrorMessages: Record<FileError, string> = {
  unsupported: "Chỉ hỗ trợ tệp .xlsx và .csv. Tệp .xls cũ hãy lưu lại thành .xlsx trước.",
  "too-large": "Tệp lớn hơn 20 MB. Hãy chia nhỏ tệp rồi thử lại.",
  "too-many-rows": "Tệp có hơn 100.000 dòng. Hãy chia nhỏ tệp rồi thử lại.",
  unreadable: "Chưa đọc được tệp này. Hãy kiểm tra tệp có mở được trong Excel không.",
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
  const waiting = new Map<number, { resolve: (value: FilesResponse) => void }>();
  function ensure() {
    if (worker) return worker;
    worker = new Worker(new URL("../workers/files.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<FilesResponse>) => {
      waiting.get(event.data.id)?.resolve(event.data);
      waiting.delete(event.data.id);
    };
    return worker;
  }
  function send(request: FilesRequest, transfer: Transferable[] = []): Promise<FilesResponse> {
    return new Promise((resolve) => {
      if (request.type !== "close") waiting.set(request.id, { resolve });
      ensure().postMessage(request, transfer);
      if (request.type === "close") resolve({ type: "failed", id: -1, code: "unreadable" });
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
    async openDoc(
      file: File,
    ): Promise<{ handle: string; paragraphs: DocParagraph[]; notes: string[]; mailto: string[] }> {
      const handle = crypto.randomUUID();
      const bytes = await file.arrayBuffer();
      const reply = await send({ type: "open-doc", id: ++sequence, handle, bytes }, [bytes]);
      if (reply.type === "failed") throw new SheetAdapterError(reply.code as FileError);
      if (reply.type !== "opened-doc") throw new SheetAdapterError("unreadable");
      return { handle, paragraphs: reply.paragraphs, notes: reply.notes, mailto: reply.mailto };
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
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const fileKinds = { xlsx: "Excel", csv: "CSV", docx: "Word" } as const;
/** "Sổ khách.xlsx" + "da-an" → "Sổ khách (đã ẩn).xlsx". */
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
  const format = extension === "csv" || extension === "docx" ? extension : "xlsx";
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

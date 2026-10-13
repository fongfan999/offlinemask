/// <reference lib="webworker" />
import {
  openSheetFile,
  SheetFileError,
  writeSheetFile,
  type SheetSource,
} from "../core/sheet/files.ts";
import type { CellEdits } from "../core/sheet/mask.ts";

/** Parses and writes spreadsheets off the main thread. Workbooks stay here, in
 * memory only, until the page closes them; only display strings go back. */
export type SheetRequest =
  | { type: "open"; id: number; handle: string; name: string; bytes: ArrayBuffer }
  | { type: "write"; id: number; handle: string; edits: CellEdits }
  | { type: "close"; handle: string };
export type SheetResponse =
  | {
      type: "opened";
      id: number;
      tables: import("../core/sheet/mask.ts").SheetTable[];
      notes: string[];
    }
  | { type: "written"; id: number; bytes: ArrayBuffer }
  | { type: "failed"; id: number; code: string };

const sources = new Map<string, SheetSource>();

self.onmessage = async (event: MessageEvent<SheetRequest>) => {
  const request = event.data;
  if (request.type === "close") {
    sources.delete(request.handle);
    return;
  }
  try {
    if (request.type === "open") {
      const file = await openSheetFile(new Uint8Array(request.bytes), request.name);
      sources.set(request.handle, file.source);
      postMessage({ type: "opened", id: request.id, tables: file.tables, notes: file.notes });
    } else {
      const source = sources.get(request.handle);
      if (!source) throw new SheetFileError("unreadable");
      const bytes = await writeSheetFile(source, request.edits);
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      (postMessage as (message: SheetResponse, transfer: Transferable[]) => void)(
        { type: "written", id: request.id, bytes: buffer as ArrayBuffer },
        [buffer as ArrayBuffer],
      );
    }
  } catch (error) {
    postMessage({
      type: "failed",
      id: request.id,
      code: error instanceof SheetFileError ? error.code : "unreadable",
    } satisfies SheetResponse);
  }
};

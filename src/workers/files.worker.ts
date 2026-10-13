/// <reference lib="webworker" />
import {
  mailtoTargets,
  openDocx,
  DocFileError,
  writeDocx,
  type DocEdits,
  type DocParagraph,
  type DocSource,
} from "../core/doc/docx.ts";
import {
  openSheetFile,
  SheetFileError,
  writeSheetFile,
  type SheetSource,
} from "../core/sheet/files.ts";
import type { CellEdits, SheetTable } from "../core/sheet/mask.ts";

/** Parses and writes spreadsheets and Word files off the main thread. Opened files
 * stay here, in memory only, until the page closes them; only text goes back. */
export type FilesRequest =
  | { type: "open"; id: number; handle: string; name: string; bytes: ArrayBuffer }
  | { type: "write"; id: number; handle: string; edits: CellEdits }
  | { type: "open-doc"; id: number; handle: string; bytes: ArrayBuffer }
  | { type: "write-doc"; id: number; handle: string; edits: DocEdits }
  | { type: "close"; handle: string };
export type FilesResponse =
  | { type: "opened"; id: number; tables: SheetTable[]; notes: string[] }
  | {
      type: "opened-doc";
      id: number;
      paragraphs: DocParagraph[];
      notes: string[];
      mailto: string[];
    }
  | { type: "written"; id: number; bytes: ArrayBuffer }
  | { type: "failed"; id: number; code: string };

const sheets = new Map<string, SheetSource>();
const docs = new Map<string, DocSource>();

function send(message: FilesResponse, transfer: Transferable[] = []) {
  (postMessage as (message: FilesResponse, transfer: Transferable[]) => void)(message, transfer);
}
function written(id: number, bytes: Uint8Array) {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  send({ type: "written", id, bytes: buffer }, [buffer]);
}

self.onmessage = async (event: MessageEvent<FilesRequest>) => {
  const request = event.data;
  if (request.type === "close") {
    sheets.delete(request.handle);
    docs.delete(request.handle);
    return;
  }
  try {
    if (request.type === "open") {
      const file = await openSheetFile(new Uint8Array(request.bytes), request.name);
      sheets.set(request.handle, file.source);
      send({ type: "opened", id: request.id, tables: file.tables, notes: file.notes });
    } else if (request.type === "write") {
      const source = sheets.get(request.handle);
      if (!source) throw new SheetFileError("unreadable");
      written(request.id, await writeSheetFile(source, request.edits));
    } else if (request.type === "open-doc") {
      const file = await openDocx(new Uint8Array(request.bytes));
      docs.set(request.handle, file.source);
      send({
        type: "opened-doc",
        id: request.id,
        paragraphs: file.paragraphs,
        notes: file.notes,
        mailto: mailtoTargets(file.source),
      });
    } else {
      const source = docs.get(request.handle);
      if (!source) throw new DocFileError("unreadable");
      written(request.id, await writeDocx(source, request.edits));
    }
  } catch (error) {
    send({
      type: "failed",
      id: request.id,
      code:
        error instanceof SheetFileError || error instanceof DocFileError
          ? error.code
          : "unreadable",
    });
  }
};

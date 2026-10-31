/// <reference lib="webworker" />
import {
  openDocument,
  writeDocument,
  type DocumentFormat,
  type DocumentSource,
} from "../core/doc/document.ts";
import { DocFileError, type DocEdits, type DocParagraph } from "../core/doc/docx.ts";
import {
  openSheetFile,
  SheetFileError,
  writeSheetFile,
  type SheetSource,
} from "../core/sheet/files.ts";
import type { OcrPage } from "../core/doc/ocr.ts";
import type { CellEdits, SheetTable } from "../core/sheet/mask.ts";

/** Parses and writes spreadsheets and documents off the main thread. Opened files
 * stay here, in memory only, until the page closes them; only text goes back. A PDF
 * reports each page read and can be cancelled while it is read (decision 0149). A
 * page without text, or a picture, is read by the system's text recognition through
 * the main thread, which alone can call native code (decision 0180). */
export type FilesRequest =
  | { type: "open"; id: number; handle: string; name: string; bytes: ArrayBuffer }
  | { type: "write"; id: number; handle: string; edits: CellEdits }
  | {
      type: "open-doc";
      id: number;
      handle: string;
      name: string;
      bytes: ArrayBuffer;
      /** Whether the main thread can answer `ocr` requests. */
      ocr?: boolean;
    }
  | { type: "cancel"; id: number }
  | { type: "write-doc"; id: number; handle: string; edits: DocEdits }
  | { type: "close"; handle: string }
  | { type: "ocr-result"; id: number; page?: OcrPage; error?: boolean };
export type FilesResponse =
  | { type: "opened"; id: number; tables: SheetTable[]; notes: string[] }
  | { type: "ocr"; id: number; image: ArrayBuffer; width: number; height: number }
  | {
      type: "opened-doc";
      id: number;
      format: DocumentFormat;
      paragraphs: DocParagraph[];
      notes: string[];
      mailto: string[];
    }
  | { type: "progress"; id: number; done: number; total: number }
  | { type: "written"; id: number; bytes: ArrayBuffer }
  | { type: "failed"; id: number; code: string };

const sheets = new Map<string, SheetSource>();
const docs = new Map<string, DocumentSource>();
const cancelled = new Set<number>();
/** Pictures sent to the main thread for recognition, awaiting their lines. */
const recognising = new Map<number, { resolve: (page: OcrPage) => void; reject: () => void }>();
let recognition = 0;
const recognise = (image: Uint8Array, width: number, height: number): Promise<OcrPage> =>
  new Promise((resolve, reject) => {
    const id = ++recognition;
    recognising.set(id, { resolve, reject });
    const buffer = image.buffer.slice(
      image.byteOffset,
      image.byteOffset + image.byteLength,
    ) as ArrayBuffer;
    send({ type: "ocr", id, image: buffer, width, height }, [buffer]);
  });

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
  if (request.type === "cancel") {
    cancelled.add(request.id);
    return;
  }
  if (request.type === "ocr-result") {
    const waiting = recognising.get(request.id);
    recognising.delete(request.id);
    if (request.error || !request.page) waiting?.reject();
    else waiting?.resolve(request.page);
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
      const id = request.id;
      const file = await openDocument(new Uint8Array(request.bytes), request.name, {
        onPage: (done, total) => send({ type: "progress", id, done, total }),
        stopped: () => cancelled.has(id),
        ...(request.ocr
          ? { ocr: recognise, decoders: new URL("/pdfjs/", location.href).href }
          : {}),
      });
      docs.set(request.handle, file.source);
      send({
        type: "opened-doc",
        id: request.id,
        format: file.source.format,
        paragraphs: file.paragraphs,
        notes: file.notes,
        mailto: file.mailto,
      });
    } else {
      const source = docs.get(request.handle);
      if (!source) throw new DocFileError("unreadable");
      written(request.id, await writeDocument(source, request.edits));
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
  } finally {
    cancelled.delete(request.id);
  }
};

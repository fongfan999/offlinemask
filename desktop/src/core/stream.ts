import type { Finding } from "./review.ts";

/** CSV and text files of any size, read and written a piece at a time (decision 0174).
 * The web view holds at most a few GB (decision 0173), and a bank's export can be
 * larger: masking reads the file once to find the values, keeping only the table of
 * values and their codes, and saving reads it again and writes each piece as it goes. */

/** About this much of the file is in memory at once. */
export const pieceBytes = 4 * 1024 * 1024;

/** The same choice as `decodeText`, made on the first piece: UTF-16 with its BOM,
 * otherwise UTF-8 when the start reads as UTF-8, otherwise Windows-1258. */
export function sniffEncoding(head: Uint8Array): { encoding: string; skip: number } {
  if (head[0] === 0xff && head[1] === 0xfe) return { encoding: "utf-16le", skip: 2 };
  if (head[0] === 0xfe && head[1] === 0xff) return { encoding: "utf-16be", skip: 2 };
  const skip = head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf ? 3 : 0;
  try {
    // `stream` lets a character cut at the end of the piece pass.
    new TextDecoder("utf-8", { fatal: true }).decode(head.subarray(skip), { stream: true });
    return { encoding: "utf-8", skip };
  } catch {
    return { encoding: "windows-1258", skip: 0 };
  }
}

/** The file's text a piece at a time, with how many bytes have been read. */
export async function* textPieces(
  file: Blob,
  size = pieceBytes,
): AsyncGenerator<{ text: string; read: number }> {
  const head = new Uint8Array(await file.slice(0, pieceBytes).arrayBuffer());
  const { encoding, skip } = sniffEncoding(head);
  const decoder = new TextDecoder(encoding);
  for (let at = skip; at < file.size; at += size) {
    const end = Math.min(file.size, at + size);
    const bytes = new Uint8Array(await file.slice(at, end).arrayBuffer());
    yield { text: decoder.decode(bytes, { stream: end < file.size }), read: end };
  }
}

/** Whole lines, each with the ending that followed it, a piece of the file at a time:
 * a value never straddles two pieces. */
export async function* linePieces(
  file: Blob,
  size = pieceBytes,
): AsyncGenerator<{ lines: { text: string; ending: string }[]; read: number }> {
  let rest = "";
  let read = 0;
  const split = (text: string, final: boolean) => {
    const lines: { text: string; ending: string }[] = [];
    const pattern = /\r\n|\n|\r/g;
    let start = 0;
    for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
      // A "\r" at the very end may be the first half of "\r\n".
      if (!final && match[0] === "\r" && match.index === text.length - 1) break;
      lines.push({ text: text.slice(start, match.index), ending: match[0] });
      start = match.index + match[0].length;
    }
    if (final && start < text.length) lines.push({ text: text.slice(start), ending: "" });
    rest = final ? "" : text.slice(start);
    return lines;
  };
  for await (const piece of textPieces(file, size)) {
    read = piece.read;
    yield { lines: split(rest + piece.text, false), read };
  }
  if (rest) yield { lines: split(rest, true), read };
}

/** CSV rows as they arrive, with the delimiter given (decision 0076's `guessDelimiter`
 * on the first piece). Quoted fields may hold delimiters, line breaks and doubled
 * quotes; text after a closing quote is kept, as Papa Parse does. */
export class CsvReader {
  /** The first line ending met, used again when writing. */
  newline = "";
  private rest = "";
  readonly delimiter: string;
  private readonly field: RegExp;
  constructor(delimiter: string) {
    this.delimiter = delimiter;
    const escaped = delimiter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    this.field = new RegExp(`[^${escaped}\\r\\n"]*`, "y");
  }
  /** Rows completed by this text; an unfinished row waits for the next. */
  feed(text: string, final = false): string[][] {
    const buffer = this.rest + text;
    const rows: string[][] = [];
    let at = 0;
    while (at < buffer.length) {
      const row = this.row(buffer, at, final);
      if (!row) break;
      rows.push(row.cells);
      at = row.end;
    }
    this.rest = buffer.slice(at);
    return rows;
  }
  finish(): string[][] {
    return this.rest ? this.feed("", true) : [];
  }
  private row(
    text: string,
    start: number,
    final: boolean,
  ): { cells: string[]; end: number } | null {
    const cells: string[] = [];
    let at = start;
    for (;;) {
      let value = "";
      if (text[at] === '"') {
        let from = at + 1;
        for (;;) {
          const quote = text.indexOf('"', from);
          if (quote < 0) {
            if (!final) return null;
            value += text.slice(from);
            at = text.length;
            break;
          }
          if (quote + 1 >= text.length && !final) return null;
          if (text[quote + 1] === '"') {
            value += text.slice(from, quote + 1);
            from = quote + 2;
            continue;
          }
          value += text.slice(from, quote);
          at = quote + 1;
          break;
        }
      }
      // An unquoted field, or what follows a closing quote, runs to the next separator.
      for (;;) {
        this.field.lastIndex = at;
        this.field.exec(text);
        value += text.slice(at, this.field.lastIndex);
        at = this.field.lastIndex;
        if (text[at] !== '"') break;
        value += '"';
        at++;
      }
      cells.push(value);
      const next = text[at];
      if (next === this.delimiter) {
        at++;
        continue;
      }
      if (next === undefined) return final ? { cells, end: at } : null;
      if (next === "\r" && at + 1 >= text.length && !final) return null;
      const ending = next === "\r" && text[at + 1] === "\n" ? "\r\n" : next;
      this.newline ||= ending;
      return { cells, end: at + ending.length };
    }
  }
}

const isWord = (code: number) => {
  if (Number.isNaN(code)) return false;
  return /[\p{L}\p{M}\p{N}_]/u.test(String.fromCharCode(code));
};
/** The type a finding's alias was made for: "TEN_3" → "TEN". */
const findingType = (finding: Finding) => finding.id.slice(0, finding.id.lastIndexOf("_"));

/** How a saved piece is masked: the values found while masking, except those the
 * person chose to keep, become their codes wherever they stand as whole words in a
 * scanned cell or line (the text page does the same, decision 0004); a hidden column's
 * cell becomes the code of its whole value. */
export function valueMasker(findings: readonly Finding[], kept: ReadonlySet<string>) {
  /** Values by their first two characters, longest first. */
  const starts = new Map<number, Finding[]>();
  const whole = new Map<string, string>();
  for (const finding of findings) {
    if (kept.has(finding.alias)) continue;
    whole.set(`${findingType(finding)}\u0000${finding.value}`, finding.alias);
    if (finding.value.length < 2) continue;
    const key = finding.value.charCodeAt(0) * 65_536 + finding.value.charCodeAt(1);
    const list = starts.get(key) ?? [];
    list.push(finding);
    starts.set(key, list);
  }
  for (const list of starts.values()) list.sort((a, b) => b.value.length - a.value.length);
  return {
    /** Every whole-word occurrence of a found value, as its code. */
    text(text: string): string {
      if (!starts.size) return text;
      let output = "";
      let copied = 0;
      for (let at = 0; at < text.length - 1;) {
        const list = starts.get(text.charCodeAt(at) * 65_536 + text.charCodeAt(at + 1));
        const hit = list?.find(
          (finding) =>
            text.startsWith(finding.value, at) &&
            !isWord(text.charCodeAt(at - 1)) &&
            !isWord(text.charCodeAt(at + finding.value.length)),
        );
        if (!hit) {
          at++;
          continue;
        }
        output += text.slice(copied, at) + hit.alias;
        at += hit.value.length;
        copied = at;
      }
      return copied ? output + text.slice(copied) : text;
    },
    /** A hidden column's cell: the code of its trimmed value, or the cell as it was. */
    cell(type: string, text: string): string {
      return whole.get(`${type}\u0000${text.trim()}`) ?? text;
    },
  };
}
export type ValueMasker = ReturnType<typeof valueMasker>;

/** A readable stream over an async generator's pieces, for writing a file piece by piece. */
export function pieceStream(pieces: AsyncIterator<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await pieces.next();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    async cancel() {
      await pieces.return?.(undefined);
    },
  });
}

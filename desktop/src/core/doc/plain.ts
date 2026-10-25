import { decodeText } from "../decode-text.ts";
import { applyReplacements, DocFileError, type DocEdits, type DocParagraph } from "./docx.ts";

/** A .md or .txt file, opened only to restore what the AI returned for a PDF (decision
 * 0149): each non-empty line is a paragraph, and writing keeps every line ending. */
export interface PlainSource {
  format: "plain";
  /** The file's lines, each with the ending that followed it. */
  lines: { text: string; ending: string }[];
  /** Paragraph id → line index. */
  index: number[];
}

export function openPlain(bytes: Uint8Array): {
  source: PlainSource;
  paragraphs: DocParagraph[];
  notes: string[];
} {
  const text = decodeText(bytes);
  const lines: PlainSource["lines"] = [];
  const pattern = /\r\n|\n|\r/g;
  let start = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    lines.push({ text: text.slice(start, match.index), ending: match[0] });
    start = match.index + match[0].length;
  }
  lines.push({ text: text.slice(start), ending: "" });
  const paragraphs: DocParagraph[] = [];
  const index: number[] = [];
  lines.forEach((line, lineIndex) => {
    if (!line.text.trim()) return;
    index.push(lineIndex);
    paragraphs.push({ id: paragraphs.length, part: "text", text: line.text });
  });
  if (!paragraphs.length) throw new DocFileError("empty");
  return { source: { format: "plain", lines, index }, paragraphs, notes: [] };
}

export function writePlain(source: PlainSource, edits: DocEdits): Uint8Array {
  const lines = source.lines.map((line) => line.text);
  for (const [id, replacements] of edits.paragraphs) {
    const lineIndex = source.index[id];
    if (lineIndex !== undefined)
      lines[lineIndex] = applyReplacements(lines[lineIndex]!, replacements).text;
  }
  return new TextEncoder().encode(
    lines.map((text, index) => text + source.lines[index]!.ending).join(""),
  );
}

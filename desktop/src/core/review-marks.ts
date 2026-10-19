import type { Decisions } from "./review.ts";
import type { TextAnalysis } from "./text.ts";

/** A highlighted run in the text a textarea shows: an alias in the masked copy,
 * a value that will be hidden in the original, or a likely name still in clear text. */
export interface TextMark {
  start: number;
  end: number;
  kind: "alias" | "value" | "hint";
}

/** Textarea values normalize CRLF and CR to LF; marks are offsets into that text. */
export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/** The text a review textarea shows, with a mark for every masked finding. */
export function reviewDisplay(
  text: string,
  analysis: TextAnalysis,
  decisions: Decisions,
  masked: boolean,
): { text: string; marks: TextMark[] } {
  const findings = new Map(analysis.findings.map((finding) => [finding.id, finding]));
  const marks: TextMark[] = [];
  let display = "";
  let cursor = 0;
  for (const span of analysis.spans) {
    display += normalizeNewlines(text.slice(cursor, span.start));
    const hidden = decisions[span.findingId] === "mask";
    const shown =
      masked && hidden ? findings.get(span.findingId)!.alias : text.slice(span.start, span.end);
    const start = display.length;
    display += normalizeNewlines(shown);
    if (hidden) marks.push({ start, end: display.length, kind: masked ? "alias" : "value" });
    cursor = span.end;
  }
  display += normalizeNewlines(text.slice(cursor));
  return { text: display, marks };
}

/** Every occurrence of each value in `text`, skipping ones that overlap `taken`. */
export function occurrenceMarks(
  text: string,
  values: readonly string[],
  kind: TextMark["kind"],
  taken: readonly TextMark[] = [],
): TextMark[] {
  const marks: TextMark[] = [];
  for (const value of values) {
    if (!value) continue;
    for (let start = text.indexOf(value); start >= 0; start = text.indexOf(value, start + 1)) {
      const end = start + value.length;
      if (![...taken, ...marks].some((mark) => mark.start < end && mark.end > start))
        marks.push({ start, end, kind });
    }
  }
  return marks.sort((a, b) => a.start - b.start);
}

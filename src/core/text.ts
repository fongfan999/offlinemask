import type { Decisions, Finding, TextPart } from "./review.ts";
import type { Detection } from "./detection/types.ts";

export const maxTextLength = 50_000;
export interface TextSpan {
  start: number;
  end: number;
  findingId: string;
}
export interface TextAnalysis {
  findings: Finding[];
  spans: TextSpan[];
}

function isWord(character: string | undefined): boolean {
  return !!character && /[\p{L}\p{M}\p{N}_]/u.test(character);
}

export function validateText(text: string): string {
  if (!text.trim()) return "Nhập hoặc dán văn bản để bắt đầu.";
  if (text.length > maxTextLength)
    return "Văn bản quá dài. Hãy chia thành các phần tối đa 50.000 ký tự.";
  return "";
}

/** Policy and exact-span transformation; detection belongs to external providers. */
export function analyzeText(text: string, scope: string, detections: readonly Detection[]): TextAnalysis {
  const error = validateText(text);
  if (error) throw new Error(error);
  if (!/^[a-f0-9]{8}$/i.test(scope)) throw new Error("Invalid alias scope");
  for (const detection of detections) {
    if (!Number.isInteger(detection.start) || !Number.isInteger(detection.end)
      || detection.start < 0 || detection.end <= detection.start || detection.end > text.length
      || !/^[A-Z_]+$/.test(detection.type)) throw new Error("Invalid detector span");
  }
  const entries: Finding[] = [];
  const counters = new Map<string, number>();
  const byValue = new Map<string, Finding>();
  const occupied = new Uint8Array(text.length);
  const spans: TextSpan[] = [];
  function accept(span: TextSpan) {
    if (occupied.subarray(span.start, span.end).some(Boolean)) return false;
    occupied.fill(1, span.start, span.end);
    spans.push(span);
    return true;
  }
  // Explicit banking labels outrank model guesses; otherwise prefer complete spans.
  const ordered = [...detections].sort((a, b) =>
    b.priority - a.priority || (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  for (const detection of ordered) {
    if (occupied.subarray(detection.start, detection.end).some(Boolean)) continue;
    const value = text.slice(detection.start, detection.end);
    const key = detection.type + ":" + value;
    let finding = byValue.get(key);
    if (!finding) {
      let count = counters.get(detection.type) ?? 0;
      let alias: string;
      do { alias = "[" + detection.type + "_" + (++count) + "_" + scope + "]"; }
      while (text.includes(alias));
      counters.set(detection.type, count);
      finding = {
        id: detection.type + "_" + count, label: detection.label, value, alias,
        reason: detection.reason, source: detection.source,
      };
      byValue.set(key, finding);
      entries.push(finding);
    }
    accept({start: detection.start, end: detection.end, findingId: finding.id});
  }
  // Consistent exact values, without overwriting another provider's explicit span.
  for (const finding of entries) {
    let cursor = 0;
    while (cursor < text.length) {
      const start = text.indexOf(finding.value, cursor);
      if (start < 0) break;
      const end = start + finding.value.length;
      if (!isWord(text[start - 1]) && !isWord(text[end]))
        accept({ start, end, findingId: finding.id });
      cursor = end;
    }
  }
  spans.sort((a, b) => a.start - b.start);
  const firstOccurrence = new Map<string, number>();
  for (const span of spans) {
    if (!firstOccurrence.has(span.findingId)) firstOccurrence.set(span.findingId, span.start);
  }
  return {
    findings: entries.sort((a, b) => firstOccurrence.get(a.id)! - firstOccurrence.get(b.id)!),
    spans,
  };
}

export function textParts(text: string, spans: readonly TextSpan[]): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor) parts.push({ text: text.slice(cursor, span.start) });
    parts.push({ text: text.slice(span.start, span.end), findingId: span.findingId });
    cursor = span.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

export function maskedText(text: string, analysis: TextAnalysis, decisions: Decisions): string {
  const entries = new Map(analysis.findings.map((finding) => [finding.id, finding]));
  if (analysis.findings.some(({ id }) => !["mask", "keep"].includes(decisions[id] ?? "")))
    throw new Error("Missing masking decision");
  return textParts(text, analysis.spans).map((part) => {
    const finding = part.findingId ? entries.get(part.findingId) : undefined;
    return finding && decisions[finding.id] === "mask" ? finding.alias : part.text;
  }).join("");
}

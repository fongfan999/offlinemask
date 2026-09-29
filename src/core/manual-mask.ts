import { graphemeBoundaries, textGraphemes } from "./unicode.ts";
import type { Decisions } from './review.ts';
import type { TextAnalysis } from './text.ts';

export interface SourceSelection { start: number; end: number }

/** Textarea values normalize CRLF/CR to LF. Alias interiors map to the entire source span. */
export function previewSelection(text: string, analysis: TextAnalysis, decisions: Decisions,
  masked: boolean, start: number, end: number): SourceSelection | null {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start) return null;
  const lower = [0];
  const upper = [0];
  const findings = new Map(analysis.findings.map(f => [f.id, f]));
  let display = '';
  function append(value: string, sourceStart: number, sourceEnd: number, alias: boolean) {
    for (let i = 0; i < value.length; i++) {
      const crlf = value[i] === '\r' && value[i + 1] === '\n';
      display += value[i] === '\r' ? '\n' : value[i];
      const next = i + (crlf ? 2 : 1);
      lower.push(alias && next < value.length ? sourceStart : alias ? sourceEnd : sourceStart + next);
      upper.push(alias ? sourceEnd : sourceStart + next);
      if (crlf) i++;
    }
  }
  let cursor = 0;
  for (const span of analysis.spans) {
    append(text.slice(cursor, span.start), cursor, span.start, false);
    const finding = findings.get(span.findingId)!;
    const alias = masked && decisions[span.findingId] === 'mask';
    append(alias ? finding.alias : text.slice(span.start, span.end), span.start, span.end, alias);
    cursor = span.end;
  }
  append(text.slice(cursor), cursor, text.length, false);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > display.length
    || end <= start || !display.slice(start, end).trim()) return null;
  let sourceStart = lower[start]!;
  let sourceEnd = upper[end]!;
  // Never split an emoji, combining accent, or existing finding when correcting it.
  for (const { segment, index } of textGraphemes(text)) {
    if (index < sourceStart && index + segment.length > sourceStart) sourceStart = index;
    if (index < sourceEnd && index + segment.length > sourceEnd) sourceEnd = index + segment.length;
  }
  for (const span of analysis.spans) {
    if (span.start < sourceEnd && span.end > sourceStart) {
      sourceStart = Math.min(sourceStart, span.start);
      sourceEnd = Math.max(sourceEnd, span.end);
    }
  }
  if (analysis.spans.some(span => span.start <= sourceStart && span.end >= sourceEnd
    && decisions[span.findingId] === 'mask')) return null;
  return { start: sourceStart, end: sourceEnd };
}

/** Only the selected occurrence changes. All other aliases and decisions remain stable. */
export function addManualMask(text: string, analysis: TextAnalysis, decisions: Decisions,
  scope: string, selection: SourceSelection, after = 0): { analysis: TextAnalysis; decisions: Decisions; manualMaskCount: number } {
  const { start, end } = selection;
  if (!Number.isSafeInteger(after) || after < 0 || after >= Number.MAX_SAFE_INTEGER
    || !/^[a-f0-9]{8}$/i.test(scope) || !Number.isInteger(start) || !Number.isInteger(end)
    || start < 0 || end > text.length || start >= end || !text.slice(start, end).trim())
    throw new Error('Invalid manual selection');
  const boundaries = graphemeBoundaries(text);
  if (!boundaries.includes(start) || !boundaries.includes(end)) throw new Error('Partial character selection');
  // Callers must resolve display coordinates and expand partial spans first.
  if (analysis.spans.some(s => s.start < end && s.end > start && (s.start < start || s.end > end)))
    throw new Error('Partial finding selection');
  let count = after;
  let id: string;
  let alias: string;
  do {
    id = `AN_THEM_${++count}`;
    alias = `[${id}_${scope}]`;
  } while (text.includes(alias) || analysis.findings.some(f => f.id === id || f.alias === alias));
  const spans = analysis.spans.filter(s => s.end <= start || s.start >= end);
  spans.push({ start, end, findingId: id });
  spans.sort((a, b) => a.start - b.start);
  const used = new Set(spans.map(s => s.findingId));
  const findings = analysis.findings.filter(f => used.has(f.id));
  findings.push({ id, alias, value: text.slice(start, end), label: 'Ẩn thêm',
    reason: 'Chỉ phần bạn đã chọn.', source: 'Bạn đã chọn' });
  const first = new Map<string, number>();
  for (const span of spans) if (!first.has(span.findingId)) first.set(span.findingId, span.start);
  findings.sort((a, b) => first.get(a.id)! - first.get(b.id)!);
  return { analysis: { findings, spans }, manualMaskCount: count,
    decisions: Object.fromEntries(findings.map(f => [f.id, f.id === id ? 'mask' : decisions[f.id]!])) };
}

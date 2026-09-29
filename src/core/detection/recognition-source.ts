import type { RawTokenClassificationEntity } from 'openmed';
import { textGraphemes } from '../unicode.ts';
import type { Detection } from './types.ts';

export interface TokenOffsets { ids: number[]; offsets: [number, number][] }
export type EncodeRecognition = (text: string) => Promise<TokenOffsets>;

/** Compose only for inference; replacements always reference the original input. */
export function recognitionSource(source: string) {
  let text = '';
  const starts: number[] = [], ends: number[] = [];
  for (const { segment, index } of textGraphemes(source)) {
    const composed = segment.normalize('NFC');
    text += composed;
    for (let i = 0; i < composed.length; i++) { starts.push(index); ends.push(index + segment.length); }
  }
  return { text, restore(detections: readonly Detection[]) {
    return detections.map(d => {
      if (!Number.isInteger(d.start) || !Number.isInteger(d.end) || d.start < 0 || d.end <= d.start || d.end > text.length)
        throw new Error('Invalid normalized source span');
      return { ...d, start: starts[d.start]!, end: ends[d.end - 1]! };
    });
  } };
}

export function attachRecognitionOffsets(text: string, tokens: RawTokenClassificationEntity[], ids: number[], reference: TokenOffsets) {
  if (ids.length !== reference.ids.length || ids.some((id, i) => id !== reference.ids[i]) || tokens.length !== reference.offsets.length)
    throw new Error('Tokenizer identity mismatch');
  let previous = 0;
  return tokens.map((token, i) => {
    const [start, end] = reference.offsets[i]!;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < previous || end <= start || end > text.length || token.index !== i + 1)
      throw new Error('Invalid tokenizer offsets');
    previous = start;
    const labels: Record<string, string> = { PER: 'PERSON', LOC: 'LOCATION', ORG: 'ORGANIZATION' };
    if (!token.entity) throw new Error('Missing model label');
    const [prefix, label] = token.entity.split('-');
    return { ...token, start, end, word: text.slice(start, end), entity: labels[label!] ? `${prefix}-${labels[label!]}` : 'O' };
  });
}

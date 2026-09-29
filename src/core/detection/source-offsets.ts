import type { RawTokenClassificationEntity } from 'openmed';

/** Exact, sequential alignment for the pinned NFC/Metaspace tokenizers.
 * No accent folding, case folding, or searching ahead for a plausible word.
 * Every source character except whitespace must be accounted for, including O tokens.
 */
export function alignSourceTokens(text: string, tokens: readonly RawTokenClassificationEntity[]) {
  const starts: number[] = [];
  const ends: number[] = [];
  let normalized = '';
  for (const { segment, index } of new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(text)) {
    const value = segment.normalize('NFC');
    normalized += value;
    for (let i = 0; i < value.length; i++) {
      starts.push(index);
      ends.push(index + segment.length);
    }
  }
  let cursor = 0;
  const aligned = [];
  for (const token of tokens) {
    let piece = token.word ?? '';
    if (!piece) throw new Error('Missing source token');
    const start = cursor;
    // Metaspace also represents a literal U+2581 in pasted input. Consume it
    // explicitly instead of dropping the source character as a separator.
    while (piece.startsWith('▁')) {
      if (normalized[cursor] === '▁') cursor++;
      else {
        const whitespace = normalized.slice(cursor).match(/^\s+/u)?.[0] ?? '';
        // A single NBSP remains a literal token in these tokenizers. Their
        // normalizer collapses repeated whitespace and CR/LF/tab to spaces.
        if (whitespace.length > 1 || /^[ \r\n\t]/u.test(whitespace)) cursor += whitespace.length;
      }
      piece = piece.slice(1);
    }
    if (!piece) {
      if (normalized.slice(start, cursor).includes('▁'))
        aligned.push({ ...token, start: starts[start]!, end: ends[cursor - 1]! });
      continue;
    }
    piece = piece.normalize('NFC');
    while (!normalized.startsWith(piece, cursor) && cursor < normalized.length && /\s/u.test(normalized[cursor]!)) cursor++;
    if (!normalized.startsWith(piece, cursor)) throw new Error('Source token alignment failed');
    const end = cursor + piece.length;
    aligned.push({ ...token, start: starts[cursor]!, end: ends[end - 1]! });
    cursor = end;
  }
  if (normalized.slice(cursor).trim()) throw new Error('Incomplete source token alignment');
  return aligned;
}

/** Developer-only reversible NFC view. Offsets stay in original UTF-16 units. */
export function normalizeWithMap(text) {
  let normalized = '';
  const spans = [];
  for (const { segment, index } of new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(text)) {
    const value = segment.normalize('NFC');
    normalized += value;
    for (const _ of value) spans.push([index, index + segment.length]);
  }
  return { normalized, spans };
}
export function originalSpan(spans, start, end) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > spans.length)
    throw new Error('Invalid normalized token interval');
  return [spans[start][0], spans[end - 1][1]];
}

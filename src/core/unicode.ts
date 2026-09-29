/** Segment bounded windows while carrying the final, potentially incomplete cluster.
 * This avoids giving Intl.Segmenter the entire document for every returned item.
 * In WebKit, full-document segmentation can create large temporary allocations.
 */
export function* textGraphemes(text: string): Generator<{ segment: string; index: number }> {
  const segmenter = new Intl.Segmenter('vi', { granularity: 'grapheme' });
  let start = 0;
  let end = 0;
  while (start < text.length) {
    end = Math.min(Math.max(end, start) + 1024, text.length);
    // A UTF-16 window must not cut a surrogate pair.
    if (end < text.length && /[\uD800-\uDBFF]/u.test(text[end - 1]!)) end--;
    let last: { segment: string; index: number } | undefined;
    for (const { segment, index } of segmenter.segment(text.slice(start, end))) {
      if (last) yield last;
      last = { segment, index: start + index };
    }
    if (!last) break;
    if (end === text.length) { yield last; break; }
    // Keep the whole last cluster, including combining marks, ZWJ sequences,
    // regional-indicator pairs and CR, to retain segmentation context.
    start = last.index;
  }
}

/** UTF-16 offsets at complete user-perceived characters. */
export function graphemeBoundaries(text: string): number[] {
  const boundaries: number[] = [];
  for (const { index } of textGraphemes(text)) boundaries.push(index);
  boundaries.push(text.length);
  return boundaries;
}

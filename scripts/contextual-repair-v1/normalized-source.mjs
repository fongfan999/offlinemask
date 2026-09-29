import { textGraphemes } from '../../src/core/unicode.ts';

/** Inference-only canonical composition. Every returned span refers to the
 * original UTF-16 string and includes complete graphemes. No case/accent folding.
 */
export function normalizedSource(source) {
  let text = '';
  const starts = [], ends = [];
  for (const {segment,index} of textGraphemes(source)) {
    const composed = segment.normalize('NFC');
    text += composed;
    for (let i=0;i<composed.length;i++) { starts.push(index); ends.push(index+segment.length); }
  }
  return {text, restore(detections) {
    return detections.map(d => {
      if (!Number.isInteger(d.start) || !Number.isInteger(d.end) || d.start < 0 || d.end <= d.start || d.end > text.length)
        throw Error('Invalid normalized source span');
      return {...d,start:starts[d.start],end:ends[d.end-1]};
    });
  }};
}

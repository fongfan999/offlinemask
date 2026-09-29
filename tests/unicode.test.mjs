import test from 'node:test';
import assert from 'node:assert/strict';
import { textGraphemes, graphemeBoundaries } from '../src/core/unicode.ts';

const reference = text => Array.from(new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(text), ({ segment, index }) => ({ segment, index }));
test('windowed graphemes match whole-input segmentation across window edges', () => {
  const clusters = ['\r\n', 'a\u0301\u0323', '👩🏽‍💻', '🇻🇳🇺🇸🇯', '\u0600A', 'क्\u200dष', '각', 'a\u0301'.repeat(4), '\ud800', '\udc00'];
  for (const cluster of clusters) for (let position = 1006; position <= 1030; position++) {
    const text = 'x'.repeat(position) + cluster.repeat(5) + ' Việt Nam';
    assert.deepEqual([...textGraphemes(text)], reference(text), `edge ${position}, ${JSON.stringify(cluster)}`);
  }
});
test('large inputs and clusters longer than a window retain exact offsets', () => {
  for (const text of ['', 'a'.repeat(50000), 'A' + '\u0301'.repeat(6000) + 'B', '🇻'.repeat(2500), '👩\u200d'.repeat(1300) + '👩']) {
    const actual = [...textGraphemes(text)];
    assert.deepEqual(actual, reference(text));
    assert.equal(actual.map(item => item.segment).join(''), text);
    assert.deepEqual(graphemeBoundaries(text), [...actual.map(item => item.index), text.length]);
  }
});

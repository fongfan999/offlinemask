import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadDetector } from '../src/core/detection/openmed.ts';
import { analyzeText, maskedText } from '../src/core/text.ts';

// Synthetic fixtures only. Loading and inference must work with network fetch disabled.
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('Network access forbidden during model evaluation'); };
const alternative = process.argv[2] === '--alternative' ? process.argv[3] : null;
const path = alternative ? fileURLToPath(new URL('../artifacts/alternative-models', import.meta.url))
  : process.argv[2] ?? fileURLToPath(new URL('../public/models', import.meta.url));
const started = performance.now();
const detector = alternative ? await (await import('./alternative-detector.mjs')).loadAlternative(path, alternative)
  : await loadDetector(path, '', 'cpu');
console.log(`Local model loaded in ${Math.round(performance.now() - started)} ms; network fetch disabled.`);
try {
  const fixtures = JSON.parse(await readFile(new URL('../tests/fixtures/text-model.json', import.meta.url)));
  fixtures.push({id:'long-tail',text:'Nội dung tổng hợp. '.repeat(150)+'Khách hàng Trần Minh Bình. Email tail@example.org.',sensitive:['Trần Minh Bình','tail@example.org'],retain:[]});
  let failures = 0;
  for(const fixture of fixtures) {
    const start = performance.now();
    const detections = await detector.detect(fixture.text, () => {});
    const analysis = analyzeText(fixture.text, '12345678', detections);
    const output = maskedText(fixture.text, analysis, Object.fromEntries(analysis.findings.map(x=>[x.id,'mask'])));
    try {
      for(const value of fixture.sensitive) {
        let cursor = 0;
        while(true) {
          const at = fixture.text.indexOf(value,cursor);
          if(at<0) break;
          // Every non-whitespace source character must be covered, not just a name fragment.
          for(let i=at;i<at+value.length;i++) if(!/\s/u.test(fixture.text[i]))
            assert.ok(analysis.spans.some(s=>s.start<=i && s.end>i), `${fixture.id}: incomplete ${value}`);
          cursor=at+value.length;
        }
      }
      for(const value of fixture.retain) assert.ok(output.includes(value), `${fixture.id}: changed ${value}`);
      assert.equal(maskedText(fixture.text,analysis,Object.fromEntries(analysis.findings.map(x=>[x.id,'keep']))),fixture.text);
      console.log(`PASS ${fixture.id}: ${Math.round(performance.now()-start)} ms`);
    }catch(error){failures++;console.error(error.message);console.error('Synthetic preview tail:',output.slice(-500));}
  }
  assert.equal(failures,0,`${failures} model regression(s)`);
} finally {
  await detector.dispose();
  globalThis.fetch=originalFetch;
}

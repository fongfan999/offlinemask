import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadDetector } from '../../src/core/detection/openmed.ts';
import { createDetectionEngine } from '../../src/core/detection/engine.ts';
import { analyzeText } from '../../src/core/text.ts';
import { filterDetections } from '../../src/core/detection/options.ts';
import { createWasmProvider } from '../native-prototype/wasm-provider.mjs';
import { categories, parseFixture } from '../model-comparison-metrics.mjs';
import { root, outputRoot, hash, verifyProtocol, verifyAssets, readJson } from './evidence.mjs';

const protocol = await verifyProtocol();
await verifyAssets(protocol, 'combined');
const baseline = join(outputRoot, 'baseline');
// Reconstruct the exact original implementation using frozen changed sources
// and verified unchanged files. A clean checkout does not need ignored history.
for (const [file, expected] of Object.entries(protocol.baselineHashes)) {
  const source = protocol.baselineSources[file] ?? await readFile(join(root, file), 'utf8');
  assert.equal(hash(source), expected, file);
  const target = join(baseline, file);
  await mkdir(join(target, '..'), { recursive: true });
  await writeFile(target, source);
}
await mkdir(join(baseline, 'scripts'), { recursive: true });
await writeFile(join(baseline, 'scripts/model-manifest.json'), await readFile(join(root, 'scripts/model-manifest.json')));
const old = await import(pathToFileURL(join(baseline, 'src/core/detection/openmed.ts')).href);
const { createDetectionEngine: oldEngine } = await import(pathToFileURL(join(baseline, 'src/core/detection/engine.ts')).href);
globalThis.fetch = async () => { throw Error('Network forbidden during parity check'); };
const actual = await createWasmProvider(join(root, 'public/models'));
const cache = new Map(), classifiers = [];
const before = await old.loadDetector(join(root, 'public/models'), join(root, 'public/runtime/'), 'wasm', undefined, async directory => {
  const classifier = await actual(directory); classifiers.push(classifier);
  return { tokenizer: classifier.tokenizer, dispose: async () => {}, async predict(text) {
    const tokens = await classifier.predict(text); cache.set(directory + '\0' + text, structuredClone(tokens)); return tokens;
  } };
});
let index = 0;
const after = await loadDetector(join(root, 'public/models'), join(root, 'public/runtime/'), 'wasm', undefined, async directory => ({
  tokenizer: classifiers[index++].tokenizer, dispose: async () => {}, async predict(text) {
    const key = directory + '\0' + text;
    assert.ok(cache.has(key), 'Chunk/input changed during refactor');
    return structuredClone(cache.get(key));
  },
}));
const newLocal = createDetectionEngine(), oldLocal = oldEngine();
let checked = 0;
try {
  for (const file of Object.keys(protocol.fixtures)) {
    for (const fixture of (await readJson(join(root, 'tests/fixtures', file))).map(parseFixture)) {
      cache.clear();
      const oldProgress = [], nextProgress = [];
      const expected = await before.detect(fixture.text, value => oldProgress.push(value));
      const actual = await after.detect(fixture.text, value => nextProgress.push(value));
      assert.deepEqual(actual, expected, `${file}/${fixture.id}: detections`);
      assert.deepEqual(nextProgress, oldProgress, `${file}/${fixture.id}: progress`);
      for (const scope of [categories, ...categories.map(c => [c])]) {
        assert.deepEqual(analyzeText(fixture.text, '12345678', filterDetections(actual, scope)),
          analyzeText(fixture.text, '12345678', filterDetections(expected, scope)), fixture.id);
      }
      for (const options of [['email'], ['phone'], ['banking'], ['email', 'phone', 'banking']]) {
        const request = { text: fixture.text, options };
        assert.deepEqual(await newLocal(request, () => {}), await oldLocal(request, () => {}), `${fixture.id}: local scope`);
      }
      checked++;
    }
    console.log('Parity', file, checked);
  }
} finally { await Promise.all(classifiers.map(c => c.dispose())); }
await writeFile(join(outputRoot, 'parity.json'), JSON.stringify({ checked, identical: true,
  backend: 'Production-version WASM under Node; identical tokens replayed through both implementations', protocol }, null, 2) + '\n');
console.log(`PASS ${checked} original/refactored cases, progress and selected-category/local-only output`);

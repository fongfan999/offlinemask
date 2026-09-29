import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = new URL('../../', import.meta.url);
const output = resolve(process.argv[2] ?? fileURLToPath(new URL('artifacts/detector-corpus-v1-final', root)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const evidence = JSON.parse(await readFile(resolve(output, 'evidence.json')));
for (const [path, expected] of Object.entries(evidence.sourceHashes)) {
  assert.equal(hash(await readFile(new URL(path, root))), expected, `Source changed after preparation: ${path}`);
}
for (const [name, expected] of Object.entries(evidence.outputHashes)) {
  assert.equal(hash(await readFile(resolve(output, name))), expected, `Output changed after preparation: ${name}`);
}
const tests = await readFile(resolve(output, 'tests.log'), 'utf8');
assert.match(tests, /tests 131\b/); assert.match(tests, /pass 131\b/); assert.match(tests, /fail 0\b/);
assert.equal(evidence.audit.pilotReady, false);
assert.equal(evidence.audit.independentReview.approved, 0);
assert.equal(evidence.audit.independentReview.pending, 91);
evidence.sourceHashes['scripts/detector-corpus-v1/freeze.mjs'] = hash(await readFile(new URL('scripts/detector-corpus-v1/freeze.mjs', root)));
const result = { ...evidence, artifactDirectory: output.slice(fileURLToPath(root).length),
  verification: { testsPassed: 131, independentHumanReviewPerformed: false, historicalPreparationAndProductionHashesVerified: true },
  evidenceSha256: hash(await readFile(resolve(output, 'evidence.json'))), testLogSha256: hash(tests) };
await writeFile(new URL('docs/evaluations/detector-corpus-v1/results.json', root), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ testsPassed: 131, families: 88, independentReviews: 0, pilotReady: result.audit.pilotReady }));

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fixtures, verify, root, hash } from '../model-recheck/common.mjs';
import { join } from 'node:path';
await verify();
const paths = ['docs/evaluations/pretrained-scope/spec.md', 'docs/evaluations/model-recheck-v1-results.json',
  'scripts/pretrained-scope/common.mjs', 'scripts/pretrained-scope/evaluate.mjs', 'scripts/pretrained-scope/freeze.mjs',
  'scripts/pretrained-scope/report.mjs', 'tests/pretrained-scope.test.mjs'];
const sourceHashes = {};
for (const path of paths) sourceHashes[path] = hash(await readFile(join(root, path)));
const protocol = { createdAt: new Date().toISOString(), node: process.version, cases: (await fixtures()).length, sourceHashes };
await mkdir(join(root, 'artifacts/pretrained-scope'));
await writeFile(join(root, 'docs/evaluations/pretrained-scope/protocol.json'), JSON.stringify(protocol, null, 2) + '\n', { flag: 'wx' });
console.log('Frozen scope experiment before inference.');

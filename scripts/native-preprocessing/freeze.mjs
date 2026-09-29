import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { verifyProtocol } from '../shared-core/evidence.mjs';
import { root, hash, protocolPath, runtimeVersion } from './evidence.mjs';
await verifyProtocol();
const sources = {};
for (const name of await readdir(join(root, 'scripts/native-preprocessing'))) {
  if (!/\.(mjs|py)$/.test(name)) continue;
  const file = `scripts/native-preprocessing/${name}`;
  sources[file] = hash(await readFile(join(root, file)));
}
sources['tests/native-preprocessing.test.mjs'] = hash(await readFile(join(root, 'tests/native-preprocessing.test.mjs')));
await writeFile(protocolPath, JSON.stringify({ createdAt: new Date().toISOString(),
  baseProtocolSha256: hash(await readFile(join(root, 'docs/evaluations/shared-core-protocol-v2.json'))),
  baseResultSha256: hash(await readFile(join(root, 'docs/evaluations/shared-core-comparison.json'))),
  sources, runtimeVersion: runtimeVersion(), tokenizerVersion: '0.22.2',
  change: 'BigMed native tokenizer supplies every count query, inference tensor ID and original UTF-16 offset. Shared window algorithm and detection policy unchanged. No production imports of this provider.',
  method: 'Two fresh sequential Node CPU processes, same 262 observed cases. Reuse verified previous control runs because their implementation is unchanged. Report per-category full coverage and ordinary masking for both stages, all gains/losses and failures.',
  criteria: 'Existing shared-core screening floor unchanged. No requests may fail. Repeated quality outputs must match. An observed-corpus pass alone cannot select a release model.',
  limits: 'Developer-only Python tokenizer preparation and Node CPU inference; no packaged desktop, speed or memory qualification. No newly held-out or private input.',
}, null, 2) + '\n', { flag: 'wx' });
console.log('Frozen native preprocessing protocol');

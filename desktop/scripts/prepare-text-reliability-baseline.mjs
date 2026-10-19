// Reconstruct the pre-change developer detector from the durable evaluation report.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
const root=new URL('../',import.meta.url).pathname;
const report=JSON.parse(await readFile(root+'../docs/evaluations/2026-09-14-text-reliability.json'));
const hash=value=>createHash('sha256').update(value).digest('hex');
assert.equal(hash(await readFile(root+'pnpm-lock.yaml')),report.dependencyLockSha256,'Use the evaluated dependency lockfile');
for(const [file,expected] of Object.entries(report.finalProtocol.implementationHashes)) assert.equal(hash(await readFile(root+file)),expected,'Use the evaluated implementation: '+file);
const destination=root+'artifacts/text-reliability-20260914/baseline/';
await mkdir(destination+'scripts',{recursive:true});
await cp(root+'src/core',destination+'src/core',{recursive:true});
await cp(root+'scripts/model-manifest.json',destination+'scripts/model-manifest.json');
for(const [file,source] of Object.entries(report.baselineSources)){
 assert.ok(report.protocol.implementationFiles.includes(file));
 await mkdir(dirname(destination+file),{recursive:true});
 await writeFile(destination+file,source);
}
console.log('Restored only the ignored synthetic-evaluation baseline; installed pack unchanged.');

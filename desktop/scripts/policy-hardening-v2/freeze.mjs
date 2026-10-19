import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,hash,readJson,changedPaths,protocolPath} from './common.mjs';
const old=await readJson(join(root,'docs/evaluations/shared-core-protocol-v2.json'));
const challenge=await readJson(join(root,'docs/evaluations/release-challenge-v1-protocol.json'));
const before=await readJson(join(root,'artifacts/policy-hardening-v2/before.json'));
const files={},beforeSources={};
for(const [file,expected] of Object.entries(old.files)) {
  const content=await readFile(join(root,file));
  if(changedPaths.includes(file)) {
    assert.equal(hash(before.files[file]),expected,`Incorrect original: ${file}`);
    beforeSources[file]=before.files[file];
  } else assert.equal(hash(content),expected,`Unrelated source changed: ${file}`);
  files[file]=hash(content);
}
for(const [file,expected] of Object.entries(old.fixtures)) {
  const path=`tests/fixtures/${file}`;
  files[path]=hash(await readFile(join(root,path)));assert.equal(files[path],expected);
}
for(const [file,expected] of Object.entries(challenge.files)) {
  files[file]=hash(await readFile(join(root,file)));assert.equal(files[file],expected);
}
const extra=['docs/evaluations/shared-core-protocol-v2.json','docs/evaluations/native-preprocessing-protocol.json',
  'docs/evaluations/shared-core-comparison.json','docs/evaluations/release-challenge-v1-protocol.json',
  'docs/evaluations/release-challenge-v1-results.json','docs/evaluations/release-challenge-local-scope-results.json',
  'docs/evaluations/policy-hardening-v1-protocol.json','docs/evaluations/policy-hardening-v1-results.json','docs/evaluations/policy-hardening-v1-sources.json',
  'tests/policy-hardening.test.mjs',...((await readdir(join(root,'scripts/policy-hardening-v2'))).filter(n=>n.endsWith('.mjs')).map(n=>`scripts/policy-hardening-v2/${n}`))];
for(const file of extra)files[file]=hash(await readFile(join(root,file)));
await writeFile(protocolPath,JSON.stringify({createdAt:new Date().toISOString(),node:process.version,files,beforeSources,
  changes:'Bounded prose credentials; explicit passport/tax value reconciliation under existing banking category; number + street-type address completion, including one explicitly contextual wrapped component. Extends v1 after inspecting its remaining observed failures. Cards remain other. No model, dependency, native runtime or storage change.',
  method:'Existing pair with identical pinned Node CPU assets, twice, on 262 observed regressions and 100 observed challenge cases. Same original annotations and scoring. Compare before/after complete and selected coverage, partial coverage losses, and ordinary masking. Also run actual no-pack category selections twice. All data synthetic, fetch blocked, no downloads.',
  gates:'Zero failed requests and identical repeats. Investigate every complete-value or selected-category coverage regression and added ordinary masking. Preserve the prior quality floors without claiming release selection from these observed sets.',
  limits:'This is a development improvement experiment on already observed material. Broader frozen challenge still assigns cards to banking unlike current UI. No independent final validation, deployment or resource qualification.',
},null,2)+'\n',{flag:'wx'});
console.log('Frozen policy hardening sources and original baseline evidence');

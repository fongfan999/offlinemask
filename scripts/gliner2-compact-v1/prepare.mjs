import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {hash,verify} from '../single-model-decision-v1/common.mjs';
import {verifyExecution} from '../review-first-validation-v1/common.mjs';
await verify(); await verifyExecution();
const artifact='artifacts/gliner2-compact-v1', evidence='docs/evaluations/gliner2-compact-v1';
await mkdir(evidence,{recursive:true});
const original='artifacts/quality-first-v1/cases.json';
const cases=JSON.parse(await readFile(original));
assert.equal(cases.length,398);
const inputs=cases.map((f,index)=>({index,id:f.id,corpus:f.corpus,text:f.text.normalize('NFC')}));
await writeFile(`${artifact}/inputs.json`,JSON.stringify(inputs,null,2)+'\n',{flag:'wx'});
const assets=JSON.parse(await readFile(`${artifact}/assets.json`));
for(const [file,data] of Object.entries(assets.files))assert.equal(hash(await readFile(`${artifact}/model/${file}`)),data.sha256,file);
assert.equal(hash(await readFile(`${artifact}/model/gliner_config.json`)),assets.files['config.json'].sha256);
const organizationAnnotations=cases.flatMap((f,index)=>f.entities.flatMap((e,entityIndex)=>
 e.type==='organization'||['other-org','other-organization'].includes(f.id)?[{index,entityIndex,id:f.id,value:e.value}]:[]));
const files=[original,`${artifact}/inputs.json`,`${artifact}/assets.json`,
 'scripts/gliner2-compact-v1/runner.rs','scripts/gliner2-compact-v1/prepare.mjs',
 'scripts/gliner2-compact-v1/score.mjs','scripts/pretrained-scope/common.mjs',
 'scripts/shared-core/metrics.mjs','scripts/model-comparison-metrics.mjs',
 'scripts/contextual-repair-v1/normalized-source.mjs','src/core/text.ts','src/core/unicode.ts'];
for(const f of await readdir('src/core/detection'))if(f.endsWith('.ts'))files.push(`src/core/detection/${f}`);
for(const f of await readdir(`${artifact}/upstream/crates/pii-engineer-core/src`,{recursive:true}))if(f.endsWith('.rs'))files.push(`${artifact}/upstream/crates/pii-engineer-core/src/${f}`);
files.push(`${artifact}/upstream/Cargo.lock`,`${artifact}/upstream/Cargo.toml`,`${artifact}/upstream/target/release/examples/offlinemask_eval`);
const upstreamRevision=execFileSync('git',['-C',`${artifact}/upstream`,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
const protocol={frozenAt:new Date().toISOString(),candidate:assets.repository,revision:assets.revision,assets,upstreamRevision,
 runtime:'Unmodified publisher Rust GlinerSpanModel, ort 2.0.0-rc.9, local ONNX Runtime 1.22.1, CPU 4 intra / 1 inter threads; no server/downloader during inference.',
 labels:['person_name','phone_number','government_id','street_address','date_of_birth','email_address','passport_number','license_plate','bank_account_number'],
 prompt:'Publisher default nine labels; no descriptions/boost. Publisher word splitting and lowercase preprocessing unchanged.',
 threshold:0.25,role:'Only person_name and street_address predictions feed unchanged shared rules. Other raw labels retained diagnostically. No organization predictor added.',
 windows:{maxWords:120,maxTokens:384,overlapWords:24,policy:'Shrink windows until the exact publisher prompt fits. Verify every word covered. Never permit silent 512-token truncation.'},
 sourceMapping:'Canonical NFC input; publisher UTF-8 byte spans converted to UTF-16 in harness, then restored to original graphemes by existing normalizedSource.',
 organizationAnnotations,
 evaluation:'398 executions; owner12 overlay excluded from ranked 386. Keep original full-scope scores and separate retained-scope entity metrics; exclude organization spans from retained sensitive-character totals, never count them as ordinary text. Keep original negative-case definitions. Report organization category leaks separately.',
 gates:'Existing per-category full/own floors (name/address/other 95%, email/phone/banking 99%), overall full95%, short ordinary excess<=1%, at most1 original negative changed per stage, zero errors. No quality tuning on results.',
 comparators:['underthesea','underthesea+large','underthesea+bigmed+large'],
 limits:'Already observed synthetic selection data; not a fresh holdout, training, field accuracy, or packaged-app qualification.',
 files:Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(f))])))};
await writeFile(`${evidence}/protocol.json`,JSON.stringify(protocol,null,2)+'\n',{flag:'wx'});
console.log('Frozen',cases.length,'executions;',organizationAnnotations.length,'organization annotations kept separate.');

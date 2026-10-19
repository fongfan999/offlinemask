import {readFile,writeFile,readdir} from 'node:fs/promises';
import {hash,verify} from '../single-model-decision-v1/common.mjs';
import {verifyExecution} from '../review-first-validation-v1/common.mjs';
await verify();await verifyExecution();
const previous=JSON.parse(await readFile('docs/evaluations/pretrained-search-v1/protocol.json'));
for(const [f,digest]of Object.entries(previous.files))if(hash(await readFile(f))!==digest)throw Error(`Changed frozen input: ${f}`);
const cases=JSON.parse(await readFile('artifacts/pretrained-search-v1/cases.json'));
await writeFile('artifacts/quality-first-v1/cases.json',JSON.stringify(cases,null,2)+'\n',{flag:'wx'});
const files=['artifacts/quality-first-v1/cases.json','scripts/quality-first-v1/prepare.mjs',
 'scripts/quality-first-v1/evaluate.mjs','scripts/quality-first-v1/compare.mjs',
 'scripts/shared-core/candidates.mjs','scripts/shared-core/reference-offsets.mjs','scripts/shared-core/native-offsets.py',
 'scripts/native-preprocessing/provider.mjs','scripts/native-preprocessing/tokenizer.mjs','scripts/native-preprocessing/tokenizer-server.py',
 'scripts/contextual-repair-v1/provider.mjs','scripts/contextual-repair-v1/normalized-source.mjs',
 'scripts/pretrained-scope/common.mjs','scripts/shared-core/metrics.mjs','scripts/model-comparison-metrics.mjs',
 'docs/evaluations/shared-core-protocol-v2.json','docs/evaluations/pretrained-search-v1/compatible/results.json'];
for(const f of await readdir('src/core/detection'))if(f.endsWith('.ts'))files.push(`src/core/detection/${f}`);
const p={frozenAt:new Date().toISOString(),variants:['underthesea','bigmed','small','large'],
 definitions:{small:'OpenMed SuperClinical INT8',large:'OpenMed mSuperClinical INT8',underthesea:'Underthesea INT8',bigmed:'OpenMed BigMed INT8'},
 recipes:'All 15 nonempty subsets of four independently executed checkpoints, with all supported model findings or contextual TEN/DIA_CHI/TO_CHUC findings only. Existing shared policy applied once after union. No case-specific routing or thresholds.',
 ranking:'Pass unchanged regression/challenge/approved24 floors first; then complete own-category values across 386 records (500 values), descending; ordinary lexical masking ascending; fewer checkpoints; smaller asset bytes. Report all type/case results and failures. Owner12 overlay excluded from ranking.',
 limits:'Observed synthetic selection data; no new holdout or banking accuracy claim. Best available does not imply release requirements met.',
 files:Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(f))])))};
await writeFile('docs/evaluations/quality-first-v1/protocol.json',JSON.stringify(p,null,2)+'\n',{flag:'wx'});
console.log('Frozen quality-first comparison: 4 checkpoints, 30 policies, unchanged 398 case executions per checkpoint.');

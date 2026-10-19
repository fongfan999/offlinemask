import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {root,directory,output,hash,verifyApproved,approvalFiles} from './common.mjs';
const cases=await verifyApproved(),files={};
const paths=['scripts/review-first-validation-v1/common.mjs','scripts/review-first-validation-v1/freeze-execution.mjs',
 'scripts/review-first-validation-v1/evaluate.mjs','scripts/review-first-validation-v1/report.mjs',
 'docs/evaluations/single-model-decision-v1/results.json',
 ...approvalFiles.map(f=>`docs/evaluations/review-first-validation-v1/approvals/${f}`),
 ...['spec.md','cases.json','protocol.json'].map(f=>`docs/evaluations/review-first-validation-v1/${f}`)];
for(const path of paths)files[path]=hash(await readFile(join(root,path)));
await mkdir(output,{recursive:true});
await writeFile(join(directory,'execution-protocol.json'),JSON.stringify({createdAt:new Date().toISOString(),cases:cases.length,files,
 variants:['underthesea','bigmed'],method:'Existing pinned adapters; canonical NFC inference copy; source restoration; unchanged shared policy; full and each six-category preview. No threshold/weight/policy changes.',
 approvalStatus:'All 24 confirmed before inference',priorReleaseDecision:'REJECT_BOTH_FOR_RELEASE; new batch supplements, never replaces prior evidence.'},null,2)+'\n',{flag:'wx'});
console.log('Execution frozen after all approvals and before inference.');

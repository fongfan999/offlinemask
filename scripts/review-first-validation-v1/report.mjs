import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,directory,output,hash,readJson,verifyExecution} from './common.mjs';
import {summarizeStage} from '../shared-core/metrics.mjs';
const {cases,protocol}=await verifyExecution(),results={},rawHashes={};
for(const variant of protocol.variants){
 const bytes=await readFile(join(output,`${variant}.json`)),run=JSON.parse(bytes);rawHashes[variant]=hash(bytes);
 assert.deepEqual(run.protocol,protocol);assert.equal(run.cases.length,cases.length);
 for(const[i,f]of cases.entries())assert.equal(f.id,run.cases[i].id);
 const rows=run.cases.map(c=>c.result),summary=summarizeStage(rows);
 const types=[...new Set(cases.flatMap(c=>c.entities.map(e=>e.type)))];
 const byType=Object.fromEntries(types.map(type=>{
  const es=rows.flatMap(c=>c.entities.filter(e=>e.type===type));
  return[type,{total:es.length,full:es.filter(e=>e.full).length,selectedFull:es.filter(e=>e.selectedFull).length}];
 }));
 const outcomes=run.cases.map((c,i)=>({...c,text:cases[i].text,
  matchesReviewedExpectation:!c.result.error&&c.result.entities.every(e=>e.selectedFull)&&c.result.falsePositiveChars===0,
  incompleteOwnCategory:c.result.entities.filter(e=>!e.selectedFull),extraOrdinary:c.result.falsePositives}));
 results[variant]={...summary,byType,matchingCases:outcomes.filter(c=>c.matchesReviewedExpectation).map(c=>c.number),outcomes};
}
const previous=await readJson(join(root,'docs/evaluations/single-model-decision-v1/results.json'));
const result={reportedAt:new Date().toISOString(),protocolSha256:hash(await readFile(join(directory,'execution-protocol.json'))),rawHashes,results,
 previousReleaseDecision:previous.releaseDecision,releaseDecision:'REJECT_BOTH_FOR_RELEASE',
 limits:'New assistant-authored targeted examples, owner-reviewed before model execution; not independently sourced or representative. Small denominators. Historical release failures remain binding. No tuning on this batch.'};
await writeFile(join(directory,'results.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
for(const[v,r]of Object.entries(results))console.log(v,JSON.stringify({full:r.summary.fullyCovered,total:r.summary.entities,
 selected:Object.values(r.summary.byCategory).reduce((n,c)=>n+c.selectedFull,0),ordinary:r.summary.falsePositiveChars,
 negativeFalsePositiveCases:r.summary.falsePositiveNegativeCases,matchingCases:r.matchingCases,screening:r.screeningPass,
 byType:r.byType,errors:r.summary.failedCases}));
const lines=['# Kết quả 24 ví dụ đã duyệt\n','Kỳ vọng được bạn duyệt trước khi chạy mô hình. Không sửa luật, ngưỡng hoặc trọng số sau khi xem kết quả. A = Underthesea; B = BigMed.\n'];
const describe=r=>r.predictions.length?r.predictions.map(p=>`- ${JSON.stringify(p.value)} → ${p.findingId.split('_').slice(0,-1).join('_')}`).join('\n'):'Không ẩn mục nào.';
for(const[i,f]of cases.entries()){
 lines.push(`## ${f.number}\n\n\`\`\`text\n${f.text}\n\`\`\`\n\n**Kỳ vọng đã duyệt**\n\n${f.entities.length?f.entities.map(e=>`- ${JSON.stringify(e.value)} — ${e.type}`).join('\n'):'Giữ nguyên toàn bộ.'}\n`);
 for(const[label,v]of Object.entries({A:'underthesea',B:'bigmed'})){
  const c=results[v].outcomes[i];lines.push(`**${label} · ${c.matchesReviewedExpectation?'Khớp kỳ vọng':'Chưa đạt'}**\n\n${describe(c.result)}\n`);
 }
}
await writeFile(join(directory,'comparison.md'),lines.join('\n'),{flag:'wx'});

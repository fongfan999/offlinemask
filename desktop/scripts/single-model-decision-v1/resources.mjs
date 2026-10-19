import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
import {root,output,readJson,hash} from './common.mjs';
import {verifyAssets} from '../shared-core/evidence.mjs';
import {startNativeTokenizer,prepareNativePlans} from '../native-preprocessing/tokenizer.mjs';
import {predictNative,sourceTokens} from '../native-preprocessing/provider.mjs';
import {createModelRunner} from '../../src/core/detection/model-runner.ts';
import {applyDetectionPolicy} from '../../src/core/detection/policy.ts';
import {normalizedSource} from '../contextual-repair-v1/normalized-source.mjs';
import {score,assertReplay} from '../pretrained-scope/common.mjs';
const protocol=await readJson(join(root,'docs/evaluations/single-model-decision-v1/resources-protocol.json'));
for(const[file,digest]of Object.entries(protocol.files))assert.equal(hash(await readFile(join(root,file))),digest,file);
const runId=process.argv[2];assert.ok(['1','2'].includes(runId));
const variant=protocol.variant;assert.equal(variant,'underthesea');
await verifyAssets(await readJson(join(root,'docs/evaluations/shared-core-protocol-v2.json')),variant);
globalThis.fetch=async()=>{throw Error('Network forbidden in resource probe');};
const directory=join(root,'artifacts/alternative-models',variant);
const ort=createRequire(import.meta.resolve('@huggingface/transformers'))('onnxruntime-node');
const labels=(await readJson(join(directory,'config.json'))).id2label;
const initializationStart=performance.now();
const tokenizer=startNativeTokenizer(process.env.OFFLINEMASK_EVAL_PYTHON,join(directory,'tokenizer.json'));
let session;
try{
 session=await ort.InferenceSession.create(join(directory,'model_int8.onnx'),{executionProviders:['cpu']});
 const initializationMs=performance.now()-initializationStart;
 const request=async(text)=>{
  const start=performance.now(),mapped=normalizedSource(text);
  const plans=await prepareNativePlans([mapped.text],value=>tokenizer.encode(value));
  const runner=createModelRunner([{
   source:'Evaluation · underthesea',tokenCount:plans.count,
   async predict(value){
    const tokens=await predictNative(session,ort,plans.encoding(value),labels);
    const aliases={PER:'PERSON',LOC:'LOCATION',ORG:'ORGANIZATION'};
    return tokens.map(t=>{const[prefix,label]=t.entity.split('-');return{...t,entity:aliases[label]?`${prefix}-${aliases[label]}`:'O'};});
   },
   align:(value,tokens)=>sourceTokens(value,tokens,plans.encoding(value).offsets),dispose:async()=>{},
  }]);
  const inspected=await runner.inspect(mapped.text);
  const detections=applyDetectionPolicy(text,mapped.restore(inspected.modelOnly)).complete;
  const scored=score({id:'resource',group:'resource',text,entities:[]},detections);
  return {durationMs:performance.now()-start,utf16Length:text.length,tokenizerQueries:plans.cachedQueries,scored,detections};
 };
 const workload=(length,index)=>{
  const head=`Yêu cầu thử nghiệm ${index}: Khách hàng Trần Minh Bình nhận thư tại 36 Nguyễn Trãi, Thanh Xuân, Hà Nội. Email synthetic${index}@example.org. `;
  const filler='Nội dung tổng hợp đã được kiểm tra. ';
  return head+filler.repeat(Math.ceil((length-head.length)/filler.length)).slice(0,length-head.length);
 };
 const rows=[];
 for(const[label,length,index]of [['cold',2000,0],...Array.from({length:10},(_,i)=>[`warm-${i+1}`,2000,i+1]),['long',50000,99]]){
  const r=await request(workload(length,index));
  rows.push({label,durationMs:r.durationMs,utf16Length:r.utf16Length,tokenizerQueries:r.tokenizerQueries,findings:r.scored.predictions.length});
  console.log(label,Math.round(r.durationMs),'ms');
 }
 const probes=await readJson(join(output,'resource-parity.json'));
 for(const f of probes){const r=await request(f.text);assertReplay(score(f,r.detections),f.expected,`Native resource parity ${f.id}`);}
 const warm=rows.filter(r=>r.label.startsWith('warm')).map(r=>r.durationMs).sort((a,b)=>a-b);
 const coldMs=initializationMs+rows[0].durationMs,warmP95Ms=warm[Math.ceil(warm.length*.95)-1],longMs=rows.at(-1).durationMs;
 await writeFile(join(output,`resources-${runId}.json`),JSON.stringify({runId,variant,node:process.version,initializationMs,coldMs,warmP95Ms,longMs,rows,
  parityCases:probes.length,protocol,timingTargets:{cold:coldMs<=5000,warm:warmP95Ms<=300,long:longMs<=8000},
  limits:'Node/native-tokenizer developer process; includes online tokenization and IPC. Cold excludes process/import startup and hashes. Not packaged Tauri or WebKit.'},null,2)+'\n',{flag:'wx'});
 console.log('parity passed',probes.length);
}finally{await tokenizer.dispose();await session?.release();}

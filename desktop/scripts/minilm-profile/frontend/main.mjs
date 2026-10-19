import { invoke } from '@tauri-apps/api/core';
import fixtures from '../../../artifacts/minilm-profile/fixtures.json';
import { cachedWindows } from '../windows.mjs';
import { createNativeTokenizer } from '../../minilm-desktop/native-client.mjs';
const status=document.querySelector('#status'),metrics=[];
let id=0,graphId=0,phase=0,delay=0,last=performance.now();
const timer=setInterval(()=>{const now=performance.now();delay=Math.max(delay,now-last-50);last=now;},50);
const metric=(kind,durationMs=0,count=1,maxError=0,passed=true)=>metrics.push({kind,durationMs,count,maxError,passed});
function changePhase(next){metric('phase_heartbeat',delay,phase);phase=next;delay=0;last=performance.now();}
const assert=value=>{if(!value)throw Error('Diagnostic assertion');};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const native=createNativeTokenizer(invoke,()=>++id);
const encode=text=>native.encode(text,false);
async function infer(e,expected){
 const r=await invoke('minilm_native_run',{id:++graphId,ids:e.ids,diagnosticLogits:!!expected});
 let errors=0,maxError=0;
 if(expected){assert(r.logits.length===expected.length);for(let i=0;i<expected.length;i++){
   const delta=Math.abs(r.logits[i]-expected[i]);maxError=Math.max(maxError,delta);
   if(!Number.isFinite(r.logits[i])||delta>1e-4+1e-4*Math.abs(expected[i]))errors++;
 }}
 return {errors,maxError,kernel:r.kernel_ms};
}
// Same planner, with caching disabled as the instrumented one-thread control.
async function* controlWindows(text,encode,stats){
 const boundary=[];for(const {index} of new Intl.Segmenter('vi',{granularity:'grapheme'}).segment(text))boundary.push(index);boundary.push(text.length);
 function at(offset,up){let lo=0,hi=boundary.length-1;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(boundary[mid]<offset)lo=mid+1;else hi=mid;}return boundary[!up&&boundary[lo]>offset?lo-1:lo];}
 const run=async t=>{stats.calls++;return encode(t);};let start=0;
 while(start<text.length){let end=Math.min(start+1200,text.length);
  if((await run(text.slice(start,end))).ids.length>384){let low=start+1,high=end;while(low<high){const mid=Math.ceil((low+high)/2);if((await run(text.slice(start,mid))).ids.length<=384)low=mid;else high=mid-1;}end=low;}
  if(end<text.length){const b=text.lastIndexOf(' ',end);if(b>start+(end-start)/2)end=b;}
  end=at(end,false);assert(end>start);const encoding=await run(text.slice(start,end));assert(encoding.ids.length<=384);
  yield{start,text:text.slice(start,end),encoding};if(end===text.length)break;
  let next=Math.max(start+1,end-96);const b=text.indexOf(' ',next);if(b>=0&&b<end-32)next=b+1;start=at(next,true);
 }
}
const seed='Khách hàng Nguyễn Minh An, email synthetic@example.org. Nội dung tổng hợp đã được kiểm tra. ';
const make=n=>seed.repeat(Math.ceil(n/seed.length)).slice(0,n);
const baseline=new Map();
async function runText(text,cached,reference){
 const start=performance.now(),stats={calls:0,hits:0,peak:0};let end=0,tokenize=0,encodeWall=0,kernel=0,inferenceWall=0,count=0;
 const signature=[];
 const tracked=async t=>{const s=performance.now(),e=await encode(t);encodeWall+=performance.now()-s;tokenize+=e.nativeMs;return e;};
 for await(const w of (cached?cachedWindows:controlWindows)(text,tracked,stats)){
  assert(w.start<=end);end=w.start+w.text.length;
  const sig={start:w.start,end,ids:w.encoding.ids,offsets:w.encoding.offsets,maskOffsets:w.encoding.maskOffsets};
  if(reference)assert(same(sig,reference[count]));signature.push(sig);
  for(const span of w.encoding.maskOffsets.filter(Boolean))assert(text.slice(w.start+span[0],w.start+span[1])===w.text.slice(...span));
  const s=performance.now(),r=await infer(w.encoding);inferenceWall+=performance.now()-s;kernel+=r.kernel;count++;
 }
 assert(end===text.length);if(reference)assert(count===reference.length);
 return{wall:performance.now()-start,tokenize,encodeWall,kernel,inferenceWall,count,stats,signature};
}
async function parity(variant){let errors=0,maxError=0;for(const f of fixtures){const e=await encode(f.text);assert(same(e.ids,f.ids));const r=await infer(e,f.logits.flat(2));errors+=r.errors;maxError=Math.max(maxError,r.maxError);}metric('parity',0,variant,maxError,errors===0);}
async function measure(variant,cached){
 metric('thread_variant',0,variant);changePhase(variant);status.textContent=`Measuring variant ${variant}…`;
 const rows=[];
 for(let i=0;i<10;i++){const r=await runText(make(2000),cached,baseline.get(2000));if(!baseline.has(2000))baseline.set(2000,r.signature);metric('warm',r.wall,variant);rows.push(r);}
 const long=await runText(make(50000),cached,baseline.get(50000));if(!baseline.has(50000))baseline.set(50000,long.signature);metric('long',long.wall,variant);rows.push(long);
 for(const [name,key]of[['tokenize','tokenize'],['encode_wall','encodeWall'],['kernel','kernel'],['inference_wall','inferenceWall']])metric(name,rows.reduce((s,r)=>s+r[key],0),variant);
 metric('planning',rows.reduce((s,r)=>s+Math.max(0,r.wall-r.encodeWall-r.inferenceWall),0),variant);
 metric('cache',rows.reduce((s,r)=>s+r.stats.hits,0),variant,rows.reduce((s,r)=>s+r.stats.calls,0));
 metric('window_parity',0,variant);return rows.reduce((s,r)=>s+r.kernel,0)/rows.reduce((s,r)=>s+r.wall,0);
}
let completed=false;
try{
 status.textContent='Loading local tokenizer and graph…';const cold=performance.now();await encode('Kiểm tra');await invoke('minilm_native_load',{threads:1});await infer(await encode('Kiểm tra'));metric('cold',performance.now()-cold);
 changePhase(10);await parity(100);
 await measure(100,false);const share=await measure(101,true);
 if(share>.5){changePhase(20);await invoke('minilm_native_load',{threads:2});await parity(201);await measure(201,true);}
 changePhase(30);status.textContent='Checking active versus completed cancellation…';
 let activePass=false,completedBeforeCancel=0;
 for(let attempt=0;attempt<5&&!activePass;attempt++){
  const requestId=++id;let settled=false;
  const pending=invoke('minilm_encode',{id:requestId,text:'Nguyễn '.repeat(5500),inference:false}).then(()=>{settled=true;return 'completed';},e=>{settled=true;return e;});
  let active=false;for(let i=0;i<100&&!settled;i++){active=await invoke('minilm_active',{id:requestId});if(active)break;await new Promise(r=>setTimeout(r,1));}
  const s=performance.now(),ack=active?await invoke('minilm_cancel',{id:requestId}):false,ackTime=performance.now()-s,outcome=await pending;
  if(active&&ack){activePass=outcome==='cancelled'&&await invoke('minilm_idle');metric('cancel_ack',ackTime,attempt,0,activePass);metric('cancel_drain',performance.now()-s,attempt,0,activePass);}
  else{assert(outcome==='completed');completedBeforeCancel++;}
 }
 metric('cancellation_completed',0,completedBeforeCancel);if(!activePass)metric('cancel_drain',0,0,0,false);
 await encode('Kiểm tra');metric('recovery');
 // Independent late-cancel result suppression through the actual app adapter.
 const late=native.encode('short',true).then(()=>false,e=>e.name==='AbortError');await native.cancel();assert(await late);metric('stale');
 const encoding=await encode(seed.repeat(8)),runId=++graphId;let settled=false;
 const pending=invoke('minilm_native_run',{id:runId,ids:encoding.ids,diagnosticLogits:false}).then(()=>{settled=true;return false;},e=>{settled=true;return e==='cancelled';});
 let running=false;for(let i=0;i<100&&!settled;i++){running=await invoke('minilm_native_running',{id:runId});if(running)break;await new Promise(r=>setTimeout(r,1));}
 const s=performance.now(),ack=await invoke('minilm_native_cancel',{id:runId});metric('worker_cancel',performance.now()-s,1,0,running&&ack&&await pending); // completion timing corrected below
 metrics[metrics.length-1].durationMs=performance.now()-s;
 await infer(await encode('Kiểm tra'));metric('recovery');
 metric('network',0,1,0,await fetch('https://example.invalid/offlinemask-probe').then(()=>false,()=>true));completed=true;
}catch{status.textContent='Probe failed';}
finally{changePhase(99);clearInterval(timer);baseline.clear();await invoke('minilm_finish',{report:{completed,metrics}});}

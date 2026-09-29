import {invoke} from '@tauri-apps/api/core';
import fixtures from '../../../artifacts/minilm-focus/fixtures.json';
import {cachedWindows} from '../../minilm-profile/windows.mjs';
const metrics=[],metric=(kind,durationMs=0,count=1,maxError=0,passed=true)=>metrics.push({kind,durationMs,count,maxError,passed});
let id=0,runId=0;
const assert=b=>{if(!b)throw Error();};
const encode=text=>invoke('minilm_encode',{id:++id,text,inference:false});
const infer=e=>invoke('minilm_native_run',{id:++runId,ids:e.ids,diagnosticLogits:false});
const seed='Khách hàng Nguyễn Minh An, email synthetic@example.org. Nội dung tổng hợp đã được kiểm tra. ';
const make=n=>seed.repeat(Math.ceil(n/seed.length)).slice(0,n);
async function process(text){const s=performance.now();let end=0,count=0;
 for await(const w of cachedWindows(text,encode,{hits:0,calls:0,peak:0})){assert(w.start<=end);end=w.start+w.text.length;await infer(w.encoding);count++;}
 assert(end===text.length);return{ms:performance.now()-s,count};
}
document.querySelector('#run').onclick=async()=>{
 document.querySelector('#run').disabled=true;
 const status=document.querySelector('#status');let completed=false,losses=0,ticks=0,frames=0,maxTimer=0,maxFrame=0,last=performance.now(),lastFrame=last,frameId;
 const focused=()=>document.hasFocus()&&document.visibilityState==='visible';
 const lost=()=>{losses++;};window.addEventListener('blur',lost);document.addEventListener('visibilitychange',()=>{if(document.hidden)losses++;});
 assert(focused());
 const timer=setInterval(()=>{const now=performance.now();if(focused()){maxTimer=Math.max(maxTimer,now-last-50);ticks++;}last=now;},50);
 function frame(now){if(focused()){maxFrame=Math.max(maxFrame,now-lastFrame);frames++;}lastFrame=now;frameId=requestAnimationFrame(frame);}frameId=requestAnimationFrame(frame);
 try{
  status.textContent='Loading local tokenizer and graph…';const cold=performance.now();await encode('Kiểm tra');await invoke('minilm_native_load',{threads:2});await infer(await encode('Kiểm tra'));metric('cold',performance.now()-cold);
  status.textContent='Checking CPU reference…';let errors=0,maxError=0;
  for(const f of fixtures){const e=await encode(f.text);assert(JSON.stringify(e.ids)===JSON.stringify(f.ids));const r=await invoke('minilm_native_run',{id:++runId,ids:e.ids,diagnosticLogits:true}),expected=f.logits.flat(2);assert(r.logits.length===expected.length);
   for(let i=0;i<expected.length;i++){const delta=Math.abs(r.logits[i]-expected[i]);maxError=Math.max(maxError,delta);if(!Number.isFinite(r.logits[i])||delta>1e-4+1e-4*Math.abs(expected[i]))errors++;}}
  metric('parity',0,20,maxError,errors===0);
  status.textContent='Measuring short documents…';for(let i=0;i<10;i++){const r=await process(make(2000));metric('warm',r.ms,r.count);}
  status.textContent='Measuring 50,000 characters…';const r=await process(make(50000));metric('long',r.ms,r.count);
  completed=true;status.textContent='Completed';
 }catch{status.textContent='Probe failed';}
 finally{clearInterval(timer);cancelAnimationFrame(frameId);metric('heartbeat',maxTimer,ticks,losses,losses===0&&focused());metric('phase_heartbeat',maxFrame,frames,losses,losses===0&&focused());await invoke('minilm_finish',{report:{completed,metrics}});}
};

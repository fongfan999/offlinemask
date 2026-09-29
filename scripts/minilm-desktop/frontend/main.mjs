import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import fixtures from '../../../artifacts/minilm-desktop/fixtures.json';
import { createNativeTokenizer } from '../native-client.mjs';
const status=document.querySelector('#status'),metrics=[];
let id=0,worker,workerReject,heartbeatDelay=0,last=performance.now();
const beat=setInterval(()=>{const now=performance.now();heartbeatDelay=Math.max(heartbeatDelay,now-last-50);last=now;},50);
const metric=(kind,durationMs=0,count=1,maxError=0,passed=true)=>metrics.push({kind,durationMs,count,maxError,passed});
const assert=value=>{if(!value)throw Error('Diagnostic assertion');};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const nativeClient=createNativeTokenizer(invoke,()=>++id);
const encode=(text,inference=true)=>nativeClient.encode(text,inference);
function callWorker(data) {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{worker?.terminate();reject(Error('Worker timeout'));},60000);
    workerReject=()=>{clearTimeout(timer);reject(Error('cancelled'));};
    worker.onmessage=({data})=>{clearTimeout(timer);workerReject=undefined;data.type==='error'?reject(Error('Worker failure')):resolve(data);};
    worker.onerror=event=>{event.preventDefault();clearTimeout(timer);workerReject=undefined;reject(Error('Worker failure'));};
    worker.postMessage(data);
  });
}
async function loadWorker(url) {
  worker=new Worker(new URL('./inference.worker.mjs',import.meta.url),{type:'module'});
  await callWorker({type:'load',url});
}
function stopWorker(){worker?.terminate();worker=undefined;workerReject?.();workerReject=undefined;}
async function* windows(text) {
  const boundaries=[...new Intl.Segmenter('vi',{granularity:'grapheme'}).segment(text)].map(s=>s.index);boundaries.push(text.length);
  function boundaryAt(offset,up) {
    let low=0,high=boundaries.length-1;
    while(low<high){const mid=Math.floor((low+high)/2);if(boundaries[mid]<offset)low=mid+1;else high=mid;}
    return boundaries[!up&&boundaries[low]>offset?low-1:low];
  }
  let start=0;
  while(start<text.length) {
    let end=Math.min(start+1200,text.length);
    if((await encode(text.slice(start,end),false)).ids.length>384) {
      let low=start+1,high=end;
      while(low<high){const mid=Math.ceil((low+high)/2);if((await encode(text.slice(start,mid),false)).ids.length<=384)low=mid;else high=mid-1;}end=low;
    }
    if(end<text.length){const at=text.lastIndexOf(' ',end);if(at>start+(end-start)/2)end=at;}
    end=boundaryAt(end,false);assert(end>start);
    yield {start,text:text.slice(start,end),encoding:await encode(text.slice(start,end))};
    if(end===text.length)break;
    let next=Math.max(start+1,end-96);const at=text.indexOf(' ',next);if(at>=0&&at<end-32)next=at+1;
    start=boundaryAt(next,true);
  }
}
async function runText(text) {
  const start=performance.now();let end=0,count=0;
  for await(const w of windows(text)) {
    assert(w.start<=end);end=w.start+w.text.length;
    for(const span of w.encoding.maskOffsets.filter(Boolean)) {
      assert(same(text.slice(w.start+span[0],w.start+span[1]),w.text.slice(...span)));
      assert(span[0]<span[1]&&span[1]<=w.text.length);
    }
    await callWorker({type:'run',encoding:w.encoding});count++;
  }
  assert(end===text.length);return{duration:performance.now()-start,count};
}
let completed=false;
try {
  status.textContent='Loading local native tokenizer and graph…';
  const cold=performance.now();
  const graph=await invoke('minilm_graph');const url=convertFileSrc(graph);
  await encode('Kiểm tra');await loadWorker(url);
  await callWorker({type:'run',encoding:await encode('Kiểm tra')});
  metric('cold',performance.now()-cold);
  status.textContent='Checking packaged WebKit outputs…';
  let maxError=0,errors=0;
  for(const r of fixtures) {
    const e=await encode(r.text);assert(same(e.ids,r.ids));
    const result=await callWorker({type:'run',encoding:e,expected:r.logits.flat(2)});
    maxError=Math.max(maxError,result.maxError);errors+=result.errors;
  }
  metric('parity',0,fixtures.length,maxError,errors===0);
  const e=await encode('Nguyễn / Nguyễn');
  assert(same(e.maskOffsets.filter(s=>s&&s[1]-s[0]>=8),[[0,8],[11,19]]));
  assert(same((await encode('A\r\nB')).maskOffsets.filter(Boolean),[[0,1],[3,4]]));
  metric('boundaries',0,2);
  status.textContent='Checking native cancellation and recovery…';
  const cancelId=++id;
  const pending=invoke('minilm_encode',{id:cancelId,text:'Nguyễn '.repeat(7100),inference:false}).then(()=>false,e=>e==='cancelled');
  // Commands are issued in order; inspect active state before testing overlap.
  const busy=invoke('minilm_encode',{id:++id,text:'Kiểm tra',inference:true}).then(()=>false,e=>e==='busy');
  const cancelStart=performance.now();const acknowledged=await invoke('minilm_cancel',{id:cancelId});
  metric('cancel_ack',performance.now()-cancelStart,1,0,acknowledged);
  const cancelled=await pending;metric('cancel_drain',performance.now()-cancelStart,1,0,cancelled&&await invoke('minilm_idle'));
  metric('busy',0,1,0,await busy);
  const stale=await invoke('minilm_encode',{id:cancelId,text:'Kiểm tra',inference:true}).then(()=>false,e=>e==='stale');metric('stale',0,1,0,stale);
  await encode('Kiểm tra');metric('recovery');
  status.textContent='Measuring synthetic documents…';
  const seed='Khách hàng Nguyễn Minh An, email synthetic@example.org. Nội dung tổng hợp đã được kiểm tra. ';
  const make=n=>seed.repeat(Math.ceil(n/seed.length)).slice(0,n);
  for(let i=0;i<10;i++){const r=await runText(make(2000));metric('warm',r.duration,r.count);}
  const long=await runText(make(50000));metric('long',long.duration,long.count);
  status.textContent='Checking worker cancellation…';
  const encoding=await encode(seed.repeat(8));
  const work=callWorker({type:'run',encoding}).then(()=>false,()=>true);
  const stop=performance.now();stopWorker();assert(await work);metric('worker_cancel',performance.now()-stop);
  await loadWorker(url);await callWorker({type:'run',encoding:await encode('Kiểm tra')});metric('recovery');
  // The OS launch profile independently denies all networking; CSP also rejects
  // remote fetch here. This probe alone is not the OS-network proof.
  const denied=await fetch('https://example.invalid/offlinemask-probe').then(()=>false,()=>true);metric('network',0,1,0,denied);
  completed=true;status.textContent='Completed';
}catch{status.textContent='Probe failed';}
finally{
  stopWorker();clearInterval(beat);metric('heartbeat',heartbeatDelay);
  await invoke('minilm_finish',{report:{completed,metrics}});
}

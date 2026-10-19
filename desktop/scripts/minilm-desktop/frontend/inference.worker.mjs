import * as ort from 'ort-local';
ort.env.wasm.numThreads=1;
ort.env.wasm.proxy=false;
ort.env.wasm.wasmPaths={mjs:new URL('/runtime/ort-wasm-simd-threaded.asyncify.mjs',self.location.href).href,wasm:new URL('/runtime/ort-wasm-simd-threaded.asyncify.wasm',self.location.href).href};
let session;
onmessage=async({data})=>{
  try {
    if(data.type==='load') {
      const bytes=new Uint8Array(await (await fetch(data.url)).arrayBuffer());
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
      if(hash!=='498e24d4efea4ecca4dbdedfa8356f56de89e24815196da14cb4474ef27de0c8')throw Error();
      session=await ort.InferenceSession.create(bytes,{executionProviders:['wasm']});
      postMessage({type:'ready'});return;
    }
    const {encoding:e,expected}=data;
    const inputs=Object.fromEntries([['input_ids',e.ids],['attention_mask',e.attentionMask],['token_type_ids',e.typeIds]].map(([name,values])=>[name,new ort.Tensor('int64',BigInt64Array.from(values,BigInt),[1,values.length])]));
    let outputs;
    try {
      outputs=await session.run(inputs);
      let errors=0,maxError=0;
      if(outputs.logits.dims[1]!==e.ids.length||outputs.logits.dims[2]!==39)throw Error();
      if(expected)for(let i=0;i<expected.length;i++) {
        const d=Math.abs(outputs.logits.data[i]-expected[i]);maxError=Math.max(maxError,d);
        if(!Number.isFinite(outputs.logits.data[i])||d>1e-4+1e-4*Math.abs(expected[i]))errors++;
      }
      postMessage({type:'result',errors,maxError});
    }finally{for(const t of [...Object.values(inputs),...Object.values(outputs??{})])t.dispose();}
  }catch{postMessage({type:'error'});}
};

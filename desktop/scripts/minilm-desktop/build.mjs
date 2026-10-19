import { build } from 'vite';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const root=new URL('../../',import.meta.url).pathname, work=root+'artifacts/minilm-desktop/';
const require=createRequire(import.meta.resolve('@huggingface/transformers'));
const ort=dirname(require.resolve('onnxruntime-web'));
const identifier='dev.offlinemask.minilm.desktop20260918';
const dataRoot=join(homedir(),'Library/Application Support',identifier);
await mkdir(dataRoot+'/models/minilm-prototype',{recursive:true});
for(const [source,name,sha] of [
  ['artifacts/minilm-admission/pack/tokenizer.json','tokenizer.json','b74659c780d49afad7a7b9799868f75cbd3014fb6c34956e85a793028d38094a'],
  ['artifacts/minilm-repair/model-gather.onnx','model-gather.onnx','498e24d4efea4ecca4dbdedfa8356f56de89e24815196da14cb4474ef27de0c8']]) {
  const bytes=await readFile(root+source);
  if(createHash('sha256').update(bytes).digest('hex')!==sha)throw Error('Changed prototype asset');
  await writeFile(dataRoot+'/models/minilm-prototype/'+name,bytes);
}
const fixtures=JSON.parse(await readFile(root+'artifacts/minilm-native/runtime-reference.json'));
// Embed synthetic reference only; no live input or prior sessions are read.
await writeFile(work+'fixtures.json',JSON.stringify(fixtures));
await build({configFile:false,root:root+'scripts/minilm-desktop/frontend',resolve:{alias:{'ort-local':join(ort,'ort.wasm.min.mjs')}},worker:{format:'es'},build:{outDir:work+'frontend',emptyOutDir:true,copyPublicDir:false}});
await mkdir(work+'frontend/runtime',{recursive:true});
for(const name of ['ort-wasm-simd-threaded.asyncify.mjs','ort-wasm-simd-threaded.asyncify.wasm'])await cp(join(ort,name),work+'frontend/runtime/'+name);
const config={productName:'OfflineMask MiniLM Probe',identifier,build:{beforeBuildCommand:'',frontendDist:work+'frontend'},app:{windows:[{label:'main',title:'OfflineMask MiniLM integration probe',width:900,height:600}]},bundle:{targets:['app']}};
await writeFile(work+'tauri.conf.json',JSON.stringify(config,null,2));
await writeFile(work+'paths.json',JSON.stringify({identifier,dataRoot},null,2));
console.log('Prepared isolated frontend and checksum-verified test assets.');

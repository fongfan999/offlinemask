import { build } from 'vite';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const root=new URL('../../',import.meta.url).pathname, work=root+'artifacts/minilm-profile/';
const require=createRequire(import.meta.resolve('@huggingface/transformers'));
const ort=dirname(require.resolve('onnxruntime-web'));
const identifier='dev.offlinemask.minilm.profile20260918';
const dataRoot=join(homedir(),'Library/Application Support',identifier);
await mkdir(dataRoot+'/models/minilm-prototype',{recursive:true});
for(const [source,name,sha] of [
  ['artifacts/minilm-admission/pack/tokenizer.json','tokenizer.json','b74659c780d49afad7a7b9799868f75cbd3014fb6c34956e85a793028d38094a'],
  ['artifacts/minilm-repair/model-gather.onnx','model-gather.onnx','498e24d4efea4ecca4dbdedfa8356f56de89e24815196da14cb4474ef27de0c8']]) {
  const bytes=await readFile(root+source);
  if(createHash('sha256').update(bytes).digest('hex')!==sha)throw Error('Changed prototype asset');
  await writeFile(dataRoot+'/models/minilm-prototype/'+name,bytes);
}
const runtime=join(dirname(require.resolve('onnxruntime-node/package.json')),'bin/napi-v6/darwin/arm64/libonnxruntime.1.24.3.dylib');
const library=await readFile(runtime);
if(createHash('sha256').update(library).digest('hex')!=='76831409ce6eded92b4cb343cf422c458a60c1ea1d5f3cfa69692ab7fcc67f0f')throw Error('Changed native runtime');
await writeFile(dataRoot+'/models/minilm-prototype/libonnxruntime.1.24.3.dylib',library);
const fixtures=JSON.parse(await readFile(root+'artifacts/minilm-native/runtime-reference.json'));
// Embed synthetic reference only; no live input or prior sessions are read.
await writeFile(work+'fixtures.json',JSON.stringify(fixtures));
await build({configFile:false,root:root+'scripts/minilm-profile/frontend',resolve:{alias:{'ort-local':join(ort,'ort.wasm.min.mjs')}},worker:{format:'es'},build:{outDir:work+'frontend',emptyOutDir:true,copyPublicDir:false}});
const config={productName:'OfflineMask MiniLM Profile',identifier,build:{beforeBuildCommand:'',frontendDist:work+'frontend'},app:{windows:[{label:'main',title:'OfflineMask MiniLM integration probe',width:900,height:600}]},bundle:{targets:['app']}};
await writeFile(work+'tauri.conf.json',JSON.stringify(config,null,2));
await writeFile(work+'paths.json',JSON.stringify({identifier,dataRoot},null,2));
console.log('Prepared isolated frontend and checksum-verified test assets.');

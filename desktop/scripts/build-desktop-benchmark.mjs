import {build} from 'vite';
import {cp,mkdir,readFile,writeFile,link} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
const root=new URL('../',import.meta.url).pathname;
const out=root+'artifacts/native-benchmark/frontend';
await build({configFile:false,root:root+'scripts/desktop-benchmark',build:{outDir:out,emptyOutDir:true,copyPublicDir:false}});
await cp(root+'public/runtime',out+'/runtime',{recursive:true});
// Isolated identifier: never install into or modify the user's production pack.
const identifier='dev.offlinemask.benchmark.address20260910';
const dataRoot=join(homedir(),'Library/Application Support',identifier,'models/vietnamese-pii-v1');
const manifest=JSON.parse(await readFile(root+'scripts/model-manifest.json','utf8'));
for(const model of manifest.models) for(const file of Object.keys(model.files)) {
 const source=root+`public/models/${model.directory}/${file}`;
 const target=join(dataRoot,model.directory,file);
 await mkdir(join(target,'..'),{recursive:true});
 try {await link(source,target);}catch(error){if(error.code!=='EEXIST')throw error;}
}
const config={productName:'OfflineMask Benchmark',identifier,build:{beforeBuildCommand:'',frontendDist:out},app:{windows:[{label:'main',title:'OfflineMask Runtime Benchmark',width:1000,height:850}]}};
await writeFile(root+'artifacts/native-benchmark/tauri.conf.json',JSON.stringify(config,null,2));
console.log('Prepared isolated benchmark config and hard-linked local test pack.');

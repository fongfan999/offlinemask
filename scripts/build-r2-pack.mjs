// Explicit developer packaging; never imported by startup/builds. No upload occurs here.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='https://pub-5b0280497d774b8f99417b3438d8bce8.r2.dev';
const output='artifacts/r2-v1-upload';
const results=JSON.parse(await readFile('docs/evaluations/pack-compression-v1/results.json'));
const hash=b=>createHash('sha256').update(b).digest('hex');
await mkdir(output,{recursive:true});
const pack={assets:[]};
const objects=[];
for(const row of results.rows.filter(r=>r.level===9)){
 const name=row.path.split('/').at(-1);
 const source=`artifacts/pack-compression-v1/zstd-9/${row.variant}/${name}.zst`;
 const bytes=await readFile(source);
 if(hash(bytes)!==row.compressedSha256||bytes.length!==row.compressedBytes)throw Error('Changed compression evidence');
 const transport={url:null,bytes:bytes.length,sha256:hash(bytes),encoding:'zstd',parts:[]};
 for(let offset=0;offset<bytes.length;offset+=256*1024*1024){
  const part=bytes.subarray(offset,Math.min(bytes.length,offset+256*1024*1024));
  const sha256=hash(part),key=`${sha256}.zst`;
  await writeFile(`${output}/${key}`,part,{flag:'wx'});
  objects.push({key,bytes:part.length,sha256});
  transport.parts.push({url:`${base}/${key}`,bytes:part.length,sha256});
 }
 if(transport.parts.length===1){transport.url=transport.parts[0].url;transport.parts=[];}
 pack.assets.push({directory:row.variant==='underthesea'?'underthesea':'vietnamese-pii-multilingual',name,
  bytes:row.size,sha256:row.sha256,transport});
}
await writeFile('scripts/release-pack-v1.json',JSON.stringify(pack,null,2)+'\n',{flag:'wx'});
await copyFile('docs/licenses/models-Apache-2.0.txt',`${output}/LICENSE-Apache-2.0.txt`);
await writeFile(`${output}/NOTICE-vietnamese-pii-v1.txt`,
 `OfflineMask Vietnamese recognition pack v1 candidate\n\nUnderthesea: undertheseanlp/vietnamese-ner-v1.4.0a2\nSource revision a51e05fc09e1b1f0800dbad8ae84e86ad311debd, Apache-2.0.\nModified: exported to ONNX and dynamically quantized INT8 by OfflineMask.\n\nOpenMed: OpenMed-PII-Vietnamese-mSuperClinical-Large-279M-v1-onnx-android\nSource revision eaac31560eef579a7ae6144377109969dbd1e83a, Apache-2.0.\nPublished INT8 graph and supporting files unchanged.\n\nDistribution adds lossless Zstandard compression and transport splitting only.\nSee LICENSE-Apache-2.0.txt.\nThis development pack is not a claim of complete detection or release qualification.\n`);
await writeFile(`${output}/vietnamese-pii-v1.json`,JSON.stringify(pack,null,2)+'\n');
for(const key of ['LICENSE-Apache-2.0.txt','NOTICE-vietnamese-pii-v1.txt','vietnamese-pii-v1.json']){
 const b=await readFile(`${output}/${key}`);objects.push({key,bytes:b.length,sha256:hash(b)});
}
await writeFile('artifacts/r2-v1-objects.json',JSON.stringify({base,objects},null,2)+'\n',{flag:'wx'});
console.log(`Prepared ${objects.length} public model objects; no input, examples or private data included.`);

import {join} from 'node:path';
import {env,pipeline} from '@huggingface/transformers';
import {createModelRunner} from '../../src/core/detection/model-runner.ts';
import {predictAllTokens} from '../../src/core/detection/token-predictions.ts';
import {prepareReferenceOffsets,attachReferenceOffsets} from '../shared-core/reference-offsets.mjs';

/** Same pinned candidate as the previous adapter, exposing synthetic token
 * evidence for diagnosis. Native reference offsets remain developer tooling.
 */
export async function loadDiagnostic(root,texts) {
  const directory=join(root,'artifacts/alternative-models');
  env.allowRemoteModels=false;env.allowLocalModels=true;env.localModelPath=directory+'/';
  env.useFSCache=false;env.useBrowserCache=false;env.useWasmCache=false;
  const classifier=await pipeline('token-classification','underthesea',{
    device:'cpu',dtype:'fp32',subfolder:'',local_files_only:true,model_file_name:'model_int8',
  });
  try {
    const references=await prepareReferenceOffsets(classifier.tokenizer,join(directory,'underthesea/tokenizer.json'),texts);
    const traces=new Map();
    const runner=createModelRunner([{
      source:'Evaluation · underthesea',
      tokenCount:text=>classifier.tokenizer.encode(text).length,
      async predict(text) {
        const original=await predictAllTokens(classifier,text,true);
        const reference=references.get(text);
        if(!reference)throw Error('Missing native reference');
        const ids=classifier.tokenizer.encode(text,{add_special_tokens:false});
        const aligned=attachReferenceOffsets(text,original,ids,reference);
        traces.set(text,{text,ids,tokens:original.map((t,i)=>({...t,start:aligned[i].start,end:aligned[i].end,source:text.slice(aligned[i].start,aligned[i].end)}))});
        const labels={PER:'PERSON',LOC:'LOCATION',ORG:'ORGANIZATION'};
        return aligned.map(token=>{
          const [prefix,label]=token.entity.split('-');
          return {...token,entity:labels[label]?`${prefix}-${labels[label]}`:'O'};
        });
      },
      align:(_text,tokens)=>tokens,
      dispose:()=>classifier.dispose(),
    }]);
    return {...runner,traces};
  }catch(error){await classifier.dispose();throw error;}
}

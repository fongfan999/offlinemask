"""Independent offline CPU oracle; not needed by the Rust executable."""
import os
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1')
import json
from pathlib import Path
import numpy as np
import onnxruntime as ort
from transformers import XLMRobertaTokenizer
root=Path(__file__).resolve().parents[2]; work=root/'artifacts/minilm-native'; old=root/'artifacts/minilm-admission'
corpus=json.loads((old/'corpus.json').read_text()); windows=json.loads((old/'chunks.json').read_text())
selected=corpus[-16:]+[corpus[i] for i in [0,1,15,40]]
tokenizer=XLMRobertaTokenizer.from_pretrained(old/'source',local_files_only=True)
options=ort.SessionOptions(); options.intra_op_num_threads=1
session=ort.InferenceSession(str(root/'artifacts/minilm-repair/model-gather.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
results=[]
for row in selected:
    # Use an original whole shared-core window; never truncate model tokens.
    window=next((w for w in windows if w['id']==row['id']),{'text':row['text'],'start':0})
    text=window['text']; ids=tokenizer.encode(text); assert 2<=len(ids)<=384
    inputs={'input_ids':np.array([ids],dtype=np.int64),'attention_mask':np.ones((1,len(ids)),dtype=np.int64),'token_type_ids':np.zeros((1,len(ids)),dtype=np.int64)}
    logits=session.run(['logits'],inputs)[0]
    results.append({'id':row['id'],'text':text,'start':window['start'],'ids':ids,'logits':logits.tolist()})
with (work/'runtime-reference.json').open('x') as f:json.dump(results,f)
print(json.dumps({'cases':len(results),'maxTokens':max(len(r['ids']) for r in results)}))

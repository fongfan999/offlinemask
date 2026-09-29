"""Compare published tensor schema to the stock runtime without inventing missing layers."""
import os
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1')
import sys,json,socket,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]
out=root/'artifacts/quality-first-v1'
sys.path.insert(0,str(out/'packages'))
def deny(*args,**kwargs): raise RuntimeError('Network forbidden in compatibility check')
socket.socket.connect=deny
socket.create_connection=deny
import torch
from transformers import AutoConfig
from gliner2 import GLiNER2,ExtractorConfig
from gliner2.models.base import load_extractor_tokenizer
config=ExtractorConfig.from_pretrained(str(out/'gliner/config.json'),local_files_only=True)
encoder=AutoConfig.from_pretrained(str(out/'gliner/encoder_config/config.json'),local_files_only=True)
tokenizer=load_extractor_tokenizer(str(out/'gliner'))
with torch.device('meta'):
    model=GLiNER2(config,encoder_config=encoder,tokenizer=tokenizer,use_flashdeberta=False)
expected={name:list(value.shape) for name,value in model.state_dict().items()}
header=json.loads((out/'weights-header.json').read_text())
published={name:value['shape'] for name,value in header.items() if name!='__metadata__'}
unexpected=sorted(set(published)-set(expected))
missing=sorted(set(expected)-set(published))
mismatched={name:{'published':published[name],'runtime':expected[name]} for name in set(expected)&set(published) if expected[name]!=published[name]}
result={'candidate':'AITeamUIT/gliner2-pii500k-final-model','revision':'e15225965c361fc4ec6e5681eaec5312c63b71a8',
 'runtime':'gliner2 2.0.0 / transformers 4.57.6 / torch 2.8.0',
 'method':'Instantiate stock model on meta device; compare every tensor key and shape with published safetensors header. No weights loaded or inference executed.',
 'unexpected':unexpected,'missing':missing,'mismatched':mismatched,
 'compatible':not(unexpected or missing or mismatched),
 'decision':'BLOCKED_MISSING_MATCHING_RUNTIME' if unexpected or missing or mismatched else 'SCHEMA_MATCH_DOWNLOAD_ELIGIBLE',
 'publishedHeaderSha256':hashlib.sha256((out/'weights-header.json').read_bytes()).hexdigest(),
 'limits':'Metadata compatibility only. No accuracy conclusion; do not discard unknown trained parameters or fabricate their computation.'}
(root/'docs/evaluations/quality-first-v1/gliner-compatibility.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))

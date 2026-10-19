"""Gather-only follow-up: reuse the frozen export and operator probes."""
import os
os.environ.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1')
import json, hashlib
from pathlib import Path
import numpy as np
import onnx
import onnxruntime as ort
from onnxruntime.quantization import QuantType, quantize_dynamic
root=Path(__file__).resolve().parents[2]
old=root/'artifacts/minilm-admission'; work=root/'artifacts/minilm-repair'
output=work/'model-gather.onnx'
assert not output.exists(), 'Never overwrite a measured graph'
quantize_dynamic(str(old/'model-fp32.onnx'),str(output),weight_type=QuantType.QInt8,per_channel=False,op_types_to_quantize=['Gather'])
onnx.checker.check_model(str(output))
options=ort.SessionOptions(); options.intra_op_num_threads=1
session=ort.InferenceSession(str(output),sess_options=options,providers=['CPUExecutionProvider'])
rows=[]; comparisons=[]
for row in json.loads((old/'runtime-reference.json').read_text()):
    inputs={k:np.array(v,dtype=np.int64) for k,v in row['inputs'].items()}
    actual=session.run(['logits'],inputs)[0]
    assert np.isfinite(actual).all()
    delta=actual-np.array(row['fp32'],dtype=np.float32)
    comparisons.append({'id':row['id'],'maxAbs':float(np.abs(delta).max()),'rmse':float(np.sqrt(np.mean(delta**2)))})
    rows.append({'id':row['id'],'inputs':row['inputs'],'gather':actual.tolist()})
with (work/'runtime-reference.json').open('x') as f: json.dump(rows,f)
files={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in (old/'pack').iterdir() if p.is_file() and p.suffix!='.onnx'}
files[output.name]={'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}
graph=onnx.load(str(output))
evidence={'files':files,'packBytes':sum(x['bytes'] for x in files.values()),'comparisonsToFP32':comparisons,
'operators':sorted(set(n.op_type for n in graph.graph.node)), 'versions':{'onnx':onnx.__version__,'onnxruntime':ort.__version__},
'embeddings':[{'name':x.name,'type':x.data_type,'dims':list(x.dims)} for x in graph.graph.initializer if 'word_embeddings' in x.name]}
with (work/'compression.json').open('x') as f: json.dump(evidence,f,indent=2)
print(json.dumps(evidence),flush=True)

"""Local-only base-model admission. Random 39-label head; never a quality benchmark."""
import os
os.environ.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1', TOKENIZERS_PARALLELISM='false')
import hashlib
import json
import importlib.metadata
from pathlib import Path
import numpy as np
import torch
import onnx
import onnxruntime as ort
from onnxruntime.quantization import QuantType, quantize_dynamic
from transformers import BertForTokenClassification, XLMRobertaTokenizer, XLMRobertaTokenizerFast

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'artifacts/minilm-admission'
source = WORK / 'source'
pack = WORK / 'pack'
pack.mkdir(exist_ok=True)
for name, entry in json.loads((ROOT / 'docs/evaluations/minilm-admission/download-evidence.json').read_text())['files'].items():
    content = (source / name).read_bytes()
    assert hashlib.sha256(content).hexdigest() == entry['sha256']
torch.set_num_threads(1)
torch.manual_seed(9182026)
slow = XLMRobertaTokenizer.from_pretrained(source, local_files_only=True)
fast = XLMRobertaTokenizerFast.from_pretrained(source, local_files_only=True, from_slow=True)
fast.save_pretrained(pack)
rows = json.loads((WORK / 'corpus.json').read_text())
checks, mismatches = [], []
for row in rows:
    text = row['text']
    encoding = fast(text, return_offsets_mapping=True, return_special_tokens_mask=True, truncation=False)
    ids = slow.encode(text, add_special_tokens=True, truncation=False)
    if ids != encoding['input_ids']:
        mismatches.append(row['id'])
    utf16 = [0]
    for char in text:
        utf16.append(utf16[-1] + len(char.encode('utf-16-le')) // 2)
    checks.append({**row, 'ids': encoding['input_ids'], 'attentionMask': encoding['attention_mask'],
                   'specialMask': encoding['special_tokens_mask'],
                   'offsets': [[utf16[a], utf16[b]] for a, b in encoding['offset_mapping']]})
(WORK / 'tokenizer-reference.json').write_text(json.dumps({'slowFastIdMismatches': mismatches, 'rows': checks}, ensure_ascii=False))
print('Tokenizer rows', len(rows), 'slow/fast mismatches', mismatches, flush=True)
types = json.loads((ROOT / 'docs/evaluations/detector-feasibility/capabilities.json').read_text())['types']
labels = ['O'] + [f'{bio}-{name.upper()}' for name in types for bio in ['B', 'I']]
model, loading = BertForTokenClassification.from_pretrained(source, local_files_only=True, weights_only=True,
    attn_implementation='eager', id2label=dict(enumerate(labels)), label2id={l:i for i,l in enumerate(labels)}, output_loading_info=True)
assert set(loading['missing_keys']) == {'classifier.weight', 'classifier.bias'}, loading
assert not loading.get('mismatched_keys') and not loading.get('error_msgs'), loading
model.eval()
model.config.save_pretrained(pack)
class Logits(torch.nn.Module):
    def __init__(self, model):
        super().__init__(); self.model = model
    def forward(self, input_ids, attention_mask, token_type_ids):
        return self.model(input_ids=input_ids, attention_mask=attention_mask, token_type_ids=token_type_ids).logits

example = fast('Văn bản kiểm tra bộ xuất mô hình.', return_tensors='pt')
args = (example['input_ids'], example['attention_mask'], torch.zeros_like(example['input_ids']))
fp32 = WORK / 'model-fp32.onnx'
wrapper = Logits(model).eval()
torch.onnx.export(wrapper, args, str(fp32), input_names=['input_ids','attention_mask','token_type_ids'], output_names=['logits'],
    dynamic_axes={k:{0:'batch',1:'sequence'} for k in ['input_ids','attention_mask','token_type_ids','logits']},
    opset_version=18, dynamo=False)
assert not model.training and not wrapper.training, 'Export changed eval mode'
onnx.checker.check_model(str(fp32))
print('FP32 exported', fp32.stat().st_size, flush=True)
quantize_dynamic(str(fp32), str(pack / 'model_quantized.onnx'), weight_type=QuantType.QInt8,
    per_channel=False, op_types_to_quantize=['MatMul','Gather'])
onnx.checker.check_model(str(pack / 'model_quantized.onnx'))
print('INT8 MatMul/Gather exported', (pack / 'model_quantized.onnx').stat().st_size, flush=True)
options = ort.SessionOptions(); options.intra_op_num_threads = 1
sessions = [ort.InferenceSession(str(p), sess_options=options, providers=['CPUExecutionProvider']) for p in [fp32, pack / 'model_quantized.onnx']]
references, comparisons = [], []
# Bounded operator/fidelity probes only. No privacy accuracy scoring of a random head.
texts = [r['text'] for r in rows[-16:]] + [rows[i]['text'] for i in [0,1,15,40]]
for i, text in enumerate(texts):
    encoded = fast(text, return_tensors='np', truncation=True, max_length=384)
    inputs = {k: v.astype(np.int64) for k,v in encoded.items()}
    inputs['token_type_ids'] = np.zeros_like(inputs['input_ids'])
    with torch.no_grad(): expected = model(**{k:torch.from_numpy(v) for k,v in inputs.items()}).logits.numpy()
    plain, compressed = [s.run(['logits'], inputs)[0] for s in sessions]
    np.testing.assert_allclose(plain, expected, rtol=1e-4, atol=1e-4)
    assert np.isfinite(compressed).all()
    delta = compressed - expected
    comparisons.append({'id':i, 'tokens':int(inputs['input_ids'].shape[1]), 'fp32MaxAbs':float(np.max(np.abs(plain-expected))),
        'int8MaxAbs':float(np.max(np.abs(delta))), 'int8Rmse':float(np.sqrt(np.mean(delta**2))),
        'untrainedHeadArgmaxAgreement':float(np.mean(np.argmax(compressed,axis=-1)==np.argmax(expected,axis=-1)))})
    references.append({'id':i, 'inputs':{k:v.tolist() for k,v in inputs.items()}, 'fp32':plain.tolist(), 'int8':compressed.tolist()})
(WORK / 'runtime-reference.json').write_text(json.dumps(references))
graph = onnx.load(str(pack / 'model_quantized.onnx'))
files = {p.name:{'size':p.stat().st_size, 'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in pack.iterdir() if p.is_file()}
evidence = {'randomHead':True, 'seed':9182026, 'trainingSteps':0, 'loading':loading, 'labels':labels,
 'slowFastIdMismatches':mismatches, 'comparisons':comparisons, 'files':files, 'packBytes':sum(f['size'] for f in files.values()),
 'operators':sorted(set((n.domain or 'ai.onnx')+':'+n.op_type for n in graph.graph.node)),
 'embeddingInitializers':[{'name':t.name,'dataType':t.data_type,'dims':list(t.dims)} for t in graph.graph.initializer if 'word_embeddings' in t.name],
 'versions':{p:importlib.metadata.version(p) for p in ['torch','transformers','onnx','onnxruntime','optimum-onnx','tokenizers','sentencepiece']}}
(WORK / 'prototype-evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
print(json.dumps({'packBytes':evidence['packBytes'], 'embeddingInitializers':evidence['embeddingInitializers'], 'comparisons':comparisons}), flush=True)

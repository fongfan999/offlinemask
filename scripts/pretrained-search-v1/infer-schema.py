"""Explicit local developer evaluation. No training, hub calls or app integration."""
import os
os.environ.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1',
                  TOKENIZERS_PARALLELISM='false', TORCH_FORCE_WEIGHTS_ONLY_LOAD='1')
import sys, json, hashlib, socket, time, importlib.metadata
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/pretrained-search-v1/schema'
sys.path.insert(0, str(OUT.parent / 'python-packages'))
def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''): h.update(chunk)
    return h.hexdigest()
protocol = json.loads((ROOT / 'docs/evaluations/pretrained-search-v1/schema/protocol.json').read_text())
for name, expected in protocol['files'].items(): assert digest(ROOT / name) == expected, name
manifest = json.loads((OUT / 'manifest.json').read_text())
for name, record in manifest['files'].items():
    path = OUT.parent / 'greennode' / name
    assert path.stat().st_size == record['size'] and digest(path) == record['sha256'], name
def deny_network(*args, **kwargs): raise RuntimeError('Network forbidden during local inference')
socket.socket.connect = deny_network
socket.socket.connect_ex = deny_network
socket.create_connection = deny_network
import torch
from gliner import GLiNER
versions = {name: importlib.metadata.version(name) for name in ['gliner','torch','transformers','tokenizers']}
assert versions['gliner'] == '0.2.22' and versions['torch'] == '2.8.0' and versions['transformers'] == '4.57.6'
torch.manual_seed(0)
torch.set_num_threads(4)
torch.set_num_interop_threads(1)
started = time.monotonic()
model = GLiNER.from_pretrained(str(OUT.parent / 'greennode'), local_files_only=True, load_tokenizer=True,
                             strict=True, map_location='cpu')
assert model.config.vocab_size == len(model.data_processor.transformer_tokenizer)
assert model.config.max_width == 12 and not model.data_processor.preprocess_text
print('Strict local model load succeeded', flush=True)
labels = protocol['labels']
tokenizer = model.data_processor.transformer_tokenizer
classes = {name: i+1 for i,name in enumerate(labels)}
cache = {}
def token_ids(words):
    prepared, _ = model.data_processor.prepare_inputs([words], classes)
    return tokenizer(prepared, is_split_into_words=True, truncation=False)['input_ids'][0]
def windows(text):
    words = list(model.data_processor.words_splitter(text))
    start = 0
    while start < len(words):
        end = start + 1
        assert len(token_ids([words[start][0]])) <= protocol['maxInputTokens'], 'Oversized single token'
        while end < len(words):
            if words[end][2] - words[start][1] > protocol['maxWindowCharacters']: break
            if len(token_ids([w[0] for w in words[start:end+1]])) > protocol['maxInputTokens']: break
            end += 1
        a, b = words[start][1], words[end-1][2]
        yield a, b, token_ids([w[0] for w in words[start:end]])
        if end == len(words): break
        assert end-start > protocol['overlapWords'], 'Cannot guarantee configured overlap'
        start = end - protocol['overlapWords']
def predict(text):
    entities, trace = [], []
    for start,end,ids in windows(text):
        chunk = text[start:end]
        if chunk not in cache:
            actual,_ = model.prepare_model_inputs([chunk], labels)
            assert actual['input_ids'][0].tolist() == ids, 'Tokenizer truncation or preprocessing mismatch'
            assert len(ids) <= protocol['maxInputTokens']
            cache[chunk] = model.predict_entities(chunk, labels, threshold=protocol['threshold'],
                         flat_ner=protocol['flatNer'], multi_label=protocol['multiLabel'])
        for entity in cache[chunk]:
            assert chunk[entity['start']:entity['end']] == entity['text']
            entities.append({**entity,'start':start+entity['start'],'end':start+entity['end']})
        trace.append({'start':start,'end':end,'inputTokens':len(ids)})
    return entities,trace
output = OUT / 'raw.jsonl'
with output.open('x') as stream:
    for case in json.loads((OUT / 'inputs.json').read_text()):
        tick = time.monotonic()
        try:
            entities,trace = predict(case['text'])
            result = {**case,'entities':entities,'windows':trace,'error':None}
        except Exception as error:
            result = {**case,'entities':[],'windows':[],'error':str(error)}
        result['durationMs'] = (time.monotonic()-tick)*1000
        stream.write(json.dumps(result,ensure_ascii=False)+'\n');stream.flush()
        if result['error'] or (case['index']+1)%20 == 0: print(case['index']+1, result['error'] or 'completed', flush=True)
for name, expected in protocol['files'].items(): assert digest(ROOT / name) == expected, name
(OUT / 'runtime.json').write_text(json.dumps({'versions':versions,'elapsedSeconds':time.monotonic()-started,
 'device':'cpu','dtype':'float32','threads':4,'uniqueInferredWindows':len(cache),
 'network':'HF offline flags and socket connect denial enabled before imports/load',
 'timingLimit':'Identical windows cached, includes Python preprocessing; not app latency.'},indent=2)+'\n')

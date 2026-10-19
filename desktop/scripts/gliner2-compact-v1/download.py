"""Explicit developer download of the pinned INT8 candidate; never an app hook."""
import concurrent.futures
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('download_helpers', ROOT / 'scripts/download-alternative-models.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
REPO = 'pii-engineer/PII-Engineer-Multi-NER-v2.1'
REV = 'efacd9242671d0300da535207d7952dc3f82f57e'
DEST = ROOT / 'artifacts/gliner2-compact-v1/model'
NAMES = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'README.md',
         'onnx/encoder_int8.onnx', 'onnx/span_rep.onnx', 'onnx/count_embed.onnx',
         'onnx/count_pred.onnx', 'onnx/classifier.onnx']
metadata = helper.get_json(f'https://huggingface.co/api/models/{REPO}/revision/{REV}?blobs=true')
assert metadata['sha'] == REV and metadata['cardData']['license'] == 'apache-2.0'
files = {f['rfilename']: f for f in metadata['siblings']}
record = {'repository': REPO, 'revision': REV, 'license': 'Apache-2.0', 'files': {}}
for name in NAMES:
    info = files[name]
    target = DEST / name
    target.parent.mkdir(parents=True, exist_ok=True)
    size = info['size']
    expected = info.get('lfs', {}).get('sha256')
    if not (target.exists() and target.stat().st_size == size and (not expected or helper.digest(target) == expected)):
        temporary = target.with_suffix(target.suffix + '.partial')
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            while (offset := temporary.stat().st_size if temporary.exists() else 0) < size:
                offsets = range(offset, min(offset + 4 * 8 * 1024 * 1024, size), 8 * 1024 * 1024)
                pending = [pool.submit(helper.fetch_part, REPO, REV, name, size, at) for at in offsets]
                for part in pending:
                    with temporary.open('ab') as stream:
                        stream.write(part.result())
                print(f'{name}: {temporary.stat().st_size}/{size}', flush=True)
        assert temporary.stat().st_size == size
        if expected:
            assert helper.digest(temporary) == expected
        temporary.replace(target)
    if not expected:
        content = target.read_bytes()
        assert hashlib.sha1(f'blob {len(content)}\0'.encode() + content).hexdigest() == info['blobId']
    record['files'][name] = {'size': size, 'sha256': helper.digest(target)}
# Publisher's downloader performs the same filename mapping; bytes unchanged.
shutil.copyfile(DEST / 'config.json', DEST / 'gliner_config.json')
record['runtimeAlias'] = {'gliner_config.json': 'config.json'}
(DEST.parent / 'assets.json').write_text(json.dumps(record, indent=2) + '\n')
print('Pinned INT8 candidate verified.', flush=True)

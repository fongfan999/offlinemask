"""Explicit developer-only download; never imported by builds or the application."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / 'artifacts' / 'alternative-models'
MODELS = [
    ('bigmed', 'OpenMed/OpenMed-PII-Vietnamese-BigMed-Large-278M-v1-onnx-android',
     '2c996ac92e24c939755a8197c3f574c4f65874cf',
     ['model_int8.onnx', 'config.json', 'tokenizer.json', 'tokenizer_config.json', 'id2label.json', 'openmed-onnx.json', 'README.md']),
    ('underthesea-source', 'undertheseanlp/vietnamese-ner-v1.4.0a2',
     'a51e05fc09e1b1f0800dbad8ae84e86ad311debd',
     ['pytorch_model.bin', 'config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'vocab.txt', 'README.md']),
]

def get_json(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return json.load(response)

def digest(path, algorithm='sha256'):
    h = hashlib.new(algorithm)
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def fetch_part(repository, revision, name, size, offset):
    last = min(offset + 8 * 1024 * 1024, size) - 1
    url = f'https://huggingface.co/{repository}/resolve/{revision}/{name}?offset={offset}'
    for attempt in range(5):
        try:
            request = urllib.request.Request(url, headers={'Range': f'bytes={offset}-{last}'})
            with urllib.request.urlopen(request, timeout=45) as response:
                if response.status == 206:
                    assert response.headers['Content-Range'] == f'bytes {offset}-{last}/{size}'
                else:
                    assert response.status == 200 and offset == 0 and size <= 8 * 1024 * 1024
                content = response.read()
                assert len(content) == last - offset + 1
            return content
        except (OSError, AssertionError):
            if attempt == 4:
                raise
            time.sleep(attempt + 1)

def download(model):
    directory, repository, revision, names = model
    metadata = get_json(f'https://huggingface.co/api/models/{repository}/revision/{revision}?blobs=true')
    assert metadata['sha'] == revision
    assert metadata.get('cardData', {}).get('license') == 'apache-2.0'
    files = {f['rfilename']: f for f in metadata['siblings']}
    destination = ROOT / directory
    destination.mkdir(parents=True, exist_ok=True)
    record = {'directory': directory, 'repository': repository, 'revision': revision, 'license': 'Apache-2.0', 'files': {}}
    for name in names:
        info = files[name]
        size = info['size']
        target = destination / name
        expected = info.get('lfs', {}).get('sha256')
        if not (target.exists() and target.stat().st_size == size and (not expected or digest(target) == expected)):
            temporary = target.with_name(name + '.partial')
            # Bounded batches keep at most four chunks in memory; append in byte order.
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as parts:
                while (offset := temporary.stat().st_size if temporary.exists() else 0) < size:
                    offsets = range(offset, min(offset + 4 * 8 * 1024 * 1024, size), 8 * 1024 * 1024)
                    pending = [parts.submit(fetch_part, repository, revision, name, size, at) for at in offsets]
                    for part in pending:
                        content = part.result()
                        with temporary.open('ab') as stream:
                            stream.write(content)
                    if size > 100_000_000:
                        print(f'{directory}: {temporary.stat().st_size / 1e6:.0f}/{size / 1e6:.0f} MB', flush=True)
            assert temporary.stat().st_size == size
            if expected:
                assert digest(temporary) == expected
            temporary.replace(target)
        # Metadata files use a Git blob SHA-1 rather than LFS SHA-256.
        if not expected:
            content = target.read_bytes()
            assert hashlib.sha1(f'blob {len(content)}\0'.encode() + content).hexdigest() == info['blobId']
        record['files'][name] = {'size': size, 'sha256': digest(target)}
    print(f'Verified {directory}', flush=True)
    return record

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        records = list(pool.map(download, MODELS))
    (ROOT / 'manifest.json').write_text(json.dumps({'models': records}, indent=2) + '\n')

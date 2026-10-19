"""Explicit developer download of one pinned base model; never imported by the app."""
import hashlib
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
manifest = json.loads((ROOT / 'docs/evaluations/minilm-admission/source-manifest.json').read_text())
target = ROOT / 'artifacts/minilm-admission/source'
target.mkdir(parents=True, exist_ok=True)
records = {}
for name, entry in manifest['files'].items():
    path = target / name
    partial = path.with_suffix(path.suffix + '.partial')
    if not path.exists():
        url = f"https://huggingface.co/{manifest['repository']}/resolve/{manifest['revision']}/{name}"
        with urllib.request.urlopen(url, timeout=90) as response, partial.open('wb') as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
        assert partial.stat().st_size == entry['size'], name
        path_to_verify = partial
    else:
        path_to_verify = path
    content = path_to_verify.read_bytes()
    assert len(content) == entry['size'], name
    digest = hashlib.sha256(content).hexdigest()
    if 'lfs' in entry:
        assert digest == entry['lfs']['sha256'], name
    else:
        git_blob = hashlib.sha1(f'blob {len(content)}\0'.encode() + content).hexdigest()
        assert git_blob == entry['blobId'], name
    if path_to_verify == partial:
        partial.replace(path)
    records[name] = {'size': len(content), 'sha256': digest}
    print('Verified', name, len(content), flush=True)
record = {'repository': manifest['repository'], 'revision': manifest['revision'], 'files': records}
out = ROOT / 'docs/evaluations/minilm-admission/download-evidence.json'
if out.exists():
    assert json.loads(out.read_text()) == record
else:
    out.write_text(json.dumps(record, indent=2) + '\n')

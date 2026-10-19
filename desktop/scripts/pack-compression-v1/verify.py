"""Replay lossless pack verification without rewriting the measured evidence."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import time

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / 'docs/evaluations/pack-compression-v1'
WORK = ROOT / 'artifacts/pack-compression-v1'
def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()
protocol = json.loads((REPORT/'protocol.json').read_text())
result = json.loads((REPORT/'results.json').read_text())
assert digest(REPORT/'protocol.json') == result['protocolSha256']
assert digest(ROOT/'scripts/pack-compression-v1/measure.py') == protocol['scriptSha256']
assert digest(ROOT/'docs/evaluations/shared-core-protocol-v2.json') == protocol['sourceManifestSha256']
zstd = shutil.which('zstd')
assert digest(Path(zstd)) == protocol['zstdExecutableSha256']
assert len(result['rows']) == len(protocol['files']) * len(protocol['levels'])
verified = []
for row in result['rows']:
    original = ROOT / row['path']
    assert digest(original) == row['sha256']
    compressed = WORK/f"zstd-{row['level']}"/row['variant']/(original.name+'.zst')
    assert compressed.stat().st_size == row['compressedBytes']
    assert digest(compressed) == row['compressedSha256']
    h = hashlib.sha256()
    count = 0
    child = subprocess.Popen([zstd,'-q','-d','-c',str(compressed)],stdout=subprocess.PIPE)
    for b in iter(lambda:child.stdout.read(1024*1024),b''):
        count += len(b);h.update(b)
    assert child.wait() == 0
    assert count == row['size'] and h.hexdigest() == row['sha256']
    verified.append({'variant':row['variant'],'path':row['path'],'level':row['level'],'restoredSha256':h.hexdigest()})
for summary in result['summary']:
    group = [r for r in result['rows'] if r['level']==summary['level']]
    assert summary['originalBytes'] == sum(r['size'] for r in group)
    assert summary['downloadBytes'] == sum(r['compressedBytes'] for r in group)
receipt = {'verifiedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
    'resultsSha256':digest(REPORT/'results.json'),'verificationScriptSha256':digest(Path(__file__)),
    'losslessRoundTrips':len(verified),'verified':verified,
    'limits':'Confirms exact restoration of evaluated bytes, not production downloader or release readiness.'}
target = REPORT/'verification.json'
if target.exists():
    saved = json.loads(target.read_text());receipt['verifiedAt'] = saved['verifiedAt'];assert saved == receipt
else:
    with target.open('x') as f:json.dump(receipt,f,indent=2)
print(f"Verified {len(verified)} compressed-file round trips; every restored SHA-256 matches.")

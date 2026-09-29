"""Lossless local packaging experiment; never changes or publishes model files."""
import hashlib
import json
from pathlib import Path
import platform
import shutil
import subprocess
import time

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'artifacts/pack-compression-v1'
REPORT = ROOT / 'docs/evaluations/pack-compression-v1'
WORK.mkdir(parents=True, exist_ok=True)
REPORT.mkdir(parents=True, exist_ok=True)
def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b''): h.update(chunk)
    return h.hexdigest()
source = ROOT / 'docs/evaluations/shared-core-protocol-v2.json'
assets = json.loads(source.read_text())['assets']
files = []
for variant in ['underthesea','large']:
    for record in assets[variant]:
        for name, info in record['files'].items():
            path = ROOT / record['directory'] / name
            assert path.stat().st_size == info['size'] and digest(path) == info['sha256'], path
            files.append({'variant':variant,'path':str(path.relative_to(ROOT)), **info})
zstd = shutil.which('zstd')
assert zstd
protocol = {'createdAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
    'levels':[3,9], 'threads':2, 'files':files,
    'sourceManifestSha256':digest(source),'scriptSha256':digest(Path(__file__)),
    'zstdVersion':subprocess.check_output([zstd,'--version'],text=True).strip(),
    'zstdExecutableSha256':digest(Path(zstd)),
    'method':'Compress each pinned file separately, then extract to disk and hash every restored byte. No quantization or model modification.',
    'limits':'Developer experiment, sequential warm filesystem runs. Not CDN download time or packaged installer performance.'}
with (REPORT/'protocol.json').open('x') as f: json.dump(protocol,f,indent=2)
rows = []
for level in protocol['levels']:
    for file in files:
        path = ROOT / file['path']
        directory = WORK / f'zstd-{level}' / file['variant']
        directory.mkdir(parents=True,exist_ok=True)
        compressed = directory / (path.name+'.zst')
        assert not compressed.exists()
        started = time.monotonic()
        subprocess.run([zstd,'-q',f'-{level}','-T2',str(path),'-o',str(compressed)],check=True)
        compress_seconds = time.monotonic()-started
        restored = directory / (path.name+'.restored')
        started = time.monotonic()
        subprocess.run([zstd,'-q','-d',str(compressed),'-o',str(restored)],check=True)
        extract_seconds = time.monotonic()-started
        started = time.monotonic()
        assert restored.stat().st_size == file['size'] and digest(restored) == file['sha256']
        verify_seconds = time.monotonic()-started
        restored.unlink()  # Only this newly-created verified temporary copy.
        row = {**file,'level':level,'compressedBytes':compressed.stat().st_size,
            'compressedSha256':digest(compressed),'compressSeconds':compress_seconds,
            'extractSeconds':extract_seconds,'verifySeconds':verify_seconds,'restoredSha256Matches':True}
        rows.append(row)
        print(file['variant'],path.name,level,file['size'],row['compressedBytes'],flush=True)
summary = []
for level in protocol['levels']:
    group = [r for r in rows if r['level']==level]
    summary.append({'level':level,'originalBytes':sum(r['size'] for r in group),
        'downloadBytes':sum(r['compressedBytes'] for r in group),
        'extractSeconds':sum(r['extractSeconds'] for r in group),
        'verifySeconds':sum(r['verifySeconds'] for r in group),
        'compressSeconds':sum(r['compressSeconds'] for r in group)})
result = {'protocolSha256':digest(REPORT/'protocol.json'),'platform':platform.platform(),
    'hardware':subprocess.check_output(['sysctl','-n','machdep.cpu.brand_string'],text=True).strip(),
    'summary':summary,'rows':rows}
with (REPORT/'results.json').open('x') as f: json.dump(result,f,indent=2)
print(json.dumps(summary,indent=2),flush=True)

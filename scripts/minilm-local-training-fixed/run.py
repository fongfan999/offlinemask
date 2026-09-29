"""External deadline and network-denied launch; uses only existing local assets."""
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path

root = Path(__file__).resolve().parents[2]
work = root / 'artifacts/minilm-local-training-fixed'
work.mkdir()  # Never overwrite a previous diagnostic.
paths = ['scripts/minilm-local-training-fixed/probe.py', 'scripts/minilm-local-training-fixed/run.py',
         'docs/evaluations/minilm-local-training-fixed/spec.md',
         'docs/evaluations/minilm-admission/python-requirements.txt',
         'docs/evaluations/minilm-admission/download-evidence.json']
protocol = {'timeoutSeconds': 240, 'sourceHashes': {path: hashlib.sha256((root / path).read_bytes()).hexdigest() for path in paths}}
(work / 'protocol.json').write_text(json.dumps(protocol, indent=2) + '\n')
started = time.monotonic()
timed_out = False
profile = '(version 1) (allow default) (deny network*)'
with (work / 'run.log').open('x') as output:
    process = subprocess.Popen(['/usr/bin/sandbox-exec', '-p', profile,
        str(root / 'artifacts/minilm-admission/env/bin/python'), str(root / 'scripts/minilm-local-training-fixed/probe.py')],
        cwd=root, stdout=output, stderr=subprocess.STDOUT)
    try:
        code = process.wait(timeout=240)
    except subprocess.TimeoutExpired:
        timed_out = True
        process.kill()
        code = process.wait()
launch = {'exitCode': code, 'timedOut': timed_out, 'elapsedSeconds': time.monotonic() - started, 'networkProfile': profile}
(work / 'launch.json').write_text(json.dumps(launch, indent=2) + '\n')
print(json.dumps(launch), flush=True)
sys.exit(0 if code == 0 else 1)

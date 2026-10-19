"""Launch the frozen harness with OS-denied networking; record process resources."""
import ctypes
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import time

root = Path(__file__).resolve().parents[2]
work = root / 'artifacts/gliner2-compact-v1'
compatible = '--compatible' in sys.argv
output = work / 'compatible' if compatible else work
output.mkdir(exist_ok=True)
evidence = root / 'docs/evaluations/gliner2-compact-v1'
if compatible: evidence = evidence / 'compatible'
protocol = json.loads((evidence / 'protocol.json').read_text())
for name, expected in protocol['files'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected, name
for name, data in protocol['assets']['files'].items():
    assert hashlib.sha256((work / 'model' / name).read_bytes()).hexdigest() == data['sha256'], name
dylib = root / 'artifacts/minilm-admission/env/lib/python3.12/site-packages/onnxruntime/capi/libonnxruntime.1.22.1.dylib'
if compatible: dylib = next((work / 'ort120/onnxruntime/capi').glob('libonnxruntime*.dylib'))
env = dict(os.environ, ORT_DYLIB_PATH=str(dylib), ORT_INTRA_THREADS='4', ORT_INTER_THREADS='1')
profile = '(version 1) (allow default) (deny network*)'
# Verify that this profile forbids a connection before running inference.
probe = subprocess.run(['/usr/bin/sandbox-exec', '-p', profile,
    str(root / 'artifacts/minilm-admission/env/bin/python'), '-c',
    'import socket; socket.create_connection(("127.0.0.1",9),timeout=1)'], capture_output=True, text=True)
assert probe.returncode != 0 and 'Operation not permitted' in probe.stderr, probe.stderr
class Usage(ctypes.Structure):
    _fields_ = [('uuid', ctypes.c_uint8*16)] + [(n,ctypes.c_uint64) for n in
        ['user','system','idle1','idle2','pageins','wired','resident','footprint','start','exit',
         'childuser','childsystem','childidle1','childidle2','childpageins','childelapsed','diskread','diskwrite']]
lib = ctypes.CDLL('/usr/lib/libproc.dylib')
lib.proc_pid_rusage.argtypes = [ctypes.c_int,ctypes.c_int,ctypes.c_void_p]
lib.proc_pid_rusage.restype = ctypes.c_int
samples = []
started = time.monotonic()
with (output/'raw.jsonl').open('x') as out, (output/'inference.log').open('x') as log:
    child = subprocess.Popen(['/usr/bin/sandbox-exec','-p',profile,
        str(work/'upstream/target/release/examples/offlinemask_eval'), str(work/'model'), str(work/'inputs.json')],
        cwd=root,env=env,stdout=out,stderr=log)
    while child.poll() is None and time.monotonic()-started < 7200:
        usage = Usage()
        if lib.proc_pid_rusage(child.pid,2,ctypes.byref(usage)) == 0:
            samples.append({'seconds':time.monotonic()-started,'footprintBytes':usage.footprint,'residentBytes':usage.resident})
        time.sleep(.2)
    timed_out = child.poll() is None
    if timed_out: child.terminate()
    code = child.wait(timeout=15)
result = {'exitCode':code,'timeout':timed_out,'seconds':time.monotonic()-started,
    'networkProfile':profile,'networkConnectionProbeDenied':True,
    'runtimeLibrary':str(dylib.relative_to(root)), 'runtimeLibrarySha256':hashlib.sha256(dylib.read_bytes()).hexdigest(),
    'platform':platform.platform(),'machine':platform.machine(),
    'hardware':subprocess.check_output(['sysctl','-n','machdep.cpu.brand_string'],text=True).strip(),
    'physicalMemory':int(subprocess.check_output(['sysctl','-n','hw.memsize'],text=True)),
    'peakFootprintBytes':max((s['footprintBytes'] for s in samples),default=0),
    'peakResidentBytes':max((s['residentBytes'] for s in samples),default=0),
    'sampleTargetMs':200,'samples':samples,
    'limits':'One developer CLI process, not packaged app. Sampling can miss peaks. No prediction cache.'}
(output/'execution.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='samples'}),flush=True)
raise SystemExit(1 if timed_out else code)

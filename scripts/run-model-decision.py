"""Sequential fresh processes; sample exact host/child macOS physical footprint.

Run with mise exec -- python3 scripts/run-model-decision.py. No new dependencies.
"""
import ctypes
import json
import pathlib
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/model-decision'
OUT.mkdir(parents=True, exist_ok=True)

class Usage(ctypes.Structure):
    _fields_ = [('uuid', ctypes.c_uint8 * 16)] + [(name, ctypes.c_uint64) for name in (
        'user', 'system', 'idle', 'interrupt', 'pageins', 'wired', 'resident', 'footprint',
        'start', 'exit', 'child_user', 'child_system', 'child_idle', 'child_interrupt',
        'child_pageins', 'child_elapsed', 'read', 'written')]

lib = ctypes.CDLL('/usr/lib/libproc.dylib')
lib.proc_pid_rusage.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_void_p]
lib.proc_pid_rusage.restype = ctypes.c_int
variants = ['superclinical', 'msuperclinical', 'combined']
schedule = [('native', variant, 1) for variant in variants]
schedule += [('native', variant, 2) for variant in reversed(variants)]
schedule += [('wasm', variant, 1) for variant in variants]

for runtime, variant, round_number in schedule:
    key = f'{runtime}-{variant}-{round_number}'
    active = OUT / 'active.json'
    active.unlink(missing_ok=True)
    samples = []
    started = time.monotonic()
    process = subprocess.Popen(['node', 'scripts/evaluate-model-decision.mjs', runtime, variant, str(round_number)], cwd=ROOT)
    try:
        with (OUT / f'{key}-memory.jsonl').open('w') as stream:
            while process.poll() is None:
                if time.monotonic() - started > 900:
                    raise TimeoutError(f'{key} exceeded 15 minutes')
                pids = {'parentPid': process.pid}
                try:
                    current = json.loads(active.read_text())
                    if current['parentPid'] == process.pid:
                        pids.update(current)
                except (OSError, ValueError):
                    pass
                processes = []
                for role, pid in pids.items():
                    usage = Usage()
                    if pid and lib.proc_pid_rusage(pid, 2, ctypes.byref(usage)) == 0:
                        processes.append({'role': role, 'pid': pid, 'residentBytes': usage.resident,
                                          'physicalFootprintBytes': usage.footprint})
                if processes:
                    sample = {'elapsedMs': round((time.monotonic() - started) * 1000), 'processes': processes}
                    samples.append(sample)
                    stream.write(json.dumps(sample) + '\n')
                    stream.flush()
                time.sleep(.5)
        if process.returncode != 0:
            raise RuntimeError(f'{key} exited {process.returncode}')
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=10)
    memory = {'nominalSamplePeriodMs': 500, 'sampleCount': len(samples),
              'peakCombinedPhysicalFootprintBytes': max(sum(p['physicalFootprintBytes'] for p in s['processes']) for s in samples),
              'peakCombinedResidentBytes': max(sum(p['residentBytes'] for p in s['processes']) for s in samples)}
    (OUT / f'{key}-memory.json').write_text(json.dumps(memory, indent=2) + '\n')
    print(key, 'peak physical footprint GiB:', round(memory['peakCombinedPhysicalFootprintBytes'] / 2**30, 2), flush=True)

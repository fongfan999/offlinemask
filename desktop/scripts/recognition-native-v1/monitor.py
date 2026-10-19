"""Sample exact developer benchmark PIDs, including compressed macOS footprint."""
import ctypes, json, pathlib, subprocess, time
root = pathlib.Path(__file__).resolve().parents[2] / 'artifacts/recognition-native-v1'
class Usage(ctypes.Structure):
    _fields_ = [('uuid', ctypes.c_uint8 * 16)] + [(name, ctypes.c_uint64) for name in (
        'user', 'system', 'idle', 'interrupt', 'pageins', 'wired', 'resident', 'footprint',
        'start', 'exit', 'child_user', 'child_system', 'child_idle', 'child_interrupt',
        'child_pageins', 'child_elapsed', 'read', 'written')]
lib = ctypes.CDLL('/usr/lib/libproc.dylib')
lib.proc_pid_rusage.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_void_p]
lib.proc_pid_rusage.restype = ctypes.c_int
stop = root / 'stop-monitor'
stop.unlink(missing_ok=True)
samples = []
started = time.time()
with (root / 'native-memory.jsonl').open('w') as stream:
    while time.time() - started < 900 and not stop.exists():
        try:
            active = json.loads((root / 'active-processes.json').read_text())
            processes = []
            if active['mode'] == 'native':
                for name in ['parentPid', 'nativePid', 'tokenizerPid']:
                    pid = active.get(name)
                    if pid is None: continue
                    usage = Usage()
                    if lib.proc_pid_rusage(pid, 2, ctypes.byref(usage)) == 0:
                        processes.append({'role': name, 'pid': pid, 'residentBytes': usage.resident, 'physicalFootprintBytes': usage.footprint})
            if processes:
                sample = {'time': time.time(), 'processes': processes}
                samples.append(sample)
                stream.write(json.dumps(sample) + '\n'); stream.flush()
        except (OSError, ValueError): pass
        time.sleep(.5)
(root / 'native-memory.json').write_text(json.dumps({'nominalPeriodMs': 500, 'samples': samples}, indent=2) + '\n')

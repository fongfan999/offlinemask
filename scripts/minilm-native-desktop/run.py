"""Run the isolated packaged macOS probe with network access denied and sample RAM."""
import ctypes,json,os,subprocess,time
from pathlib import Path
root=Path(__file__).resolve().parents[2]; work=root/'artifacts/minilm-native-desktop'
paths=json.loads((work/'paths.json').read_text()); data=Path(paths['dataRoot']); report=data/'minilm-desktop-report.json'
assert not report.exists(), 'Archive earlier completed report before a new run'
app=root/'src-tauri/target/release/bundle/macos/OfflineMask MiniLM Native Probe.app/Contents/MacOS/offlinemask'
assert app.is_file()
class Usage(ctypes.Structure):
    _fields_=[('uuid',ctypes.c_uint8*16)]+[(n,ctypes.c_uint64) for n in ['user','system','idle1','idle2','pageins','wired','resident','footprint','start','exit','childuser','childsystem','childidle1','childidle2','childpageins','childelapsed','diskread','diskwrite']]
lib=ctypes.CDLL('/usr/lib/libproc.dylib');lib.proc_pid_rusage.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_void_p];lib.proc_pid_rusage.restype=ctypes.c_int

def snapshot():
    rows={}
    for line in subprocess.check_output(['ps','-axo','pid=,ppid=,rss=,comm='],text=True).splitlines():
        parts=line.strip().split(None,3)
        if len(parts)==4:
            pid,parent,rss,command=parts
            if 'com.apple.WebKit.' in command or str(app) in command:
                usage=Usage();fp=usage.footprint if lib.proc_pid_rusage(int(pid),2,ctypes.byref(usage))==0 else None
                rows[int(pid)]={'pid':int(pid),'parent':int(parent),'rssKiB':int(rss),'footprintBytes':fp,'command':command}
    return rows
baseline=snapshot();samples=[];observed={}
profile='(version 1) (allow default) (deny network*)'
(work/'network-deny.sb').write_text(profile+'\n')
with (work/'app.log').open('x') as log:
    started=time.monotonic()
    process=subprocess.Popen(['/usr/bin/sandbox-exec','-p',profile,str(app)],stdout=log,stderr=log)
    while process.poll() is None and time.monotonic()-started<600:
        now=snapshot()
        for pid,row in now.items():
            if pid not in baseline:observed[pid]=row
        active=[row for pid,row in now.items() if pid in observed]
        samples.append({'elapsedMs':(time.monotonic()-started)*1000,'rssKiB':sum(p['rssKiB'] for p in active),'footprintBytes':sum(p['footprintBytes'] or 0 for p in active),'pids':[p['pid'] for p in active]})
        time.sleep(.2)
    timeout=process.poll() is None
    if timeout:process.terminate()
    code=process.wait(timeout=15)
output={'exitCode':code,'timeout':timeout,'networkProfile':profile,'samplePeriodMs':200,'baselinePids':list(baseline),'observed':list(observed.values()),'samples':samples,'peakRssKiB':max((s['rssKiB'] for s in samples),default=0),'peakFootprintBytes':max((s['footprintBytes'] for s in samples),default=0),'memoryLimit':'Includes all newly observed WebKit processes during this run; conservative attribution, not precise ownership. Sampling may miss transient peaks.'}
with(work/'launch.json').open('x')as f:json.dump(output,f,indent=2)
if report.exists():
    with(work/'report.json').open('x')as f:f.write(report.read_text())
print(json.dumps({k:v for k,v in output.items() if k not in ['samples','observed','baselinePids']}),flush=True)
print('reportPresent',report.exists(),flush=True)

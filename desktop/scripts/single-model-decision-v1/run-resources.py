"""Two isolated offline developer processes; no private input or global settings changes."""
import ctypes, hashlib, json, os, platform, shutil, subprocess, sys, time
from pathlib import Path
root=Path(__file__).resolve().parents[2]
work=root/'artifacts/single-model-decision-v1'
protocol=json.loads((root/'docs/evaluations/single-model-decision-v1/resources-protocol.json').read_text())
for file,digest in protocol['files'].items():
    assert hashlib.sha256((root/file).read_bytes()).hexdigest()==digest,file
class Usage(ctypes.Structure):
    _fields_=[('uuid',ctypes.c_uint8*16)]+[(n,ctypes.c_uint64) for n in ['user','system','idle1','idle2','pageins','wired','resident','footprint','start','exit','childuser','childsystem','childidle1','childidle2','childpageins','childelapsed','diskread','diskwrite']]
lib=ctypes.CDLL('/usr/lib/libproc.dylib')
lib.proc_pid_rusage.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_void_p]
lib.proc_pid_rusage.restype=ctypes.c_int
profile='(version 1) (allow default) (deny network*)'
for run in ['1','2']:
    assert not (work/f'resources-{run}.json').exists()
    samples=[];seen=set();started=time.monotonic()
    with (work/f'resources-{run}.log').open('x') as log:
        process=subprocess.Popen(['/usr/bin/sandbox-exec','-p',profile,shutil.which('node'),str(root/'scripts/single-model-decision-v1/resources.mjs'),run],cwd=root,stdout=log,stderr=log)
        while process.poll() is None and time.monotonic()-started<300:
            rows={}
            for line in subprocess.check_output(['ps','-axo','pid=,ppid=,rss='],text=True).splitlines():
                pid,parent,rss=map(int,line.split());rows[pid]=(parent,rss)
            owned={process.pid}
            while True:
                new=owned|{pid for pid,(parent,_) in rows.items() if parent in owned}
                if new==owned:break
                owned=new
            total_rss=0;total_fp=0;measured=0
            for pid in owned&rows.keys():
                total_rss+=rows[pid][1]*1024;u=Usage()
                if lib.proc_pid_rusage(pid,2,ctypes.byref(u))==0:total_fp+=u.footprint;measured+=1
            seen|=owned
            samples.append({'elapsedMs':(time.monotonic()-started)*1000,'rssBytes':total_rss,'footprintBytes':total_fp,'pids':sorted(owned),'measuredPids':measured})
            time.sleep(.1)
        timeout=process.poll() is None
        if timeout:process.terminate()
        code=process.wait(timeout=15)
    result={'run':run,'exitCode':code,'timeout':timeout,'elapsedSeconds':time.monotonic()-started,
        'networkProfile':profile,'platform':platform.platform(),'machine':platform.machine(),
        'hardware':subprocess.check_output(['sysctl','-n','machdep.cpu.brand_string'],text=True).strip(),
        'physicalMemory':int(subprocess.check_output(['sysctl','-n','hw.memsize'],text=True)),
        'peakFootprintBytes':max((s['footprintBytes'] for s in samples),default=0),
        'peakRssBytes':max((s['rssBytes'] for s in samples),default=0),'sampleTargetMs':100,'samples':samples,
        'limits':'Exact observed descendant tree; includes Node and Python tokenizer. Sampling can miss peaks; not a desktop-app footprint.'}
    with (work/f'resources-{run}-monitor.json').open('x') as f:json.dump(result,f,indent=2)
    print(json.dumps({k:v for k,v in result.items() if k!='samples'}),flush=True)
    if code!=0 or timeout:sys.exit(1)

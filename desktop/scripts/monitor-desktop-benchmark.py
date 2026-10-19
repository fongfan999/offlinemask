"""macOS developer-only RSS sampling; run before opening the isolated benchmark app."""
import ctypes, json, pathlib, subprocess, time
root=pathlib.Path(__file__).resolve().parents[1]/'artifacts/native-benchmark'
root.mkdir(parents=True,exist_ok=True)
stop=root/'stop-monitor'
stop.unlink(missing_ok=True)
# macOS SDK sys/resource.h rusage_info_v2: physical footprint includes compressed
# pages, which RSS alone misses under pressure. No task-port entitlement needed.
class RUsageInfoV2(ctypes.Structure):
    _fields_ = [('uuid', ctypes.c_uint8 * 16)] + [(name, ctypes.c_uint64) for name in (
        'user_time', 'system_time', 'pkg_idle_wkups', 'interrupt_wkups', 'pageins',
        'wired_size', 'resident_size', 'phys_footprint', 'proc_start_abstime',
        'proc_exit_abstime', 'child_user_time', 'child_system_time', 'child_pkg_idle_wkups',
        'child_interrupt_wkups', 'child_pageins', 'child_elapsed_abstime',
        'diskio_bytesread', 'diskio_byteswritten')]
libproc = ctypes.CDLL('/usr/lib/libproc.dylib')
libproc.proc_pid_rusage.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_void_p]
libproc.proc_pid_rusage.restype = ctypes.c_int
def footprint(pid):
    usage = RUsageInfoV2()
    return usage.phys_footprint if libproc.proc_pid_rusage(pid, 2, ctypes.byref(usage)) == 0 else None
def snapshot():
    result={}
    for line in subprocess.check_output(['ps','-axo','pid=,ppid=,rss=,comm='],text=True).splitlines():
        fields=line.strip().split(None,3)
        if len(fields)==4:
            pid,ppid,rss,command=fields
            if 'com.apple.WebKit.' in command or 'OfflineMask Benchmark.app/' in command:
                result[int(pid)]={'pid':int(pid),'ppid':int(ppid),'rssKiB':int(rss),'command':command, 'physicalFootprintBytes':footprint(int(pid))}
    return result
baseline=snapshot(); samples=[]; observed={}; app_start=None
started=time.time()
stream=(root/'memory-samples.jsonl').open('w')
while time.time()-started<900 and not stop.exists():
    current=snapshot()
    app=[p for p in current.values() if 'OfflineMask Benchmark.app/' in p['command']]
    if app and app_start is None: app_start=time.time();print('Benchmark app observed',app[0]['pid'],flush=True)
    if app_start is not None:
        for pid,p in current.items():
            if pid not in baseline and (pid in observed or time.time()-app_start<30):observed[pid]=p
        processes=[current[pid] for pid in observed if pid in current]
        sample={'time':time.time(),'rssKiB':sum(p['rssKiB'] for p in processes),'physicalFootprintBytes':sum(p['physicalFootprintBytes'] for p in processes) if all(p['physicalFootprintBytes'] is not None for p in processes) else None,'processes':processes}
        samples.append(sample)
        stream.write(json.dumps(sample)+'\n');stream.flush()
    time.sleep(.5)
stream.close()
report={'peakSampledPhysicalFootprintBytes':max((s['physicalFootprintBytes'] or 0 for s in samples),default=0),'samplePeriodMs':500,'baselinePids':list(baseline),'observedProcesses':list(observed.values()),'peakSampledRssKiB':max((s['rssKiB'] for s in samples),default=0),'samples':samples}
(root/'memory.json').write_text(json.dumps(report,indent=2)+'\n')
print('Saved memory samples; peak KiB:',report['peakSampledRssKiB'],flush=True)

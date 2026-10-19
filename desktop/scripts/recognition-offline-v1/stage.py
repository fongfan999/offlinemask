"""Wrap a disposable QA .app in IP denial; launch the result using LaunchServices.
The embedded Tauri identifier/data directory is unchanged. NEVER use a user app.
"""
import pathlib, shutil, plistlib, subprocess, argparse, shlex
p=argparse.ArgumentParser(); p.add_argument('source'); p.add_argument('destination'); args=p.parse_args()
source=pathlib.Path(args.source).resolve(); out=pathlib.Path(args.destination).resolve()
info=plistlib.loads((source/'Contents/Info.plist').read_bytes())
if 'QA' not in info.get('CFBundleName','') and 'Sidecar UI' not in info.get('CFBundleName',''):
    raise SystemExit('Only disposable QA/Sidecar UI bundles are allowed')
if out.exists(): raise SystemExit('Destination must be new')
shutil.copytree(source,out)
info['CFBundleIdentifier']='dev.offlinemask.offlineverified20260921'
info['CFBundleName']='OfflineMask Offline Verified'; info['CFBundleDisplayName']=info['CFBundleName']
(out/'Contents/Info.plist').write_bytes(plistlib.dumps(info))
exe=out/'Contents/MacOS'/info['CFBundleExecutable']; real=exe.with_name('offlinemask-probe-bin'); exe.rename(real)
probe=exe.with_name('network-probe')
subprocess.run(['clang','-Wall','-Wextra','-Werror',str(pathlib.Path(__file__).with_name('network-probe.c')),'-o',str(probe)],check=True)
profile='(version 1) (allow default) (deny network-outbound (remote ip "*:*")) (deny network-inbound (local ip "*:*"))'
report=out.parent/'network-denial.json'
exe.write_text('#!/bin/sh\nexec /usr/bin/sandbox-exec -p '+shlex.quote(profile)+' '+shlex.quote(str(probe))+' '+shlex.quote(str(real))+' '+shlex.quote(str(report))+'\n'); exe.chmod(0o755)
subprocess.run(['/usr/bin/codesign','--force','--deep','--sign','-',str(out)],check=True)
print(out)

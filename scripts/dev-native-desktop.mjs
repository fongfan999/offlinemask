// `tauri dev` with native recognition (decision 0077), so development runs at release
// speed instead of the single-thread WASM backend. Uses the opt-in sidecar feature,
// which checks the pinned runtime hash before every load. No models are copied.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import runtimes from './native-runtimes.json' with { type: 'json' };
const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = runtimes.targets[`${process.platform}-${process.arch}`];
if (!runtime) throw Error(`Native recognition runs only on ${Object.keys(runtimes.targets).join(', ')}; use desktop:dev`);
const windows = process.platform === 'win32';
const stage = join(root, 'artifacts/native-dev');
const native = join(stage, 'native');
await mkdir(native, { recursive: true });
const requireTransformers = createRequire(import.meta.resolve('@huggingface/transformers'));
const source = join(dirname(requireTransformers.resolve('onnxruntime-node')), '..', 'bin/napi-v6', runtime.packagePath, runtime.file);
const bytes = await readFile(source);
if (bytes.length !== runtime.bytes || createHash('sha256').update(bytes).digest('hex') !== runtime.sha256) throw Error('Pinned native runtime verification failed');
await cp(source, join(native, runtime.file));
const shipped = [runtime.file];
if (windows) {
  // Same app-local C++ runtime as release builds.
  const vswhere = join(process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)', 'Microsoft Visual Studio/Installer/vswhere.exe');
  const install = execFileSync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { encoding: 'utf8' }).trim();
  const redist = join(install, 'VC/Redist/MSVC');
  const version = (await readdir(redist)).filter(name => /^\d+\.\d+\.\d+$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
  const crt = (await readdir(join(redist, version, 'x64'))).find(name => /^Microsoft\.VC\d+\.CRT$/.test(name));
  for (const name of runtime.cppRuntime) {
    await cp(join(redist, version, 'x64', crt, name), join(native, name));
    shipped.push(name);
  }
}
// Release profile: the helper runs inference, and a debug build would hide the speed-up.
execFileSync('cargo', ['build', '--manifest-path', join(root, 'src-tauri/Cargo.toml'), '--locked', '--release', '--features', 'native-inference-prototype', '--bin', 'recognition-sidecar'], { cwd: root, stdio: 'inherit' });
const helper = windows ? 'recognition-sidecar.exe' : 'recognition-sidecar';
await cp(join(root, 'src-tauri/target/release', helper), join(native, helper));
shipped.push(helper);
await writeFile(join(stage, 'tauri.conf.json'), JSON.stringify({ bundle: { resources: Object.fromEntries(shipped.map(name => [join(native, name), 'native/' + name])) } }, null, 2) + '\n');
const result = spawnSync('pnpm', ['exec', 'tauri', 'dev', '--features', 'recognition-native-sidecar', '--config', join(stage, 'tauri.conf.json')], {
  stdio: 'inherit',
  shell: windows,
  env: { ...process.env, VITE_NATIVE_RECOGNITION: '1' },
});
process.exit(result.status ?? 1);

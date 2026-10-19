// Package the native recognition provider for a qualified target (decisions 0049, 0077)
// without developer model fixtures. Build-time only: no model downloads, network
// checks, or user-data access.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';
import runtimes from './native-runtimes.json' with { type: 'json' };
const root = fileURLToPath(new URL('../', import.meta.url));
const qa = process.argv.includes('--qa');
if (process.argv.slice(2).some(arg => arg !== '--qa')) throw Error('Only --qa is supported');
const target = `${process.platform}-${process.arch}`;
const runtime = runtimes.targets[target];
if (!runtime) throw Error(`Native recognition is qualified only on ${Object.keys(runtimes.targets).join(', ')}`);
const windows = process.platform === 'win32';
const stage = join(root, 'artifacts/native-desktop');
const native = join(stage, 'native');
const requireTransformers = createRequire(import.meta.resolve('@huggingface/transformers'));
const entry = requireTransformers.resolve('onnxruntime-node');
const source = join(dirname(entry), '..', 'bin/napi-v6', runtime.packagePath, runtime.file);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = await readFile(source);
if (bytes.length !== runtime.bytes || digest(bytes) !== runtime.sha256) throw Error('Pinned native runtime verification failed');
await mkdir(native, { recursive: true });
await cp(source, join(native, runtime.file));
const notices = {
  'LICENSE.txt': '2f07c72751aed99790b8a4869cf2311df85a860b22ded05fa22803587a48922c',
  'ThirdPartyNotices.txt': '0e07b95f3a8d6230037707c5c4a2b554d12c4cb67369669ac255635528ffcee2',
};
for (const [name, hash] of Object.entries(notices)) {
  if (digest(await readFile(join(root, '../docs/licenses/onnxruntime-1.24.3', name))) !== hash) throw Error('Runtime notice verification failed');
}

// ONNX Runtime for Windows links the Visual C++ C++ runtime dynamically. Copy the
// redistributable DLLs from the build machine's Visual Studio next to it, so the
// helper finds them in its own directory on PCs without the Redistributable.
const companions = [];
if (windows) {
  const vswhere = join(process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)', 'Microsoft Visual Studio/Installer/vswhere.exe');
  const install = execFileSync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { encoding: 'utf8' }).trim();
  const redist = join(install, 'VC/Redist/MSVC');
  const versions = (await readdir(redist)).filter(name => /^\d+\.\d+\.\d+$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const version = versions.at(-1);
  if (!version) throw Error('Visual C++ redistributable files not found');
  const crt = (await readdir(join(redist, version, 'x64'))).find(name => /^Microsoft\.VC\d+\.CRT$/.test(name));
  if (!crt) throw Error('Visual C++ CRT folder not found');
  for (const name of runtime.cppRuntime) {
    const path = join(redist, version, 'x64', crt, name);
    if (!existsSync(path)) throw Error(`Missing ${name} in the Visual C++ redistributable`);
    await cp(path, join(native, name));
    companions.push({ name, sha256: digest(await readFile(path)), from: `VC Redist ${version}/${crt}` });
  }
}

execFileSync('cargo', ['build', '--manifest-path', join(root, 'src-tauri/Cargo.toml'), '--locked', '--release', '--features', 'native-inference-prototype', '--bin', 'recognition-sidecar'], { cwd: root, stdio: 'inherit' });
const helper = windows ? 'recognition-sidecar.exe' : 'recognition-sidecar';
await cp(join(root, 'src-tauri/target/release', helper), join(native, helper));
const signingIdentity = process.env.APPLE_SIGNING_IDENTITY || '-';
if (process.platform === 'darwin') {
  // Resource executables are not automatically signed like Tauri externalBin files.
  // Sign inner code first so Developer ID builds can notarize the complete bundle.
  for (const file of [runtime.file, helper]) {
    // Ad hoc code has no Team ID, so hardened library validation cannot match it.
    // Developer ID builds sign both files with the same team and enable runtime.
    execFileSync('/usr/bin/codesign', ['--force', '--options', signingIdentity === '-' ? '0' : 'runtime', signingIdentity === '-' ? '--timestamp=none' : '--timestamp', '--sign', signingIdentity, join(native, file)], { stdio: 'inherit' });
  }
}
const frontend = join(stage, 'frontend');
await build({ configFile: join(root, 'vite.config.ts'), define: { 'import.meta.env.VITE_NATIVE_RECOGNITION': JSON.stringify('1') }, build: { outDir: frontend, emptyOutDir: true, copyPublicDir: false } });
// Native graphs never use the browser WASM binary. Neither engine includes weights.
for (const name of await readdir(join(root, 'public'))) {
  if (!['models', 'runtime'].includes(name)) await cp(join(root, 'public', name), join(frontend, name), { recursive: true });
}
const shipped = [runtime.file, ...companions.map(file => file.name), helper];
const config = {
  ...(qa ? { productName: 'OfflineMask Release QA', identifier: 'dev.offlinemask.releaseqa20260921' } : {}),
  build: { beforeBuildCommand: '', frontendDist: frontend },
  bundle: {
    ...(process.platform === 'darwin' ? { macOS: { signingIdentity } } : {}),
    resources: {
      ...Object.fromEntries(shipped.map(name => [join(native, name), 'native/' + name])),
      [join(root, '../docs/licenses/')]: 'licenses/',
    },
  },
};
await writeFile(join(stage, 'tauri.conf.json'), JSON.stringify(config, null, 2) + '\n');
// Windows release builds compile these hashes in and check them before starting the helper.
const hashes = await Promise.all(shipped.map(async name => `${name}=${digest(await readFile(join(native, name)))}`));
await writeFile(join(stage, 'native-sha256.txt'), hashes.join(',') + '\n');
await writeFile(join(stage, 'provenance.json'), JSON.stringify({ platform: process.platform, arch: process.arch, runtime, companions, notices, helper: { name: helper, sha256: digest(await readFile(join(native, helper))) }, modelsBundled: false, qa }, null, 2) + '\n');
console.log('Prepared native desktop bundle configuration at artifacts/native-desktop/tauri.conf.json');

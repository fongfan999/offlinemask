// Package the validated macOS arm64 provider without developer model fixtures.
// Build-time only: no model downloads, network checks, or user-data access.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';
import runtime from './native-prototype/runtime-manifest.json' with { type: 'json' };
const root = fileURLToPath(new URL('../', import.meta.url));
const qa = process.argv.includes('--qa');
if (process.argv.slice(2).some(arg => arg !== '--qa')) throw Error('Only --qa is supported');
if (process.platform !== runtime.platform || process.arch !== runtime.arch) throw Error('Native recognition is qualified only on macOS arm64');
const stage = join(root, 'artifacts/native-desktop');
const requireTransformers = createRequire(import.meta.resolve('@huggingface/transformers'));
const entry = requireTransformers.resolve('onnxruntime-node');
const source = join(dirname(entry), '..', 'bin/napi-v6', runtime.platform, runtime.arch, runtime.file);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = await readFile(source);
if (bytes.length !== runtime.bytes || digest(bytes) !== runtime.sha256) throw Error('Pinned native runtime verification failed');
await mkdir(join(stage, 'native'), { recursive: true });
await cp(source, join(stage, 'native', runtime.file));
const notices = {
  'LICENSE.txt': '2f07c72751aed99790b8a4869cf2311df85a860b22ded05fa22803587a48922c',
  'ThirdPartyNotices.txt': '0e07b95f3a8d6230037707c5c4a2b554d12c4cb67369669ac255635528ffcee2',
};
for (const [name, hash] of Object.entries(notices)) {
  if (digest(await readFile(join(root, 'docs/licenses/onnxruntime-1.24.3', name))) !== hash) throw Error('Runtime notice verification failed');
}
execFileSync('cargo', ['build', '--manifest-path', join(root, 'src-tauri/Cargo.toml'), '--locked', '--release', '--features', 'native-inference-prototype', '--bin', 'recognition-sidecar'], { cwd: root, stdio: 'inherit' });
await cp(join(root, 'src-tauri/target/release/recognition-sidecar'), join(stage, 'native/recognition-sidecar'));
// Resource executables are not automatically signed like Tauri externalBin files.
// Sign inner code first so Developer ID builds can notarize the complete bundle.
const signingIdentity = process.env.APPLE_SIGNING_IDENTITY || '-';
for (const file of [runtime.file, 'recognition-sidecar']) {
  // Ad hoc code has no Team ID, so hardened library validation cannot match it.
  // Developer ID builds sign both files with the same team and enable runtime.
  execFileSync('/usr/bin/codesign', ['--force', '--options', signingIdentity === '-' ? '0' : 'runtime', signingIdentity === '-' ? '--timestamp=none' : '--timestamp', '--sign', signingIdentity, join(stage, 'native', file)], { stdio: 'inherit' });
}
const frontend = join(stage, 'frontend');
await build({ configFile: join(root, 'vite.config.ts'), define: { 'import.meta.env.VITE_NATIVE_RECOGNITION': JSON.stringify('1') }, build: { outDir: frontend, emptyOutDir: true, copyPublicDir: false } });
// Native graphs never use the browser WASM binary. Neither engine includes weights.
for (const name of await readdir(join(root, 'public'))) {
  if (!['models', 'runtime'].includes(name)) await cp(join(root, 'public', name), join(frontend, name), { recursive: true });
}
const config = {
  ...(qa ? { productName: 'OfflineMask Release QA', identifier: 'dev.offlinemask.releaseqa20260921' } : {}),
  build: { beforeBuildCommand: '', frontendDist: frontend },
  bundle: { macOS: { signingIdentity }, resources: {
    [join(stage, 'native', runtime.file)]: 'native/' + runtime.file,
    [join(stage, 'native/recognition-sidecar')]: 'native/recognition-sidecar',
    [join(root, 'docs/licenses/')]: 'licenses/',
  } },
};
await writeFile(join(stage, 'tauri.conf.json'), JSON.stringify(config, null, 2) + '\n');
await writeFile(join(stage, 'provenance.json'), JSON.stringify({ platform: process.platform, arch: process.arch, runtime, notices, helper: { sha256: digest(await readFile(join(stage, 'native/recognition-sidecar'))) }, modelsBundled: false, qa }, null, 2) + '\n');
console.log('Prepared native desktop bundle configuration at artifacts/native-desktop/tauri.conf.json');

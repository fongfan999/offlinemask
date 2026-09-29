// Full existing UI, isolated identity, opt-in native provider. No model downloads.
import { build } from 'vite';
import { cp, mkdir, readFile, readdir, writeFile, link } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { nativeRuntimePath } from '../recognition-native-v1/provider.mjs';
const root = new URL('../../', import.meta.url).pathname;
const out = root + 'artifacts/recognition-sidecar-v1/ui';
await build({ configFile: root + 'vite.config.ts', define: { 'import.meta.env.VITE_NATIVE_RECOGNITION': JSON.stringify('1') }, build: { outDir: out, emptyOutDir: true, copyPublicDir: false } });
for (const name of await readdir(root + 'public')) if (name !== 'models') await cp(join(root, 'public', name), join(out, name), { recursive: true });
const identifier = 'dev.offlinemask.recognition.sidecarui20260921';
const dataRoot = join(homedir(), 'Library/Application Support', identifier, 'models/vietnamese-pii-v1');
const pack = JSON.parse(await readFile(root + 'scripts/release-pack-v1.json'));
for (const asset of pack.assets) {
  const source = join(root, 'artifacts/recognition-production-v1/models', asset.directory, asset.name);
  const bytes = await readFile(source);
  if (bytes.length !== asset.bytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw Error('Local fixture pack mismatch');
  const target = join(dataRoot, asset.directory, asset.name);
  await mkdir(join(target, '..'), { recursive: true });
  await link(source, target).catch(error => { if (error.code !== 'EEXIST') throw error; });
}
const runtime = await nativeRuntimePath();
await writeFile(root + 'artifacts/recognition-sidecar-v1/ui.tauri.conf.json', JSON.stringify({
  productName: 'OfflineMask Sidecar UI', identifier,
  build: { beforeBuildCommand: '', frontendDist: out },
  bundle: { resources: { [runtime]: 'native/libonnxruntime.1.24.3.dylib', [root + 'src-tauri/target/release/recognition-sidecar']: 'native/recognition-sidecar' } },
  app: { windows: [{ label: 'main', title: 'OfflineMask Sidecar UI', width: 1200, height: 940, minWidth: 640, minHeight: 560 }] },
}, null, 2));

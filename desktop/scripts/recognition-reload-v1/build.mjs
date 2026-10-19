import { build } from 'vite';
import { cp, mkdir, readFile, writeFile, link } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../../', import.meta.url).pathname;
const out = root + 'artifacts/recognition-reload-v1/frontend';
await build({ configFile: false, root: root + 'scripts/recognition-reload-v1', build: { outDir: out, emptyOutDir: true, copyPublicDir: false } });
await cp(root + 'public/runtime', out + '/runtime', { recursive: true });
const identifier = 'dev.offlinemask.recognition.reload20260921';
const dataRoot = join(homedir(), 'Library/Application Support', identifier, 'models/vietnamese-pii-v1');
const pack = JSON.parse(await readFile(root + 'scripts/release-pack-v1.json', 'utf8'));
for (const asset of pack.assets) {
  const source = join(root, 'artifacts/recognition-production-v1/models', asset.directory, asset.name);
  const bytes = await readFile(source);
  if (bytes.length !== asset.bytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw Error('Local fixture pack mismatch');
  const target = join(dataRoot, asset.directory, asset.name);
  await mkdir(join(target, '..'), { recursive: true });
  try { await link(source, target); } catch (error) { if (error.code !== 'EEXIST') throw error; }
}
await writeFile(root + 'artifacts/recognition-reload-v1/tauri.conf.json', JSON.stringify({
  productName: 'OfflineMask Reload', identifier,
  build: { beforeBuildCommand: '', frontendDist: out },
  app: { windows: [{ label: 'main', title: 'OfflineMask Reload', width: 1000, height: 850 }] },
}, null, 2));

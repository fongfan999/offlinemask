import { nativeRuntimePath } from '../recognition-native-v1/provider.mjs';
import { build } from 'vite';
import { cp, mkdir, readFile, writeFile, link } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../../', import.meta.url).pathname;
const out = root + 'artifacts/recognition-sidecar-v1/frontend';
await build({ define: { 'import.meta.env.VITE_NATIVE_RECOGNITION': JSON.stringify('1') }, configFile: false, root: root + 'scripts/recognition-sidecar-v1', build: { outDir: out, emptyOutDir: true, copyPublicDir: false } });
const runtime = await nativeRuntimePath();
const identifier = 'dev.offlinemask.recognition.sidecar20260921';
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
await writeFile(root + 'artifacts/recognition-sidecar-v1/tauri.conf.json', JSON.stringify({
  productName: 'OfflineMask Sidecar QA', identifier,
  build: { beforeBuildCommand: '', frontendDist: out },
  bundle: { resources: { [runtime]: 'native/libonnxruntime.1.24.3.dylib', [root + 'src-tauri/target/release/recognition-sidecar']: 'native/recognition-sidecar' } },
  app: { windows: [{ label: 'main', title: 'OfflineMask Sidecar QA', width: 1000, height: 850 }] },
}, null, 2));

const saved = JSON.parse(await readFile(root + 'docs/evaluations/recognition-native-v1/results.json'));
const cases = JSON.parse(await readFile(root + 'artifacts/quality-first-v1/cases.json'));
if (cases.length !== saved.outcomes.length || cases.some((fixture, i) => fixture.id !== saved.outcomes[i].id)) throw Error('Replay fixture ordering differs');
await writeFile(out + '/replay.json', JSON.stringify(cases.map((fixture, i) => ({ id: fixture.id, text: fixture.text, expected: { predictions: saved.outcomes[i].result.predictions, selectedPredictions: saved.outcomes[i].result.selectedPredictions } }))));

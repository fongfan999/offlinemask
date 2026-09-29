import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../artifacts/alternative-models/', import.meta.url));
const source = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
async function describe(directory, names) {
  const files = {};
  for (const name of names) {
    const path = join(root, directory, name), hash = createHash('sha256');
    for await (const part of createReadStream(path)) hash.update(part);
    files[name] = { size: (await stat(path)).size, sha256: hash.digest('hex') };
  }
  return files;
}
for (const model of source.models) {
  assert.deepEqual(await describe(model.directory, Object.keys(model.files)), model.files, 'Candidate source hash mismatch');
}
const variants = {};
for (const [variant, directory, filename] of [['bigmed', 'bigmed', 'model_int8.onnx'],
  ['underthesea', 'underthesea', 'model_int8.onnx'], ['underthesea-fp32', 'underthesea', 'model.onnx']]) {
  const files = await describe(directory, [filename, 'config.json', 'tokenizer.json', 'tokenizer_config.json']);
  variants[variant] = { directory, files, downloadBytes: Object.values(files).reduce((sum, file) => sum + file.size, 0) };
}
const exportScriptSha256 = createHash('sha256').update(await readFile(new URL('./export-underthesea.py', import.meta.url))).digest('hex');
const manifest = { sources: source.models, exportScriptSha256,
  conversionRequirements: await readFile(join(root, 'conversion-requirements.txt'), 'utf8'), variants };
await writeFile(join(root, 'evaluation-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Verified sources and recorded local export fingerprints. Candidate sizes exclude source-only training weights.');

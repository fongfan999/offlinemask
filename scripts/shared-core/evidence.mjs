import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
export const root = fileURLToPath(new URL('../../', import.meta.url));
export const protocolPath = join(root, 'docs/evaluations/shared-core-protocol-v2.json');
export const outputRoot = join(root, 'artifacts/shared-core-v2');
export const hash = data => createHash('sha256').update(data).digest('hex');
export const readJson = async file => JSON.parse(await readFile(file, 'utf8'));

export async function verifyProtocol() {
  const protocol = await readJson(protocolPath);
  for (const [file, expected] of Object.entries(protocol.files)) assert.equal(hash(await readFile(join(root, file))), expected, `Changed frozen source: ${file}`);
  for (const [file, expected] of Object.entries(protocol.fixtures)) assert.equal(hash(await readFile(join(root, 'tests/fixtures', file))), expected, `Changed fixture: ${file}`);
  return protocol;
}

export async function verifyAssets(protocol, variant) {
  const assets = protocol.assets[variant];
  assert.ok(assets, 'Unpinned candidate');
  for (const asset of assets) for (const [file, expected] of Object.entries(asset.files)) {
    const path = join(root, asset.directory, file);
    assert.equal((await stat(path)).size, expected.size, `Wrong file size: ${file}`);
    const digest = createHash('sha256');
    for await (const chunk of createReadStream(path)) digest.update(chunk);
    assert.equal(digest.digest('hex'), expected.sha256, `Wrong file hash: ${file}`);
  }
}

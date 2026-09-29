// Explicit developer verification only. Never imported by the application or build.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const inventory = JSON.parse(await readFile('artifacts/r2-v1-objects.json', 'utf8'));
const rows = [];
for (const object of inventory.objects) {
  const url = `${inventory.base}/${object.key}`;
  // Exercise the same query + Range convention as the native resume downloader.
  const start = Math.min(17, object.bytes - 1), end = Math.min(start + 127, object.bytes - 1);
  const range = await fetch(`${url}?offset=${start}`, { headers: { Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(60_000) });
  if (range.status !== 206 || range.headers.get('content-range') !== `bytes ${start}-${end}/${object.bytes}`) throw Error(`Range unsupported: ${object.key} (${range.status})`);
  if ((await range.arrayBuffer()).byteLength !== end - start + 1) throw Error('Range size mismatch');
  const response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
  if (!response.ok || !response.body) throw Error(`Download failed: ${object.key} (${response.status})`);
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of response.body) { hash.update(chunk); bytes += chunk.byteLength; }
  const sha256 = hash.digest('hex');
  if (bytes !== object.bytes || sha256 !== object.sha256) throw Error(`Published bytes differ: ${object.key}`);
  rows.push({ ...object, status: response.status, rangeStatus: range.status, verified: true });
  console.log(`Verified ${rows.length}/${inventory.objects.length}: ${object.key}`);
}
const receipt = { verifiedAt: new Date().toISOString(), base: inventory.base, method: 'Full public HTTPS downloads: exact byte lengths and SHA-256; nonzero-offset Range requests.', totalBytes: rows.reduce((n, r) => n + r.bytes, 0), objects: rows };
await writeFile('docs/evaluations/pack-compression-v1/r2-public-verification.json', JSON.stringify(receipt, null, 2) + '\n');

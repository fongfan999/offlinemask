import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseRecord } from '../detector-feasibility/corpus.mjs';
const root = new URL('../../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const frozen = await read('docs/evaluations/detector-corpus-v2/results.json');
for (const name of ['corpus.json', 'review-ledger.json']) assert.equal(hash(await readFile(new URL(`artifacts/detector-corpus-v2/${name}`, root))), frozen.outputHashes[name]);
const rows = await read('artifacts/detector-corpus-v2/corpus.json');
const capabilities = await read('docs/evaluations/detector-feasibility/capabilities.json');
assert.equal(hash(await readFile(new URL('docs/evaluations/detector-feasibility/capabilities.json', root))), frozen.sourceHashes['docs/evaluations/detector-feasibility/capabilities.json']);
const ledger = await read('artifacts/detector-corpus-v2/review-ledger.json');
const data = { rows: rows.map(row => { const parsed = parseRecord(row, capabilities); return {
  id: row.id, text: parsed.text, entities: parsed.entities, split: row.split, author: row.provenance.author, rationale: row.rationale,
}; }), ledger };
const state = (await readFile(new URL('scripts/review-corpus/state.mjs', root), 'utf8')).replace(/^export /gm, '');
const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const html = (await readFile(new URL('scripts/review-corpus/page.html', root), 'utf8')).replace('/*__STATE__*/', () => state).replace('/*__DATA__*/', () => json);
await writeFile(new URL('artifacts/detector-corpus-v2/review.html', root), html, { flag: 'wx' });
console.log('Created local review page for 161 examples. Existing pending ledger unchanged.');

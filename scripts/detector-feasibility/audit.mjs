import { readFile, writeFile } from 'node:fs/promises';
import { fixtures } from '../context-fields/common.mjs';
import { auditCorpus } from './corpus.mjs';
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const capabilities = await read('../../docs/evaluations/detector-feasibility/capabilities.json');
const rows = await read('../../tests/fixtures/detector-feasibility/development-seed.json');
const report = auditCorpus(rows, capabilities, await fixtures());
await writeFile(new URL('../../artifacts/detector-feasibility/corpus-audit.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ validStructure: report.validStructure, pilotReady: report.pilotReady, composition: report.composition, blockers: report.blockers }, null, 2));

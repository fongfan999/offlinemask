import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fixtures } from '../context-fields/common.mjs';
import { parseRecord } from '../detector-feasibility/corpus.mjs';
const root = new URL('../../', import.meta.url);
const read = async p => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const capabilities = await read('docs/evaluations/detector-feasibility/capabilities.json');
const rows = await fixtures(), seed = await read('tests/fixtures/detector-feasibility/development-seed.json');
const probes = ['', ' ', '\n\t', '📎 Nguyễn Ánh', '📎 Nguyễn Ánh'.normalize('NFD'),
  '漢字 한국어 العربية имя', '[UNK] [CLS] <s> </s> <mask>', 'A\u0000B\u200bC', 'a\u0301'.repeat(30),
  'A B\tC\r\nD', '👩‍👩‍👦 🇻🇳', 'ＢＡＯ ① Ⅳ', 'Tên: Hà Hà; Hà Hà.', '▁abc ▁ xyz',
  '0123456789'.repeat(200), 'Văn bản kiểm tra nguồn. '.repeat(2100).slice(0, 50000)];
const corpus = [...rows.map(r => ({ id: `${r.corpus}/${r.file}/${r.id}`, text: r.text })),
  ...seed.map(r => ({ id: r.id, text: parseRecord(r, capabilities).text })),
  ...probes.map((text, i) => ({ id: `edge-${i}`, text }))];
await mkdir(new URL('artifacts/minilm-admission/', root), { recursive: true });
await writeFile(new URL('artifacts/minilm-admission/corpus.json', root), JSON.stringify(corpus) + '\n', { flag: 'wx' });
console.log(`Prepared ${corpus.length} synthetic tokenizer probes`);

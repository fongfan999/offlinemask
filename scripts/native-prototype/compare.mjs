import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../../artifacts/native-prototype/', import.meta.url);
const modes = await Promise.all(['native', 'cpu', 'wasm'].map(async mode => [mode, JSON.parse(await readFile(new URL(mode + '.json', root), 'utf8'))]));
const data = Object.fromEntries(modes);
function compare(left, right) {
  const a = data[left], b = data[right];
  if (JSON.stringify(a.reports.map(({ file, sha256 }) => ({ file, sha256 }))) !== JSON.stringify(b.reports.map(({ file, sha256 }) => ({ file, sha256 })))) throw Error('Fixture versions differ');
  const differences = [];
  if (a.results.length !== b.results.length) throw Error('Case counts differ');
  for (let index = 0; index < a.results.length; index++) {
    const x = a.results[index], y = b.results[index];
    if (x.id !== y.id || x.file !== y.file) throw Error('Case identity differs');
    if (x.error || y.error || JSON.stringify(x.spans) !== JSON.stringify(y.spans)) differences.push({ file: x.file, id: x.id, [left]: x, [right]: y });
  }
  return { left, right, cases: a.results.length, exactMatches: a.results.length - differences.length, differences };
}
const report = { comparisons: [compare('native', 'cpu'), compare('native', 'wasm')], summaries: Object.fromEntries(modes.map(([mode, result]) => [mode, result.reports])) };
await writeFile(new URL('comparison.json', root), JSON.stringify(report, null, 2) + '\n');
for (const comparison of report.comparisons) console.log(comparison.left, comparison.right, comparison.exactMatches, '/', comparison.cases, 'identical');

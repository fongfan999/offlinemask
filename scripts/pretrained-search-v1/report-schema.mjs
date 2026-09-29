import {readFile,writeFile} from 'node:fs/promises';
const path='docs/evaluations/pretrained-search-v1/schema';
const data=JSON.parse(await readFile(`${path}/results.json`));
const lines=['# GreenNode local evaluation — exact previews\n',
 'Unchanged expectations; contextual labels fixed before inference. Results are synthetic screening evidence, not banking accuracy. The final 12 examples overlap the old regression corpus.\n'];
for(const o of data.outcomes){
 lines.push(`## ${o.corpus} · ${o.id}\n\n\`\`\`text\n${o.text}\n\`\`\`\n`);
 lines.push(`Expected: ${o.result.entities.map(e=>`${JSON.stringify(e.value)} (${e.category})`).join('; ')||'Keep everything'}.\n`);
 lines.push(`Actual: ${o.result.predictions.map(p=>`${JSON.stringify(p.value)} → ${p.findingId}`).join('; ')||'Keep everything'}.\n`);
 lines.push(`Own-category incomplete: ${o.result.entities.filter(e=>!e.selectedFull).map(e=>JSON.stringify(e.value)).join('; ')||'None'}. Extra ordinary lexical positions: ${o.result.falsePositiveChars}. Error: ${o.result.error||'None'}.\n`);
}
await writeFile(`${path}/previews.md`,lines.join('\n'),{flag:'wx'});

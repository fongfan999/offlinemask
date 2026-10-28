// The texts of printed lines for training OfflineMask's line recogniser (decision 0172):
// the synthetic generator's document models (decision 0153) for the seeds named, never
// 1-26 (held out for every measurement), each title, paragraph, "Label: value" field,
// table heading and cell and signature as it would stand on a line or in a cell.
// Nothing is rendered here; train.py draws the lines in fonts the documents do not use.
//
//   mise exec -- node scripts/ocr-train/export-lines.mjs <out.txt> --seeds 100-399
import { writeFileSync } from "node:fs";
import { kinds } from "../../tests/documents/kinds.mjs";
import { random } from "../../tests/documents/data.mjs";

const args = process.argv.slice(2);
const out = args[0];
const range = (args[args.indexOf("--seeds") + 1] ?? "100-399").split("-").map(Number);
if (!out || range[0] <= 26) {
  console.error("Usage: node export-lines.mjs <out.txt> --seeds a-b (a > 26)");
  process.exit(2);
}

const lines = new Set();
const add = (text) => {
  const value = String(text ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
  if (value && value.length <= 120) lines.add(value);
};
/** A paragraph as the lines it wraps into, at a few measures. */
const wrapped = (text, rng) => {
  const words = String(text).split(/\s+/).filter(Boolean);
  for (const measure of [40, 60, 85]) {
    let line = "";
    for (const word of words) {
      if (line && line.length + word.length + 1 > measure) {
        add(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    add(line);
  }
  // And a few runs of words from anywhere in it.
  for (let index = 0; index < 3 && words.length > 1; index++) {
    const start = Math.floor(rng.next() * words.length);
    add(words.slice(start, start + 1 + Math.floor(rng.next() * 8)).join(" "));
  }
};

let documents = 0;
for (let seed = range[0]; seed <= range[1]; seed++) {
  for (const [, { layouts, build }] of Object.entries(kinds))
    for (const layout of layouts)
      for (let variant = 0; variant < 2; variant++) {
        const rng = random(seed * 7919 + documents * 104729 + variant);
        const model = build(rng, layout);
        documents++;
        for (const block of model.blocks) {
          if (block.title) add(block.title);
          if (block.text) wrapped(block.text, rng);
          for (const [label, value] of block.fields ?? []) {
            add(`${label}: ${value}`);
            add(value);
          }
          if (block.table) {
            for (const column of block.table.columns) add(column.title);
            for (const row of [
              ...(block.table.rows ?? []),
              ...(block.table.total ? [block.table.total] : []),
            ])
              for (const cell of [].concat(row)) {
                if (String(cell).length > 30) wrapped(cell, rng);
                else add(cell);
              }
          }
          for (const signature of block.signatures ?? [])
            for (const part of [signature.role, signature.note, signature.name]) add(part);
        }
        for (const value of model.hide) add(typeof value === "string" ? value : value.value);
      }
}
writeFileSync(out, [...lines].join("\n") + "\n");
console.log(
  `${lines.size} lines from ${documents} documents (seeds ${range[0]}-${range[1]}) in ${out}`,
);

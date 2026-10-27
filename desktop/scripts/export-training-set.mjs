// Exports the synthetic document set as training data for the pack's models (decision
// 0163): the generator of 0153/0160 runs for a range of seeds, every document is read by
// the app's own PDF and Word readers, and each paragraph becomes one JSONL record with
// code-point spans labelled PERSON, LOCATION or ORGANIZATION from the hide list, the keep
// list as negatives and the ignore list as spans the loss skips.
//
//   mise exec -- node scripts/export-training-set.mjs <folder> [--train 100-131] [--dev 132-135]
//                                                    [--variants 2] [--keep <documents folder>]
//
// Writes <folder>/train.jsonl, <folder>/dev.jsonl and <folder>/summary.json. Seeds 1–26
// are refused: they are the measured sets (tests/documents/training-set.mjs). The owner's
// private sets are never generated and so never exported. --keep also writes the PDF and
// Word files with their expect.json lists, so `pnpm eval:documents` can read the same
// documents the model trained on.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { syntheticDocuments } from "../tests/documents/generate.mjs";
import { seedRange, trainingRecords, labels } from "../tests/documents/training-set.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const folder = args.find((value, index) => !value.startsWith("--") && !args[index - 1]?.startsWith("--"));
if (!folder) {
  console.error(
    "Usage: node scripts/export-training-set.mjs <folder> [--train a-b] [--dev c-d] [--variants n] [--keep <folder>]",
  );
  process.exit(2);
}
const out = resolve(folder);
const splits = { train: seedRange(option("--train", "100-131")), dev: seedRange(option("--dev", "132-135")) };
const shared = splits.train.filter((seed) => splits.dev.includes(seed));
if (shared.length) throw new Error(`Seeds in both splits: ${shared.join(", ")}`);
const variants = Number(option("--variants", "2"));
const keep = option("--keep");

mkdirSync(out, { recursive: true });
if (keep) rmSync(resolve(keep), { recursive: true, force: true });
const summary = { at: new Date().toISOString(), variants, splits: {} };
const started = performance.now();
for (const [split, seeds] of Object.entries(splits)) {
  const lines = [];
  const totals = { documents: 0, paragraphs: 0, structured: 0, unmatched: [] };
  for (const label of labels) totals[label] = 0;
  for (const seed of seeds) {
    const documents = await syntheticDocuments(seed, { variants });
    if (keep)
      for (const { name, bytes, expect } of documents) {
        const directory = join(resolve(keep), split, `seed-${seed}`, expect.generated.kind);
        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, name), bytes);
        writeFileSync(join(directory, `${name}.expect.json`), JSON.stringify(expect, null, 2) + "\n");
      }
    const { records, tally } = await trainingRecords(documents);
    for (const record of records) lines.push(JSON.stringify(record));
    totals.documents += documents.length;
    totals.paragraphs += records.length;
    for (const label of [...labels, "structured"]) totals[label] += tally[label];
    totals.unmatched.push(...tally.unmatched);
    console.log(
      `${split} seed ${seed}: ${documents.length} documents, ${records.length} paragraphs, ` +
        labels.map((label) => `${label.toLowerCase()} ${tally[label]}`).join(", "),
    );
  }
  writeFileSync(join(out, `${split}.jsonl`), lines.join("\n") + "\n");
  summary.splits[split] = { seeds: `${seeds[0]}-${seeds.at(-1)}`, ...totals };
}
writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
const unmatched = Object.values(summary.splits).reduce((n, s) => n + s.unmatched.length, 0);
console.log(
  `\nWrote ${Object.keys(splits).join(" and ")} to ${out} in ${Math.round((performance.now() - started) / 1000)} s; ` +
    `${unmatched} labelled value(s) not found in the read text (see summary.json).`,
);

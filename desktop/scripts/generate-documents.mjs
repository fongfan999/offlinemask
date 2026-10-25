// Writes the synthetic document set (decision 0153): invented invoices, bank statements,
// contracts and forms in several layouts, as PDF and Word, each with the lists of what
// must be hidden and kept that `pnpm eval:documents` measures.
//
//   mise exec -- node scripts/generate-documents.mjs [folder] [--seed n] [--variants n]
//
// The default folder is artifacts/documents (not committed: the same seed always gives
// the same files). Nothing in it belongs to a real person.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { syntheticDocuments } from "../tests/documents/generate.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? Number(args[index + 1]) : fallback;
};
const folder = resolve(
  args.find((value, index) => !value.startsWith("--") && !args[index - 1]?.startsWith("--")) ??
    fileURLToPath(new URL("../artifacts/documents", import.meta.url)),
);
const documents = await syntheticDocuments(option("--seed", 1), { variants: option("--variants", 2) });
rmSync(folder, { recursive: true, force: true });
for (const { name, bytes, expect } of documents) {
  const directory = join(folder, expect.generated.kind);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, name), bytes);
  writeFileSync(join(directory, `${name}.expect.json`), JSON.stringify(expect, null, 2) + "\n");
}
console.log(`${documents.length} documents in ${folder}`);

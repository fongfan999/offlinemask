// Measures masking on a private set of real documents (decision 0152): every document
// in a folder is opened, scanned and masked exactly as the Tài liệu page does it, and
// compared with the owner's expectations beside it.
//
//   mise exec -- node scripts/evaluate-documents.mjs <folder> [--pack <root>] [--draft]
//                                                     [--definition <candidate.json>]
//
// --definition measures a candidate pack (a copy of packs/<id>.json pinned by
// `pnpm pack:prepare` against the files under --pack) instead of the shipping one.
//
// For each document (.pdf, .docx, .odt) the folder holds `<document>.expect.json`:
//
//   { "hide": ["values that must be masked wherever they appear",
//              { "value": "Trang", "in": "bà Trang" }],   // a short value, only in context
//     "keep": ["text that must stay readable"],
//     "ignore": ["values that may be masked or not, such as a bank's name"],
//     "draft": true }            // until the owner has reviewed the lists
//
// --draft writes a draft for documents that have none: "hide" lists what the app masks
// today and "keep" is empty, so a reviewed draft never inherits the app's mistakes
// unseen. The folder is private and stays out of the repository; the report gives
// counts per document and the values only on this machine.
//
// Each expectation lands in one of four buckets, so a failure says where to look:
//   not read   a hidden value is not in the text the reader produced (reader, or a scan)
//   leaked     a hidden value is read but not fully masked (detection)
//   over       a kept text is partly masked (detection)
//   unlisted   a masked value is in neither list (to review: add it to "hide" or "keep")
// The report is written to <folder>/report.json and compared with the previous one.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { buckets, createDetector, measureFolder, totalsLine } from "./document-evaluation.mjs";
import { installedPackRoot, readPackDefinition } from "./pack-runtime.mjs";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const folder = resolve(
  args.find(
    (value, index) => !value.startsWith("--") && !["--pack", "--definition"].includes(args[index - 1]),
  ) ?? "",
);
const draft = args.includes("--draft");
const root = option("--pack") ?? installedPackRoot();
if (!args.length || !existsSync(folder)) {
  console.error(
    "Usage: node scripts/evaluate-documents.mjs <folder> [--pack <root>] [--draft] [--definition <candidate.json>]",
  );
  process.exit(2);
}
if (!root) throw new Error("No recognition pack installed; pass --pack <root>.");
const definition = option("--definition") ? await readPackDefinition(resolve(option("--definition"))) : undefined;

const detector = createDetector(root, definition);
const started = performance.now();
const measured = await measureFolder(folder, detector, { draft, log: console.log });
await detector.dispose();
const report = { at: new Date().toISOString(), pack: basename(root), ...measured };
const totals = report.totals;
console.log(`\n${totalsLine(totals, Math.round((performance.now() - started) / 1000))}`);

// What changed since the last run, value by value.
const previousPath = join(folder, "report.json");
if (existsSync(previousPath)) {
  const previous = JSON.parse(readFileSync(previousPath, "utf8"));
  const changes = [];
  for (const [name, entry] of Object.entries(report.documents)) {
    const before = previous.documents?.[name];
    if (!before || entry.error || before.error) continue;
    for (const key of buckets) {
      for (const value of entry[key]) if (!before[key]?.includes(value)) changes.push(`+ ${key} ${name}: ${JSON.stringify(value)}`);
      for (const value of before[key] ?? []) if (!entry[key].includes(value)) changes.push(`- ${key} ${name}: ${JSON.stringify(value)}`);
    }
  }
  console.log(changes.length ? `\nSince ${previous.at}:\n${changes.join("\n")}` : `\nNo change since ${previous.at}.`);
}
writeFileSync(previousPath, JSON.stringify(report, null, 2) + "\n");
if (totals.notRead || totals.leaked) process.exitCode = 1;

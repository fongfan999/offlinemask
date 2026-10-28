// Measures masking on a private set of real documents (decision 0152): every document
// in a folder is opened, scanned and masked exactly as the Tài liệu page does it, and
// compared with the owner's expectations beside it.
//
//   mise exec -- node scripts/evaluate-documents.mjs <folder> [--pack <root>] [--draft]
//                                                     [--definition <candidate.json>] [--misread]
//
// --definition measures a candidate pack (a copy of packs/<id>.json pinned by
// `pnpm pack:prepare` against the files under --pack) instead of the shipping one.
// --misread, for a folder of scans (scripts/rasterise-documents.mjs, decision 0171),
// looks again at every value not read: text recognition may have read it with a wrong
// letter or tone mark. Letters and digits without their marks are searched for, and the
// value is reported as "misread, masked" when what was read is fully masked all the
// same, or "misread, readable" when it would reach the AI: the count that matters.
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
    (value, index) =>
      !value.startsWith("--") && !["--pack", "--definition"].includes(args[index - 1]),
  ) ?? "",
);
const draft = args.includes("--draft");
const misread = args.includes("--misread");
const root = option("--pack") ?? installedPackRoot();
if (!args.length || !existsSync(folder)) {
  console.error(
    "Usage: node scripts/evaluate-documents.mjs <folder> [--pack <root>] [--draft] [--definition <candidate.json>]",
  );
  process.exit(2);
}
if (!root) throw new Error("No recognition pack installed; pass --pack <root>.");
const definition = option("--definition")
  ? await readPackDefinition(resolve(option("--definition")))
  : undefined;

const detector = createDetector(root, definition);
const started = performance.now();
/** Letters and digits alone, lower case, without tone marks: what a misread leaves. */
const bare = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
const misreads = { masked: [], readable: [], lost: [] };
const onDocument = (name, run, result) => {
  if (!misread) return;
  for (const value of result.notRead) {
    const wanted = bare(value);
    let found = false;
    let covered = false;
    for (const paragraph of run.opened.paragraphs) {
      // Map each bare character back to its position in the paragraph.
      const positions = [];
      let stripped = "";
      for (let at = 0; at < paragraph.text.length; at++) {
        const piece = bare(paragraph.text[at]);
        for (const char of piece) {
          stripped += char;
          positions.push(at);
        }
      }
      for (let at = stripped.indexOf(wanted); at >= 0; at = stripped.indexOf(wanted, at + 1)) {
        found = true;
        const start = positions[at];
        const end = positions[at + wanted.length - 1] + 1;
        const ranges = run.edits.paragraphs.get(paragraph.id) ?? [];
        const masked = [...Array(end - start).keys()].every((offset) => {
          const index = start + offset;
          return (
            /[^\p{L}\p{N}]/u.test(paragraph.text[index]) ||
            ranges.some((range) => range.start <= index && range.end > index)
          );
        });
        covered = masked;
        if (!masked) break;
      }
      if (found && !covered) break;
    }
    const bucket = !found ? "lost" : covered ? "masked" : "readable";
    misreads[bucket].push(`${name}: ${JSON.stringify(value)}`);
  }
};
const measured = await measureFolder(folder, detector, { draft, log: console.log, onDocument });
await detector.dispose();
if (misread) {
  console.log(
    `\nNot read, looked at again: ${misreads.masked.length} misread but masked, ${misreads.readable.length} misread and readable, ${misreads.lost.length} not found even without marks`,
  );
  for (const [bucket, label] of [
    ["readable", "misread, readable"],
    ["lost", "not found"],
    ["masked", "misread, masked"],
  ])
    for (const entry of misreads[bucket]) console.log(`  ${label}: ${entry}`);
}
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
      for (const value of entry[key])
        if (!before[key]?.includes(value))
          changes.push(`+ ${key} ${name}: ${JSON.stringify(value)}`);
      for (const value of before[key] ?? [])
        if (!entry[key].includes(value)) changes.push(`- ${key} ${name}: ${JSON.stringify(value)}`);
    }
  }
  console.log(
    changes.length
      ? `\nSince ${previous.at}:\n${changes.join("\n")}`
      : `\nNo change since ${previous.at}.`,
  );
}
writeFileSync(previousPath, JSON.stringify(report, null, 2) + "\n");
if (totals.notRead || totals.leaked) process.exitCode = 1;

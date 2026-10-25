// Measures masking on a private set of real documents (decision 0152): every document
// in a folder is opened, scanned and masked exactly as the Tài liệu page does it, and
// compared with the owner's expectations beside it.
//
//   mise exec -- node scripts/evaluate-documents.mjs <folder> [--pack <root>] [--draft]
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
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import { scanTexts } from "../src/composables/scanTexts.ts";
import { openDocument, writeDocument } from "../src/core/doc/document.ts";
import { maskParagraphs } from "../src/core/doc/mask.ts";
import { createDetectionEngine } from "../src/core/detection/engine.ts";
import { detectionOptions } from "../src/core/detection/options.ts";
import { installedPackRoot, loadPack } from "./pack-runtime.mjs";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const folder = resolve(
  args.find((value, index) => !value.startsWith("--") && args[index - 1] !== "--pack") ?? "",
);
const draft = args.includes("--draft");
const root = option("--pack") ?? installedPackRoot();
if (!args.length || !existsSync(folder)) {
  console.error("Usage: node scripts/evaluate-documents.mjs <folder> [--pack <root>] [--draft]");
  process.exit(2);
}
if (!root) throw new Error("No recognition pack installed; pass --pack <root>.");

function documents(directory) {
  return readdirSync(directory)
    .flatMap((name) => {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) return documents(path);
      return [".pdf", ".docx", ".odt"].includes(extname(name).toLowerCase()) ? [path] : [];
    })
    .sort();
}

// The app's detector: the same policy and category filter, the pack loaded once.
const engine = createDetectionEngine(undefined, async (packRoot) => {
  const pack = await loadPack(packRoot);
  return { detect: (text) => pack.detect(text), dispose: () => pack.dispose() };
});
const detector = {
  detect: (text, progress, modelRoot, options) => engine({ text, options, modelRoot }, progress),
};
const options = detectionOptions.map((entry) => entry.id);

/** Masked character ranges per paragraph, and what each replaced. */
async function mask(path) {
  const opened = await openDocument(new Uint8Array(readFileSync(path)), basename(path));
  const detections = await scanTexts(
    detector,
    opened.paragraphs.map((paragraph) => ({ key: paragraph.id, text: paragraph.text })),
    options,
    root,
  );
  const { edits } = maskParagraphs(opened.paragraphs, detections, "e0a1", opened.mailto);
  const written = await writeDocument(opened.source, edits);
  return { opened, edits, written };
}

const squeeze = (text) => text.replace(/\s+/gu, " ").trim();
function evaluate({ opened, edits }, expected) {
  const masked = new Set();
  const covered = (paragraph, start, end) =>
    (edits.paragraphs.get(paragraph.id) ?? []).some((r) => r.start <= start && r.end >= end);
  const result = { notRead: [], leaked: [], over: [], unlisted: [] };
  for (const entry of expected.hide ?? []) {
    const value = typeof entry === "string" ? entry : entry.value;
    const context = typeof entry === "string" ? entry : entry.in;
    const offset = context.indexOf(value);
    let found = false;
    for (const paragraph of opened.paragraphs) {
      for (let near = paragraph.text.indexOf(context); near >= 0; near = paragraph.text.indexOf(context, near + 1)) {
        found = true;
        const at = near + offset;
        for (let i = at; i < at + value.length; i++)
          if (!/\s/u.test(paragraph.text[i]) && !covered(paragraph, i, i + 1)) {
            result.leaked.push(value);
            break;
          }
      }
    }
    // A value the reader split differently (a line break, two spaces) is matched loosely.
    if (!found && !opened.paragraphs.some((p) => squeeze(p.text).includes(squeeze(context))))
      result.notRead.push(value);
  }
  for (const value of expected.keep ?? [])
    for (const paragraph of opened.paragraphs)
      for (let at = paragraph.text.indexOf(value); at >= 0; at = paragraph.text.indexOf(value, at + 1))
        if ((edits.paragraphs.get(paragraph.id) ?? []).some((r) => r.start < at + value.length && r.end > at))
          result.over.push(value);
  for (const paragraph of opened.paragraphs)
    for (const replacement of edits.paragraphs.get(paragraph.id) ?? []) {
      const value = paragraph.text.slice(replacement.start, replacement.end);
      masked.add(value);
      const listed = [
        ...(expected.hide ?? []).map((entry) => (typeof entry === "string" ? entry : entry.value)),
        ...(expected.keep ?? []),
        ...(expected.ignore ?? []),
      ].some(
        (entry) => entry.includes(value) || value.includes(entry),
      );
      if (!listed) result.unlisted.push(value);
    }
  for (const key of Object.keys(result)) result[key] = [...new Set(result[key])];
  return { ...result, masked: [...masked] };
}

const files = documents(folder);
const report = { at: new Date().toISOString(), pack: basename(root), documents: {} };
const started = performance.now();
for (const path of files) {
  const name = relative(folder, path);
  const expectPath = `${path}.expect.json`;
  let run;
  try {
    run = await mask(path);
  } catch (error) {
    report.documents[name] = { error: String(error?.code ?? error) };
    console.log(`ERROR    ${name}: ${error?.code ?? error}`);
    continue;
  }
  if (!existsSync(expectPath)) {
    if (!draft) {
      console.log(`NO LIST  ${name} (run with --draft to start one)`);
      continue;
    }
    const hide = [...new Set(evaluate(run, {}).masked)];
    writeFileSync(expectPath, JSON.stringify({ hide, keep: [], draft: true }, null, 2) + "\n");
    console.log(`DRAFTED  ${name}: ${hide.length} value(s) to review in ${basename(expectPath)}`);
  }
  const expected = JSON.parse(readFileSync(expectPath, "utf8"));
  const result = evaluate(run, expected);
  report.documents[name] = {
    draft: !!expected.draft,
    hide: expected.hide?.length ?? 0,
    keep: expected.keep?.length ?? 0,
    ...result,
  };
  const counts = ["notRead", "leaked", "over", "unlisted"].map((key) => result[key].length);
  const status = counts[0] || counts[1] ? "LEAK" : counts[2] ? "OVER" : counts[3] ? "REVIEW" : "OK";
  console.log(
    `${status.padEnd(8)} ${name}${expected.draft ? " (draft)" : ""}: ` +
      `not read ${counts[0]}, leaked ${counts[1]}, over ${counts[2]}, unlisted ${counts[3]}`,
  );
  for (const [key, label] of [
    ["notRead", "not read"],
    ["leaked", "leaked"],
    ["over", "over-masked"],
    ["unlisted", "unlisted"],
  ])
    for (const value of result[key]) console.log(`           ${label}: ${JSON.stringify(value)}`);
}
await engine.dispose();

const totals = { documents: 0, notRead: 0, leaked: 0, over: 0, unlisted: 0 };
for (const entry of Object.values(report.documents)) {
  if (entry.error) continue;
  totals.documents++;
  for (const key of ["notRead", "leaked", "over", "unlisted"]) totals[key] += entry[key].length;
}
report.totals = totals;
console.log(
  `\n${totals.documents} document(s) in ${Math.round((performance.now() - started) / 1000)} s: ` +
    `not read ${totals.notRead}, leaked ${totals.leaked}, over-masked ${totals.over}, unlisted ${totals.unlisted}`,
);

// What changed since the last run, value by value.
const previousPath = join(folder, "report.json");
if (existsSync(previousPath)) {
  const previous = JSON.parse(readFileSync(previousPath, "utf8"));
  const changes = [];
  for (const [name, entry] of Object.entries(report.documents)) {
    const before = previous.documents?.[name];
    if (!before || entry.error || before.error) continue;
    for (const key of ["notRead", "leaked", "over", "unlisted"]) {
      for (const value of entry[key]) if (!before[key]?.includes(value)) changes.push(`+ ${key} ${name}: ${JSON.stringify(value)}`);
      for (const value of before[key] ?? []) if (!entry[key].includes(value)) changes.push(`- ${key} ${name}: ${JSON.stringify(value)}`);
    }
  }
  console.log(changes.length ? `\nSince ${previous.at}:\n${changes.join("\n")}` : `\nNo change since ${previous.at}.`);
}
writeFileSync(previousPath, JSON.stringify(report, null, 2) + "\n");
if (totals.notRead || totals.leaked) process.exitCode = 1;

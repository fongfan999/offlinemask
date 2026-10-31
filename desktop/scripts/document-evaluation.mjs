// The measurement behind `evaluate-documents.mjs` and `compare-packs.mjs` (decisions 0152
// and 0164): documents in a folder are opened, scanned and masked exactly as the Tài liệu
// page does it, and compared with the expectations beside them.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { scanTexts } from "../src/composables/scanTexts.ts";
import { openDocument, writeDocument } from "../src/core/doc/document.ts";
import { maskParagraphs } from "../src/core/doc/mask.ts";
import { createDetectionEngine } from "../src/core/detection/engine.ts";
import { detectionOptions } from "../src/core/detection/options.ts";
import { createOcrEngine } from "./ocr-runtime.mjs";
import { createReadingEngine } from "./reading-runtime.mjs";
import { loadPack } from "./pack-runtime.mjs";

// pdf.js's picture decoders straight from the package, as the app serves them at `/pdfjs/`
// (decision 0182).
const decoders = new URL("wasm/", pathToFileURL(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"))).href;

export const buckets = ["notRead", "leaked", "over", "unlisted"];
export const bucketLabels = {
  notRead: "not read",
  leaked: "leaked",
  over: "over-masked",
  unlisted: "unlisted",
};

/** Every .pdf, .docx, .odt, .png and .jpg under a folder, in a fixed order. */
export function listDocuments(directory) {
  return readdirSync(directory)
    .flatMap((name) => {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) return listDocuments(path);
      return [".pdf", ".docx", ".odt", ".png", ".jpg", ".jpeg"].includes(
        extname(name).toLowerCase(),
      )
        ? [path]
        : [];
    })
    .sort();
}

/** The app's detector over a pack at `root`: the same policy and category filter, the
 * pack loaded once on first use. A candidate definition stands in for the shipping pack.
 * Pages without text and pictures go to the app's own text recognition (decision 0180),
 * started the first time one is met: the system's engine, or with `reading` OfflineMask's own
 * (decision 0181). */
export function createDetector(root, definition, { reading = false } = {}) {
  const engine = createDetectionEngine(undefined, async (packRoot) => {
    const pack = await loadPack(packRoot, definition);
    return { detect: (text) => pack.detect(text), dispose: () => pack.dispose() };
  });
  const ocr = reading ? createReadingEngine() : createOcrEngine();
  return {
    root,
    options: detectionOptions.map((entry) => entry.id),
    ocr,
    detect: (text, progress, modelRoot, options) => engine({ text, options, modelRoot }, progress),
    dispose: async () => {
      ocr.dispose();
      await engine.dispose();
    },
  };
}

/** Masked character ranges per paragraph, and the written copy. */
export async function maskDocument(path, detector) {
  const opened = await openDocument(new Uint8Array(readFileSync(path)), basename(path), {
    ocr: detector.ocr,
    decoders,
  });
  const detections = await scanTexts(
    detector,
    opened.paragraphs.map((paragraph) => ({ key: paragraph.id, text: paragraph.text })),
    detector.options,
    detector.root,
  );
  const { edits } = maskParagraphs(opened.paragraphs, detections, "e0a1", opened.mailto);
  const written = await writeDocument(opened.source, edits);
  return { opened, edits, written };
}

const squeeze = (text) => text.replace(/\s+/gu, " ").trim();
const alphanumeric = /[\p{L}\p{N}]/u;
/** A value that starts or ends with a letter or digit must not be found glued to
 * another: "0932732371" inside "093273237136" or "0887172791trú" (text recognition
 * running a value into its neighbour, decision 0180) is not the value read; it is
 * reported as not read, not as leaked. */
const whole = (text, at, value) =>
  !(
    (alphanumeric.test(value[0]) && at > 0 && alphanumeric.test(text[at - 1])) ||
    (alphanumeric.test(value.at(-1)) &&
      at + value.length < text.length &&
      alphanumeric.test(text[at + value.length]))
  );
/** Each expectation in its bucket: not read, leaked, over (a kept text partly masked) or
 * unlisted (masked, in no list); `masked` is every value replaced. */
export function evaluateDocument({ opened, edits }, expected) {
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
      for (
        let near = paragraph.text.indexOf(context);
        near >= 0;
        near = paragraph.text.indexOf(context, near + 1)
      ) {
        if (!whole(paragraph.text, near, context)) continue;
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
      for (
        let at = paragraph.text.indexOf(value);
        at >= 0;
        at = paragraph.text.indexOf(value, at + 1)
      )
        if (
          (edits.paragraphs.get(paragraph.id) ?? []).some(
            (r) => r.start < at + value.length && r.end > at,
          )
        )
          result.over.push(value);
  const listed = [
    ...(expected.hide ?? []).map((entry) => (typeof entry === "string" ? entry : entry.value)),
    ...(expected.keep ?? []),
    ...(expected.ignore ?? []),
  ];
  for (const paragraph of opened.paragraphs)
    for (const replacement of edits.paragraphs.get(paragraph.id) ?? []) {
      const value = paragraph.text.slice(replacement.start, replacement.end);
      masked.add(value);
      if (!listed.some((entry) => entry.includes(value) || value.includes(entry)))
        result.unlisted.push(value);
    }
  for (const key of buckets) result[key] = [...new Set(result[key])];
  return { ...result, masked: [...masked] };
}

/** Every document of a folder measured against the lists beside it. `draft` writes a
 * draft list for documents that have none (hide = what is masked today, keep empty);
 * `log` receives one line per document and the values in each bucket, and `onDocument`
 * the masked document and its result, for further analysis. Returns the
 * report: { documents: { name: { draft, hide, keep, notRead, leaked, over, unlisted,
 * masked } | { error } }, totals }. */
export async function measureFolder(folder, detector, { draft = false, log, onDocument } = {}) {
  const report = { documents: {} };
  for (const path of listDocuments(folder)) {
    const name = relative(folder, path);
    const expectPath = `${path}.expect.json`;
    let run;
    try {
      run = await maskDocument(path, detector);
    } catch (error) {
      report.documents[name] = { error: String(error?.code ?? error) };
      log?.(`ERROR    ${name}: ${error?.code ?? error}`);
      continue;
    }
    if (!existsSync(expectPath)) {
      if (!draft) {
        log?.(`NO LIST  ${name} (run with --draft to start one)`);
        continue;
      }
      const hide = [...new Set(evaluateDocument(run, {}).masked)];
      writeFileSync(expectPath, JSON.stringify({ hide, keep: [], draft: true }, null, 2) + "\n");
      log?.(`DRAFTED  ${name}: ${hide.length} value(s) to review in ${basename(expectPath)}`);
    }
    const expected = JSON.parse(readFileSync(expectPath, "utf8"));
    const result = evaluateDocument(run, expected);
    onDocument?.(name, run, result);
    report.documents[name] = {
      draft: !!expected.draft,
      hide: expected.hide?.length ?? 0,
      keep: expected.keep?.length ?? 0,
      ...result,
    };
    const counts = buckets.map((key) => result[key].length);
    const status =
      counts[0] || counts[1] ? "LEAK" : counts[2] ? "OVER" : counts[3] ? "REVIEW" : "OK";
    log?.(
      `${status.padEnd(8)} ${name}${expected.draft ? " (draft)" : ""}: ` +
        `not read ${counts[0]}, leaked ${counts[1]}, over ${counts[2]}, unlisted ${counts[3]}`,
    );
    for (const key of buckets)
      for (const value of result[key])
        log?.(`           ${bucketLabels[key]}: ${JSON.stringify(value)}`);
  }
  report.totals = totalsOf(report.documents);
  return report;
}

/** Counts over a report's documents, errors left out. */
export function totalsOf(documents) {
  const totals = { documents: 0, notRead: 0, leaked: 0, over: 0, unlisted: 0 };
  for (const entry of Object.values(documents)) {
    if (entry.error) continue;
    totals.documents++;
    for (const key of buckets) totals[key] += entry[key].length;
  }
  return totals;
}

/** One line of totals, as the scripts print it. */
export function totalsLine(totals, seconds) {
  return (
    `${totals.documents} document(s)${seconds === undefined ? "" : ` in ${seconds} s`}: ` +
    `not read ${totals.notRead}, leaked ${totals.leaked}, over-masked ${totals.over}, unlisted ${totals.unlisted}`
  );
}

// Decision 0079 experiment: does a minimum model score remove false names, places and
// organizations without breaking the pack gate? For each threshold this runs the
// committed fixtures exactly like scripts/check-pack.mjs, and optionally counts the
// model findings in local .docx files (counts only; no text is printed or stored).
//
// Annotated corpora (`[[name|…]]` fixtures, e.g. tests/fixtures/release-challenge-v1.json)
// are scored for full coverage per category and for over-masking.
//
//   mise exec -- node scripts/score-threshold/evaluate.mjs <pack root> [file.docx ...] [corpus.json ...]
//     [--thresholds 0,0.5,0.6,0.7,0.8,0.9]
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { openDocx } from "../../src/core/doc/docx.ts";
import { recognitionPack } from "../../src/core/detection/pack.ts";
import { createModelRunner } from "../../src/core/detection/model-runner.ts";
import {
  configureLocalModels,
  createPackProvider,
  createRecognition,
  wasmBackend,
} from "../../src/core/detection/recognition.ts";
import { analyzeText, maskedText } from "../../src/core/text.ts";
import { parseFixture, scoreFixture, summarize } from "../model-comparison-metrics.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const at = args.indexOf("--thresholds");
const thresholds = (at >= 0 ? args[at + 1] : "0,0.5,0.6,0.7,0.8,0.9").split(",").map(Number);
const positional = args.filter((value, index) => !value.startsWith("--") && args[index - 1] !== "--thresholds");
const root = resolve(positional[0]);
const documents = positional.slice(1).filter((path) => !path.endsWith(".json"));
const corpora = [];
for (const path of positional.slice(1).filter((value) => value.endsWith(".json")))
  corpora.push(...JSON.parse(await readFile(resolve(path), "utf8")).map(parseFixture));
const fixtures = JSON.parse(await readFile(join(repo, "tests/fixtures/recognition-pack.json"), "utf8"));

const binary = join(repo, "src-tauri/target/release/recognition-tokenizer-check");
if (!existsSync(binary)) throw new Error("Build the tokenizer harness first (see scripts/check-pack.mjs).");
const encoders = new Map();
for (const model of recognitionPack.models.filter((m) => m.offsets === "native")) {
  const child = spawn(binary, [root, model.directory], { stdio: ["pipe", "pipe", "inherit"] });
  const lines = createInterface({ input: child.stdout });
  const queue = [];
  lines.on("line", (line) => queue.shift()?.(JSON.parse(line)));
  encoders.set(model.directory, {
    child,
    encode: (text) =>
      new Promise((done) => {
        queue.push(done);
        child.stdin.write(JSON.stringify(text) + "\n");
      }),
  });
}
const encode = (text, directory) => encoders.get(directory).encode(text);

// Sessions load once; runners differ only in the threshold.
configureLocalModels(root);
const backend = wasmBackend("cpu");
const sessions = [];
for (const model of recognitionPack.models) sessions.push([model, await backend(model, root)]);
const recognitionAt = (threshold) =>
  createRecognition(
    sessions.map(([model, session]) =>
      createModelRunner([createPackProvider(model, session, encode)], { threshold }),
    ),
    recognitionPack,
  );

function fixtureProblems(fixture, detections) {
  const analysis = analyzeText(fixture.text, "12345678", detections);
  const all = Object.fromEntries(analysis.findings.map((x) => [x.id, "mask"]));
  const output = maskedText(fixture.text, analysis, all);
  const problems = [];
  for (const value of fixture.sensitive ?? []) {
    let cursor = 0;
    for (;;) {
      const index = fixture.text.indexOf(value, cursor);
      if (index < 0) break;
      for (let i = index; i < index + value.length; i++)
        if (!/\s/u.test(fixture.text[i]) && !analysis.spans.some((s) => s.start <= i && s.end > i)) {
          problems.push(`incomplete ${JSON.stringify(value)}`);
          break;
        }
      cursor = index + value.length;
    }
  }
  for (const value of fixture.retain ?? [])
    if (!output.includes(value)) problems.push(`changed ${JSON.stringify(value)}`);
  return problems;
}

const texts = [];
for (const path of documents) {
  const opened = await openDocx(new Uint8Array(await readFile(path)));
  texts.push(opened.paragraphs.map((paragraph) => paragraph.text).filter((text) => /\p{L}/u.test(text)));
}

const rows = [];
for (const threshold of thresholds) {
  const recognition = recognitionAt(threshold);
  const failed = [];
  for (const fixture of fixtures) {
    const problems = fixtureProblems(fixture, await recognition.detect(fixture.text));
    if (problems.length) failed.push(`${fixture.id}${fixture.knownMiss ? " (known)" : ""}`);
  }
  const counts = { TEN: 0, TEN_lower: 0, DIA_CHI: 0, TO_CHUC: 0, TEN_distinct: new Set() };
  for (const paragraphs of texts)
    for (const text of paragraphs)
      for (const d of await recognition.detect(text)) {
        if (!["TEN", "DIA_CHI", "TO_CHUC"].includes(d.type)) continue;
        counts[d.type]++;
        if (d.type === "TEN") {
          const value = text.slice(d.start, d.end);
          counts.TEN_distinct.add(value);
          if (!/\p{Lu}/u.test(value)) counts.TEN_lower++;
        }
      }
  const scored = [];
  for (const fixture of corpora) {
    const spans = analyzeText(fixture.text, "12345678", await recognition.detect(fixture.text)).spans;
    scored.push(scoreFixture(fixture, spans));
  }
  const summary = corpora.length ? summarize(scored) : null;
  const row = {
    threshold,
    ...(summary
      ? {
          corpus: corpora.length,
          entities: summary.entities,
          fullyCovered: summary.fullyCovered,
          name: `${summary.byCategory.name.full}/${summary.byCategory.name.total}`,
          address: `${summary.byCategory.address.full}/${summary.byCategory.address.total}`,
          excessMaskingRate: Number(summary.excessMaskingRate.toFixed(4)),
        }
      : {}),
    fixturesFailed: failed.length,
    failed: failed.join(", "),
    ...(texts.length
      ? {
          TEN: counts.TEN,
          TEN_withoutCapital: counts.TEN_lower,
          TEN_distinct: counts.TEN_distinct.size,
          DIA_CHI: counts.DIA_CHI,
          TO_CHUC: counts.TO_CHUC,
        }
      : {}),
  };
  rows.push(row);
  console.log(JSON.stringify(row));
}
for (const [, session] of sessions) await session.dispose();
for (const { child } of encoders.values()) child.stdin.end();
console.log(JSON.stringify({ fixtures: fixtures.length, documents: documents.length, rows }, null, 2));

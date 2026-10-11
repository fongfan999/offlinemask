// Run the shipping recognition pack against the committed synthetic fixtures.
// This is the model-level gate for a replaced pack: `pnpm test` covers the code
// around the models; this covers the models themselves, on this machine, offline.
//
//   mise exec -- node scripts/check-pack.mjs [pack root] [--fixtures <file>] [--strict]
//
// The pack root holds one subdirectory per pack model with the exact pinned
// files (see packs/README.md). Nothing is downloaded. Fixtures live in
// tests/fixtures/recognition-pack.json; an entry with `knownMiss` records a
// documented limitation of the current pack and is reported, not failed,
// unless --strict is given. Models that declare native offsets need the Rust
// tokenizer harness:
//   cargo build --manifest-path src-tauri/Cargo.toml --release \
//     --features recognition-evaluation --bin recognition-tokenizer-check
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { recognitionPack } from "../src/core/detection/pack.ts";
import { loadRecognition } from "../src/core/detection/recognition.ts";
import { analyzeText, maskedText } from "../src/core/text.ts";

const repo = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const strict = args.includes("--strict");
const fixtureIndex = args.indexOf("--fixtures");
const fixturePath =
  fixtureIndex >= 0
    ? resolve(args[fixtureIndex + 1])
    : join(repo, "tests/fixtures/recognition-pack.json");
const positional = args.filter(
  (value, index) => !value.startsWith("--") && args[index - 1] !== "--fixtures",
);
const root = resolve(positional[0] ?? join(repo, "artifacts/packs", recognitionPack.id));

async function digest(path) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  return { sha256: hash.digest("hex"), bytes };
}

console.log(`Pack ${recognitionPack.id}: ${recognitionPack.models.length} model(s) at ${root}`);
for (const asset of recognitionPack.assets) {
  const path = join(root, asset.directory, asset.name);
  if (!existsSync(path)) throw new Error(`Missing ${asset.directory}/${asset.name}; see packs/README.md`);
  const actual = await digest(path);
  if (actual.bytes !== asset.bytes || actual.sha256 !== asset.sha256)
    throw new Error(`${asset.directory}/${asset.name} differs from the pinned pack entry`);
}
console.log("All pinned files present and verified.");

// Exact offsets for native-offset models come from the same Rust tokenizer the app uses.
const nativeModels = recognitionPack.models.filter((model) => model.offsets === "native");
const children = new Map();
function nativeEncoder(directory) {
  const binary = join(repo, "src-tauri/target/release/recognition-tokenizer-check");
  if (!existsSync(binary))
    throw new Error("Build the tokenizer harness first (see the header of this script).");
  const child = spawn(binary, [root, directory], { stdio: ["pipe", "pipe", "inherit"] });
  const lines = createInterface({ input: child.stdout });
  let pending;
  lines.on("line", (line) => {
    const next = pending;
    pending = undefined;
    if (!next) return;
    try {
      next.resolve(JSON.parse(line));
    } catch (error) {
      next.reject(error);
    }
  });
  child.on("exit", () => {
    pending?.reject(new Error("Native tokenizer exited"));
    pending = undefined;
  });
  children.set(directory, child);
  return (text) =>
    new Promise((resolve, reject) => {
      assert.ok(!pending, "One tokenizer request at a time");
      pending = { resolve, reject };
      child.stdin.write(JSON.stringify(text) + "\n");
    });
}
const encoders = new Map(nativeModels.map((model) => [model.directory, nativeEncoder(model.directory)]));
const encode = (text, directory) => {
  const encoder = encoders.get(directory);
  if (!encoder) throw new Error(`No native tokenizer for ${directory}`);
  return encoder(text);
};

const originalFetch = globalThis.fetch;
let networkAttempts = 0;
globalThis.fetch = async () => {
  networkAttempts++;
  throw new Error("Network access forbidden during pack evaluation");
};
const started = performance.now();
const detector = await loadRecognition(root, encode, "cpu");
console.log(`Loaded in ${Math.round(performance.now() - started)} ms with network fetch disabled.`);
let failures = 0,
  knownMisses = 0;
try {
  const fixtures = JSON.parse(await readFile(fixturePath, "utf8"));
  for (const fixture of fixtures) {
    const begin = performance.now();
    const detections = await detector.detect(fixture.text, () => {});
    const analysis = analyzeText(fixture.text, "12345678", detections);
    const decisions = (choice) => Object.fromEntries(analysis.findings.map((x) => [x.id, choice]));
    const output = maskedText(fixture.text, analysis, decisions("mask"));
    const problems = [];
    for (const value of fixture.sensitive ?? []) {
      let cursor = 0;
      for (;;) {
        const at = fixture.text.indexOf(value, cursor);
        if (at < 0) break;
        // Every non-whitespace source character must be covered, not just a fragment.
        for (let i = at; i < at + value.length; i++)
          if (!/\s/u.test(fixture.text[i]) && !analysis.spans.some((s) => s.start <= i && s.end > i)) {
            problems.push(`incomplete ${JSON.stringify(value)}`);
            break;
          }
        cursor = at + value.length;
      }
    }
    for (const value of fixture.retain ?? [])
      if (!output.includes(value)) problems.push(`changed ${JSON.stringify(value)}`);
    // Keeping every finding must reproduce the original exactly, whatever the model found.
    assert.equal(maskedText(fixture.text, analysis, decisions("keep")), fixture.text, `${fixture.id}: keep`);
    const elapsed = Math.round(performance.now() - begin);
    if (!problems.length) console.log(`PASS ${fixture.id}: ${elapsed} ms`);
    else if (!strict && fixture.knownMiss) {
      knownMisses++;
      console.log(`KNOWN ${fixture.id}: ${problems.join("; ")} (${fixture.knownMiss})`);
    } else {
      failures++;
      console.error(`FAIL ${fixture.id}: ${problems.join("; ")}`);
    }
  }
  assert.equal(networkAttempts, 0, "The pack must load without any network attempt");
  assert.equal(failures, 0, `${failures} fixture(s) failed`);
  console.log(
    `PASS ${fixtures.length - knownMisses}/${fixtures.length} fixtures; ${knownMisses} known miss(es) reported.`,
  );
} finally {
  await detector.dispose();
  for (const child of children.values()) child.stdin.end();
  globalThis.fetch = originalFetch;
}

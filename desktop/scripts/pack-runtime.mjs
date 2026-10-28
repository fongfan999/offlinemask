// Loads the recognition pack at a root for offline evaluation scripts (check-pack,
// evaluate-documents). Models that declare native offsets need the Rust tokenizer
// harness:
//   cargo build --manifest-path src-tauri/Cargo.toml --release \
//     --features recognition-evaluation --bin recognition-tokenizer-check
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { recognitionPack, validatePackDefinition } from "../src/core/detection/pack.ts";
import { loadPackRecognition, wasmBackend } from "../src/core/detection/recognition.ts";

const repo = fileURLToPath(new URL("../", import.meta.url));

/** The pack the app installed on this Mac, if any: its newest installed version. */
export function installedPackRoot() {
  const packs = join(
    homedir(),
    "Library/Application Support/dev.offlinemask.desktop/models",
    recognitionPack.id,
    "packs",
  );
  if (!existsSync(packs)) return undefined;
  const versions = readdirSync(packs)
    .map((name) => join(packs, name))
    .filter((path) => statSync(path).isDirectory())
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return versions[0];
}

function nativeEncoder(root, directory) {
  const binary = join(
    repo,
    `src-tauri/target/release/recognition-tokenizer-check${process.platform === "win32" ? ".exe" : ""}`,
  );
  if (!existsSync(binary))
    throw new Error("Build the tokenizer harness first (see the header of scripts/pack-runtime.mjs).");
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
  return {
    child,
    encode: (text) =>
      new Promise((resolve, reject) => {
        assert.ok(!pending, "One tokenizer request at a time");
        pending = { resolve, reject };
        child.stdin.write(JSON.stringify(text) + "\n");
      }),
  };
}

/** A candidate pack definition from a file (a copy of packs/<id>.json pinned by
 * `pnpm pack:prepare` against local files), validated like the shipping one. */
export async function readPackDefinition(path) {
  return validatePackDefinition(JSON.parse(await readFile(path, "utf8")));
}

/** The pack's detector on the CPU, with no network access possible: the same models and
 * policy as the app (the app runs the same ONNX files natively on Apple silicon). A
 * candidate definition stands in for the shipping pack when given. */
export async function loadPack(root, pack = recognitionPack) {
  const encoders = new Map(
    pack.models
      .filter((model) => model.offsets === "native")
      .map((model) => [model.directory, nativeEncoder(root, model.directory)]),
  );
  const encode = (text, directory) => {
    const encoder = encoders.get(directory);
    if (!encoder) throw new Error(`No native tokenizer for ${directory}`);
    return encoder.encode(text);
  };
  const detector = await loadPackRecognition(pack, root, encode, wasmBackend("cpu"));
  return {
    detect: (text) => detector.detect(text, () => {}),
    async dispose() {
      await detector.dispose();
      for (const { child } of encoders.values()) child.stdin.end();
    },
  };
}

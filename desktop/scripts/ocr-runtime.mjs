// The app's own text recognition for the measurements (decision 0171): the native
// `ocr` module, through the evaluation binary built with
//   cargo build --manifest-path src-tauri/Cargo.toml --release \
//     --features recognition-evaluation --bin ocr-check
// Each picture is written to a temporary file the binary reads, with its size in pixels;
// nothing is kept.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const binary = fileURLToPath(
  new URL(
    `../src-tauri/target/release/ocr-check${process.platform === "win32" ? ".exe" : ""}`,
    import.meta.url,
  ),
);

/** An `OcrEngine` for `openDocument`, started on first use. `dispose` stops it. */
export function createOcrEngine() {
  let child;
  let lines;
  let pending;
  let folder;
  let count = 0;
  const start = () => {
    if (!existsSync(binary))
      throw new Error(
        "Build the text recognition harness first (see the header of scripts/ocr-runtime.mjs).",
      );
    folder = mkdtempSync(join(tmpdir(), "offlinemask-ocr-"));
    child = spawn(binary, [], { stdio: ["pipe", "pipe", "inherit"] });
    lines = createInterface({ input: child.stdout });
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
      pending?.reject(new Error("Text recognition exited"));
      pending = undefined;
    });
  };
  const engine = (image, width, height) =>
    new Promise((resolve, reject) => {
      if (!child) start();
      assert.ok(!pending, "One picture at a time");
      const path = join(folder, `${++count}.png`);
      writeFileSync(path, image);
      pending = {
        resolve: (page) => {
          rmSync(path, { force: true });
          resolve(page);
        },
        reject: (error) => {
          rmSync(path, { force: true });
          reject(error);
        },
      };
      child.stdin.write(JSON.stringify({ path, width, height }) + "\n");
    });
  engine.dispose = () => {
    child?.stdin.end();
    if (folder) rmSync(folder, { recursive: true, force: true });
  };
  return engine;
}

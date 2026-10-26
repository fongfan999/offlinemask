// A chunk of a worker bundle must never import the worker's entry file. WebKit evaluates a
// module worker's entry a second time when a chunk imports it back (Chromium does not), and the
// fresh copy replaces `onmessage`, so the replies the first copy waits for are swallowed:
// masking stalled at 0 % in the first 2.3.0 build (decision 0157). vite.config.ts keeps shared
// code out of the entries; this check fails the build if that ever regresses.
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const workers = fileURLToPath(new URL("../src/workers/", import.meta.url));

/** The worker entry names Vite builds from src/workers: "detection.worker", "files.worker". */
export const workerEntryNames = () =>
  readdirSync(workers)
    .filter((name) => name.endsWith(".worker.ts"))
    .map((name) => name.slice(0, -".ts".length));

/**
 * Every "chunk → entry" import among the built assets, as "chunk.js imports entry.js" lines.
 * Only module import syntax counts (`from "./x"`, `import "./x"`, `import("./x")`); the page
 * starts its workers through `new URL("/assets/…")`, which is not an import.
 */
export function workerEntryImports(assetsDir, entries = workerEntryNames()) {
  const files = readdirSync(assetsDir).filter((name) => name.endsWith(".js"));
  const entryFiles = files.filter((name) =>
    entries.some((entry) => new RegExp(`^${entry.replace(".", "\\.")}-[\\w-]+\\.js$`).test(name)),
  );
  const found = [];
  for (const file of files) {
    const source = readFileSync(join(assetsDir, file), "utf8");
    for (const entry of entryFiles) {
      if (entry === file) continue;
      const target = entry.replace(/[.$]/g, "\\$&");
      const imported = new RegExp(`(?:from\\s*|import\\s*\\(?\\s*)["'\`]\\./${target}["'\`]`).test(
        source,
      );
      if (imported) found.push(`${file} imports ${entry}`);
    }
  }
  return found;
}

/** Throws when a chunk imports a worker entry, naming each pair. */
export function checkWorkerChunks(assetsDir, entries) {
  const found = workerEntryImports(assetsDir, entries);
  if (found.length) {
    throw new Error(
      `A worker entry is imported by a chunk, which WebKit evaluates twice:\n  ${found.join("\n  ")}`,
    );
  }
  return found;
}

if (process.argv[1] && basename(process.argv[1]) === "check-worker-chunks.mjs") {
  const dir = process.argv[2] ?? fileURLToPath(new URL("../dist/assets", import.meta.url));
  checkWorkerChunks(dir);
  console.log(`No chunk imports a worker entry in ${dir}.`);
}

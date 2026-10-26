// Build guard for decision 0157: a chunk of a worker bundle must not import the worker's entry.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkWorkerChunks,
  workerEntryImports,
  workerEntryNames,
} from "../scripts/check-worker-chunks.mjs";

const write = (dir, files) => {
  for (const [name, source] of Object.entries(files)) writeFileSync(join(dir, name), source);
  return dir;
};

test("the worker entries are the files under src/workers", () => {
  assert.deepEqual(workerEntryNames().sort(), ["detection.worker", "files.worker"]);
});

test("a chunk importing a worker entry fails the check, with the pair named", () => {
  const dir = write(mkdtempSync(join(tmpdir(), "chunks-")), {
    "detection.worker-DhDeaG03.js": 'import{a}from"./policy-C_Nt.js";export{a as x};',
    "recognition-CSxDNji9.js": 'import{x as e}from"./detection.worker-DhDeaG03.js";',
    "files.worker-DnDEpm3U.js": "onmessage=()=>import(`./xls-CaG1kF-f.js`);",
    "xls-CaG1kF-f.js": 'const m=await import("./files.worker-DnDEpm3U.js");',
    "main-DTFF2e5u.js":
      'new Worker(new URL("/assets/detection.worker-DhDeaG03.js",import.meta.url));',
  });
  assert.deepEqual(workerEntryImports(dir), [
    "recognition-CSxDNji9.js imports detection.worker-DhDeaG03.js",
    "xls-CaG1kF-f.js imports files.worker-DnDEpm3U.js",
  ]);
  assert.throws(() => checkWorkerChunks(dir), /recognition-CSxDNji9\.js imports detection\.worker/);
});

test("entries importing chunks, and the page starting a worker, pass", () => {
  const dir = write(mkdtempSync(join(tmpdir(), "chunks-")), {
    "detection.worker-yWjPijro.js":
      'import{a}from"./policy-C_Nt.js";onmessage=()=>import(`./recognition-CGU.js`);',
    "recognition-CGU.js": 'import{a}from"./policy-C_Nt.js";',
    "policy-C_Nt.js": "export const a=1;",
    "files.worker-rgDdWYTC.js":
      'import{r}from"./files-BTCd.js";onmessage=()=>import("./pdf.worker-DHmF.js");',
    "pdf.worker-DHmF.js": "self.onmessage=()=>{};",
    "main-DQyA3OP5.js":
      "new Worker(new URL(`/assets/files.worker-rgDdWYTC.js`,``+import.meta.url),{type:`module`});",
  });
  assert.deepEqual(checkWorkerChunks(dir), []);
});

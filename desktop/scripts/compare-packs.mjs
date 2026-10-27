// Compares the shipping pack with a candidate on the held-out sets, and measures which
// structural mechanisms (vetoes.ts) a pack still needs by switching each off in turn
// (decision 0164):
//
//   mise exec -- node scripts/compare-packs.mjs [--candidate <candidate.json> --candidate-root <root>]
//       [--pack <root>] [--seeds 1-7] [--folder <path>]... [--ablate [veto,veto]] [--out <dir>]
//
// Sets: the synthetic seeds (generated under artifacts/compare/seed-<n> once, deterministic;
// decision 0153's held-out seeds 1–7 by default) and every subfolder of ~/OfflineMask-eval
// that exists (the owner's real documents, decision 0152) or the --folder paths given.
// Runs: the shipping pack (the installed one, or --pack), the candidate when given, then
// with --ablate each mechanism switched off on the candidate (or on the shipping pack
// when there is none). Every run reads the same documents through the app's own path.
// Output: a table on the console, report.json (counts and values) and report.md (counts
// only) under --out (default artifacts/compare/<timestamp>). A run over seeds 1–7 (546
// documents) takes about ten minutes on an M1 Pro; --ablate adds one run per mechanism.
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setVetoes, vetoNames } from "../src/core/detection/vetoes.ts";
import { syntheticDocuments } from "../tests/documents/generate.mjs";
import { comparisonMarkdown, judgeAblations, planRuns } from "./compare-packs-report.mjs";
import { createDetector, measureFolder, totalsLine } from "./document-evaluation.mjs";
import { installedPackRoot, readPackDefinition } from "./pack-runtime.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 && !args[index + 1]?.startsWith("--") ? args[index + 1] : undefined;
};
const options = (name) =>
  args.flatMap((value, index) => (value === name && args[index + 1] ? [args[index + 1]] : []));
const usage =
  "Usage: node scripts/compare-packs.mjs [--candidate <candidate.json> --candidate-root <root>] [--pack <root>] [--seeds a-b] [--folder <path>]... [--ablate [veto,...]] [--out <dir>]";
if (args.includes("--help")) {
  console.log(usage);
  process.exit(0);
}

const shippingRoot = option("--pack") ?? installedPackRoot();
if (!shippingRoot) throw new Error("No recognition pack installed; pass --pack <root>.");
const candidatePath = option("--candidate");
const candidateRoot = option("--candidate-root");
if (candidatePath && !candidateRoot) throw new Error("--candidate needs --candidate-root <root>.");
const candidate = candidatePath ? await readPackDefinition(resolve(candidatePath)) : undefined;

const seedRange = /^(\d+)(?:-(\d+))?$/.exec(option("--seeds") ?? "1-7");
if (!seedRange) throw new Error(usage);
const seeds = Array.from(
  { length: Number(seedRange[2] ?? seedRange[1]) - Number(seedRange[1]) + 1 },
  (_, i) => Number(seedRange[1]) + i,
);
const ablate = args.includes("--ablate")
  ? (option("--ablate")?.split(",").filter(Boolean) ?? [...vetoNames])
  : [];
const out = resolve(
  option("--out") ??
    join(repo, "artifacts/compare", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)),
);

/** A synthetic seed's documents, written once; the same seed always writes the same bytes. */
async function seedFolder(seed) {
  const folder = join(repo, "artifacts/compare", `seed-${seed}`);
  if (existsSync(join(folder, ".complete"))) return folder;
  mkdirSync(folder, { recursive: true });
  for (const { name, bytes, expect } of await syntheticDocuments(seed)) {
    const directory = join(folder, expect.generated.kind);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, name), bytes);
    writeFileSync(join(directory, `${name}.expect.json`), JSON.stringify(expect, null, 2) + "\n");
  }
  writeFileSync(join(folder, ".complete"), "");
  return folder;
}
const privateRoot = join(homedir(), "OfflineMask-eval");
const folders = options("--folder").length
  ? options("--folder").map((path) => resolve(path))
  : existsSync(privateRoot)
    ? readdirSync(privateRoot)
        .map((name) => join(privateRoot, name))
        .filter((path) => statSync(path).isDirectory())
    : [];
const sets = [
  ...(await Promise.all(seeds.map(async (seed) => ({ name: `seed ${seed}`, folder: await seedFolder(seed) })))),
  ...folders.map((folder) => ({ name: basename(folder), folder })),
];

const runs = planRuns({ candidate: !!candidate, ablate });
const detectors = {
  shipping: createDetector(shippingRoot),
  ...(candidate ? { candidate: createDetector(candidateRoot, candidate) } : {}),
};
console.log(
  `${runs.length} run(s) over ${sets.map((set) => set.name).join(", ")}; shipping pack ${basename(shippingRoot)}${candidate ? `, candidate ${basename(candidateRoot)}` : ""}.`,
);
const started = performance.now();
const results = {};
const documents = {};
for (const run of runs) {
  setVetoes(run.off);
  results[run.id] = {};
  documents[run.id] = {};
  const runStart = performance.now();
  for (const set of sets) {
    const report = await measureFolder(set.folder, detectors[run.pack]);
    results[run.id][set.name] = report.totals;
    documents[run.id][set.name] = report.documents;
    console.log(`${run.id.padEnd(34)} ${set.name.padEnd(12)} ${totalsLine(report.totals)}`);
    if (run.ablates)
      for (const [name, entry] of Object.entries(report.documents)) {
        const before = documents[run.pack]?.[set.name]?.[name];
        if (!before || entry.error) continue;
        for (const key of ["notRead", "leaked", "over", "unlisted"])
          for (const value of entry[key])
            if (!before[key]?.includes(value))
              console.log(`           + ${key} ${set.name} ${name}: ${JSON.stringify(value)}`);
      }
  }
  console.log(`           ${Math.round((performance.now() - runStart) / 1000)} s`);
}
setVetoes([]);
for (const detector of Object.values(detectors)) await detector.dispose();

const seconds = (performance.now() - started) / 1000;
const verdicts = judgeAblations(runs, results);
const summary = {
  at: new Date().toISOString(),
  packs: { shipping: basename(shippingRoot), candidate: candidate ? basename(candidateRoot) : undefined },
  sets: sets.map((set) => ({
    name: set.name,
    folder: set.folder,
    documents: Object.keys(documents.shipping[set.name]).length,
  })),
  runs,
  results,
  verdicts,
  seconds,
};
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "report.json"), JSON.stringify({ ...summary, documents }, null, 2) + "\n");
const markdown = comparisonMarkdown(summary);
writeFileSync(join(out, "report.md"), markdown);
console.log(`\n${markdown}\nWritten to ${out}`);

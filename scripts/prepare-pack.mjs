// Pin local model files into a pack definition's `assets` list.
//
//   mise exec -- node scripts/prepare-pack.mjs <pack.json> <model root> [directory...]
//
// For every model directory of the pack (or only the directories named), the
// script hashes each regular file under `<model root>/<directory>/` and writes
// identity-transport entries with `url: null`. Such a pack installs from local
// files and is reported as unavailable to download; publish the files and fill
// in the transport entries (see packs/README.md) before shipping it. Nothing is
// downloaded, moved or deleted; LICENSE files are skipped because the
// installer writes them.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { validatePackDefinition } from "../src/core/detection/pack.ts";

const [packPath, modelRoot, ...selected] = process.argv.slice(2);
if (!packPath || !modelRoot) {
  console.error("Usage: node scripts/prepare-pack.mjs <pack.json> <model root> [directory...]");
  process.exit(2);
}
const pack = JSON.parse(await readFile(packPath, "utf8"));
const directories = pack.models.map((model) => model.directory);
for (const directory of selected)
  if (!directories.includes(directory)) throw new Error(`${directory} is not a model of this pack`);
const targets = selected.length ? selected : directories;

async function digest(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

const kept = (pack.assets ?? []).filter((asset) => !targets.includes(asset.directory));
const added = [];
for (const directory of targets) {
  const folder = join(resolve(modelRoot), directory);
  const names = (await readdir(folder)).filter((name) => !name.startsWith(".") && name !== "LICENSE").sort();
  for (const name of names) {
    const path = join(folder, name);
    const info = await stat(path);
    if (!info.isFile()) continue;
    const sha256 = await digest(path);
    added.push({
      directory,
      name,
      bytes: info.size,
      sha256,
      transport: { url: null, bytes: info.size, sha256, encoding: "identity", parts: [] },
    });
    console.log(`${directory}/${name}: ${info.size} bytes, ${sha256}`);
  }
}
const next = { ...pack, assets: [...kept, ...added] };
validatePackDefinition(next);
await writeFile(packPath, JSON.stringify(next, null, 2) + "\n");
console.log(`Wrote ${added.length} asset entr${added.length === 1 ? "y" : "ies"} to ${packPath}.`);

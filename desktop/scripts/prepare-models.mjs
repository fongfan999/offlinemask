import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, copyFile, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(await readFile(new URL("model-manifest.json", import.meta.url), "utf8"));
const mayDownload = process.argv.includes("--download");

async function digest(path) {
  try {
    const hash = createHash("sha256");
    for await (const part of createReadStream(path)) hash.update(part);
    return hash.digest("hex");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

for (const model of manifest.models) {
  const modelDir = join(root, "public/models", model.directory);
  await mkdir(modelDir, { recursive: true });
  for (const [name, expected] of Object.entries(model.files)) {
    const destination = join(modelDir, name);
    if (await digest(destination) === expected) continue;
    if (!mayDownload) throw new Error(`Missing or invalid model asset: ${name}. Run mise exec -- pnpm models:download, or supply the pinned files locally. Builds never download models automatically.`);
    const temporary = destination + ".download";
    console.log(`Downloading ${name} (resumable)…`);
    let failures = 0;
    while (true) {
      const offset = await stat(temporary).then((value) => value.size).catch(() => 0);
      try {
        const response = await fetch(`https://huggingface.co/${model.repository}/resolve/${model.revision}/${name}?offset=${offset}`, {
          headers: { Range: `bytes=${offset}-${offset + 8 * 1024 * 1024 - 1}` },
          signal: AbortSignal.timeout(180_000),
        });
        // A completed partial download may survive interruption before checksum verification.
        if (response.status === 416 && await digest(temporary) === expected) break;
        const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get("content-range") ?? "");
        if (!response.body || !(response.status === 206 && range && Number(range[1]) === offset)
          && !(response.status === 200 && offset === 0))
          throw new Error(`Model download failed: ${name} (${response.status})`);
        await pipeline(response.body, createWriteStream(temporary, { flags: offset ? "a" : "w" }));
        failures = 0;
        if (response.status === 200 || Number(range[2]) + 1 === Number(range[3])) break;
      } catch (error) {
        if (++failures >= 5) throw error; // Leave partial data for the next explicit download.
        await new Promise((resolve) => setTimeout(resolve, 1000 * failures));
      }
    }
    if (await digest(temporary) !== expected) {
      await rm(temporary, { force: true });
      throw new Error(`Model checksum mismatch: ${name}`);
    }
    await rename(temporary, destination);
  }
  // Both pinned model cards declare Apache-2.0; include the complete license in the bundle.
  await copyFile(join(root, "node_modules/openmed/LICENSE"), join(modelDir, "LICENSE"));
}
await import("./prepare-runtime.mjs");
console.log("Verified pinned development models.");

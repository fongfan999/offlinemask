// Puts OfflineMask's text recognition models (decision 0172) where the app serves them:
// `public/reading/`, beside the WASM runtime, so the build carries them inside the app.
// Each file of `reading/reading-v1.json` is taken from `reading/` itself (the recogniser
// is committed there), else from `artifacts/reading/`, else, when the definition names a
// source, fetched from it into `artifacts/reading/` (the detector). A file is used only
// when its size and SHA-256 match; a committed file that does not match fails the build.
// A file that cannot be had leaves `public/reading/` out, and the app then offers no
// reading of its own. The app itself never fetches these files.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const definition = JSON.parse(
  readFileSync(new URL("../reading/reading-v1.json", import.meta.url), "utf8"),
);
const committed = fileURLToPath(new URL("../reading/", import.meta.url));
const artifacts = fileURLToPath(new URL("../artifacts/reading/", import.meta.url));
const target = fileURLToPath(new URL("../public/reading/", import.meta.url));

const matches = (bytes, file) =>
  bytes.length === file.bytes && createHash("sha256").update(bytes).digest("hex") === file.sha256;

async function obtain(file) {
  if (existsSync(`${committed}${file.name}`)) {
    if (!matches(readFileSync(`${committed}${file.name}`), file))
      throw new Error(`reading/${file.name} does not match reading/reading-v1.json`);
    return `${committed}${file.name}`;
  }
  const path = `${artifacts}${file.name}`;
  if (existsSync(path) && matches(readFileSync(path), file)) return path;
  if (!file.source) return undefined;
  const response = await fetch(file.source);
  if (!response.ok) throw new Error(`${file.name}: ${response.status} from ${file.source}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!matches(bytes, file)) throw new Error(`${file.name} from ${file.source} does not match`);
  mkdirSync(artifacts, { recursive: true });
  writeFileSync(path, bytes);
  return path;
}

rmSync(target, { recursive: true, force: true });
const files = [definition.detector, definition.recogniser];
const paths = await Promise.all(files.map(obtain));
const missing = files.filter((_, index) => !paths[index]).map((file) => file.name);
if (missing.length) {
  console.log(`No text recognition models in this build (missing ${missing.join(", ")}).`);
} else {
  mkdirSync(target, { recursive: true });
  files.forEach((file, index) => copyFileSync(paths[index], `${target}${file.name}`));
  copyFileSync(new URL("../reading/reading-v1.json", import.meta.url), `${target}reading-v1.json`);
  console.log(`Prepared text recognition models (${definition.id}).`);
}

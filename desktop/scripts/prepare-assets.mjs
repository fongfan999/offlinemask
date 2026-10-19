import { cp, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
// Production builds never include locally downloaded development models.
// `public/runtime/` serves the WASM runtime to `vite dev` and evaluation scripts;
// the production bundle already emits that same binary at `dist/runtime/`.
const generated = new Set(["models", "runtime"]);
for (const name of await readdir(join(root, "public"))) {
  if (!generated.has(name))
    await cp(join(root, "public", name), join(root, "dist", name), { recursive: true });
}

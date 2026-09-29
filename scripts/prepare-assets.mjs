import { cp, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
// Production builds never include locally downloaded development models.
for (const name of await readdir(join(root, 'public'))) {
  if (name !== 'models') await cp(join(root, 'public', name), join(root, 'dist', name), {recursive:true});
}

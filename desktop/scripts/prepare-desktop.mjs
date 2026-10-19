import { cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'dist');
const destination = join(root, 'dist-desktop');
// Stage only lightweight frontend assets; optional models live in app-local data.
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true, filter: (path) => path !== join(source, 'models') });
console.log('Prepared lightweight desktop frontend without model weights.');

import { cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkWorkerChunks } from './check-worker-chunks.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'dist');
const destination = join(root, 'dist-desktop');
// Stage only lightweight frontend assets; optional models live in app-local data. The
// text recognition models (public/reading/, decision 0172) are part of the frontend.
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true, filter: (path) => path !== join(source, 'models') });
checkWorkerChunks(join(destination, 'assets'));
console.log('Prepared lightweight desktop frontend without model weights.');

// Developer release check. Never launches an app or reads its user-data directory.
import { execFileSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import runtime from './native-prototype/runtime-manifest.json' with { type: 'json' };
const bundle = resolve(process.argv[2] ?? 'src-tauri/target/release/bundle/macos/OfflineMask.app');
execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--all-architectures', bundle], { stdio: 'pipe' });
const resources = join(bundle, 'Contents/Resources');
const hash = data => createHash('sha256').update(data).digest('hex');
for (const name of ['LICENSE.txt', 'ThirdPartyNotices.txt']) {
  if (hash(await readFile(join(resources, 'licenses/onnxruntime-1.24.3', name))) !== hash(await readFile(new URL('../docs/licenses/onnxruntime-1.24.3/' + name, import.meta.url)))) throw Error('Missing or altered runtime notice');
}
const library = join(resources, 'native', runtime.file);
const helper = join(resources, 'native/recognition-sidecar');
for (const path of [library, helper]) {
  const dependencies = execFileSync('/usr/bin/otool', ['-L', path], { encoding: 'utf8' });
  if (dependencies.split('\n').slice(1).some(line => line.trim() && !/^\s+(?:\/usr\/lib\/|\/System\/Library\/|@rpath\/libonnxruntime\.)/.test(line))) throw Error('Unexpected native dependency');
}
let totalBytes = 0;
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw Error('Unexpected bundle symlink');
    if (entry.isDirectory()) await inspect(path);
    else {
      if (/\.onnx$|\.safetensors$|^model.*\.bin$/.test(entry.name)) throw Error('Model weights must not be bundled');
      totalBytes += (await stat(path)).size;
    }
  }
}
await inspect(bundle);
console.log(JSON.stringify({ bundle, signatureVerified: true, modelsBundled: false, totalBytes, runtimeSha256AfterSigning: hash(await readFile(library)), helperSha256AfterSigning: hash(await readFile(helper)) }, null, 2));

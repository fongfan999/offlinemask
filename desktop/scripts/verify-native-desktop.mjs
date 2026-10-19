// Developer release check. Never launches an app or reads its user-data directory.
// macOS arm64: the signed .app bundle (decision 0049). Windows x64: the release
// output directory Tauri packages into the installers (decision 0077).
import { execFileSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import runtimes from './native-runtimes.json' with { type: 'json' };
const runtime = runtimes.targets[`${process.platform}-${process.arch}`];
if (!runtime) throw Error('No native runtime is qualified for this platform');
const windows = process.platform === 'win32';
const hash = data => createHash('sha256').update(data).digest('hex');
const bundle = resolve(process.argv[2] ?? (windows ? 'src-tauri/target/release' : 'src-tauri/target/release/bundle/macos/OfflineMask.app'));
const resources = windows ? bundle : join(bundle, 'Contents/Resources');
if (!windows) execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--all-architectures', bundle], { stdio: 'pipe' });
for (const name of ['LICENSE.txt', 'ThirdPartyNotices.txt']) {
  if (hash(await readFile(join(resources, 'licenses/onnxruntime-1.24.3', name))) !== hash(await readFile(new URL('../../docs/licenses/onnxruntime-1.24.3/' + name, import.meta.url)))) throw Error('Missing or altered runtime notice');
}
const library = join(resources, 'native', runtime.file);
const helper = join(resources, 'native', windows ? 'recognition-sidecar.exe' : 'recognition-sidecar');

/** DLL names a PE file imports, directly or delay-loaded. */
function peImports(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const pe = view.getUint32(0x3c, true);
  const sections = view.getUint16(pe + 6, true);
  const optionalSize = view.getUint16(pe + 20, true);
  const optional = pe + 24;
  const directories = optional + (view.getUint16(optional, true) === 0x20b ? 112 : 96);
  const table = [];
  for (let i = 0; i < sections; i++) {
    const at = optional + optionalSize + i * 40;
    table.push({ va: view.getUint32(at + 12, true), size: Math.max(view.getUint32(at + 8, true), view.getUint32(at + 16, true)), raw: view.getUint32(at + 20, true) });
  }
  const offset = rva => { const s = table.find(s => rva >= s.va && rva < s.va + s.size); if (!s) throw Error('Bad PE'); return rva - s.va + s.raw; };
  const text = at => { let end = at; while (data[end]) end++; return Buffer.from(data.subarray(at, end)).toString('latin1'); };
  const names = { direct: [], delayed: [] };
  for (const [index, kind, step, field] of [[1, 'direct', 20, 12], [13, 'delayed', 32, 4]]) {
    const rva = view.getUint32(directories + index * 8, true);
    if (!rva) continue;
    for (let at = offset(rva); view.getUint32(at + field, true); at += step) names[kind].push(text(offset(view.getUint32(at + field, true))));
  }
  return names;
}
if (windows) {
  // Hashes the release build compiled in must match what was packaged.
  const expected = (await readFile('artifacts/native-desktop/native-sha256.txt', 'utf8')).trim().split(',').map(entry => entry.split('='));
  for (const [name, sha256] of expected) if (hash(await readFile(join(resources, 'native', name))) !== sha256) throw Error(`Native resource changed after preparation: ${name}`);
  const bundled = new Set([runtime.file, ...runtime.cppRuntime].map(name => name.toLowerCase()));
  const system = /^(api-ms-win-|ext-ms-win-)|^(kernel32|user32|advapi32|setupapi|dbghelp|ws2_32|ntdll|bcrypt|ole32|oleaut32|shell32|crypt32|secur32|userenv|shlwapi|version)\.dll$/i;
  for (const path of [library, helper]) {
    const imports = peImports(await readFile(path));
    const unexpected = imports.direct.filter(name => !system.test(name) && !bundled.has(name.toLowerCase()));
    if (unexpected.length) throw Error(`Unexpected native dependency in ${path}: ${unexpected.join(', ')}`);
  }
} else {
  for (const path of [library, helper]) {
    const dependencies = execFileSync('/usr/bin/otool', ['-L', path], { encoding: 'utf8' });
    if (dependencies.split('\n').slice(1).some(line => line.trim() && !/^\s+(?:\/usr\/lib\/|\/System\/Library\/|@rpath\/libonnxruntime\.)/.test(line))) throw Error('Unexpected native dependency');
  }
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
await inspect(windows ? join(resources, 'native') : bundle);
console.log(JSON.stringify({ bundle, signatureVerified: !windows, modelsBundled: false, totalBytes, runtimeSha256: hash(await readFile(library)), helperSha256: hash(await readFile(helper)) }, null, 2));

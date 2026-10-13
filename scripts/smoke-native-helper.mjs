// Start the packaged recognition helper and prove it loads the bundled ONNX Runtime
// (and on Windows its app-local C++ runtime) on this machine. No models are needed:
// the runtime loads before any request is read, so a protocol reply to a model
// request against an empty root shows the library loaded. Decision 0077.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import runtimes from './native-runtimes.json' with { type: 'json' };
const runtime = runtimes.targets[`${process.platform}-${process.arch}`];
if (!runtime) throw Error('No native runtime is qualified for this platform');
const directory = resolve(process.argv[2] ?? 'artifacts/native-desktop/native');
const helper = join(directory, process.platform === 'win32' ? 'recognition-sidecar.exe' : 'recognition-sidecar');
const empty = await mkdtemp(join(tmpdir(), 'offlinemask-smoke-'));
try {
  const child = spawn(helper, [join(directory, runtime.file), empty, '2'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk));
  const exited = new Promise((done) => child.on('exit', (code) => done(code)));
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  child.stdin.write(JSON.stringify({ id: 1, model: 0 }) + '\n');
  const reply = await Promise.race([
    lines.next().then(({ value }) => {
      if (value === undefined) throw Error('Helper closed without replying; the runtime did not load');
      return value;
    }),
    exited.then((code) => { throw Error(`Helper exited (${code}) before replying: ${stderr.trim()}`); }),
    new Promise((_, fail) => setTimeout(() => fail(Error('Helper did not reply within 60 s')), 60_000)),
  ]);
  const parsed = JSON.parse(reply);
  // Models are absent on purpose: an error reply for request 1 is the expected result.
  if (parsed.id !== 1 || !parsed.error) throw Error(`Unexpected reply: ${reply}`);
  child.stdin.end();
  const code = await exited;
  if (code !== 0) throw Error(`Helper did not exit cleanly (${code})`);
  console.log(JSON.stringify({ helper, runtime: runtime.file, runtimeLoaded: true, replied: parsed, exitCode: code }));
} finally {
  await rm(empty, { recursive: true, force: true });
}

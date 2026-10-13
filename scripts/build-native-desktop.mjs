// Build the desktop app with native recognition for a qualified target (decision 0077):
// prepare resources, build with the release feature, then verify the result.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const shell = process.platform === 'win32';
const run = (command, args, env = {}) =>
  execFileSync(command, args, { stdio: 'inherit', shell, env: { ...process.env, ...env } });
const extra = process.argv.slice(2);
run('pnpm', ['typecheck']);
run('node', ['scripts/prepare-native-desktop.mjs', ...extra.filter(arg => arg === '--qa')]);
const hashes = (await readFile('artifacts/native-desktop/native-sha256.txt', 'utf8')).trim();
run('pnpm', ['exec', 'tauri', 'build', '--features', 'recognition-native-release', '--config', 'artifacts/native-desktop/tauri.conf.json'], { OFFLINEMASK_NATIVE_SHA256: hashes });
run('node', ['scripts/verify-native-desktop.mjs']);
// Start the packaged helper once: it must load the bundled runtime on this machine.
run('node', ['scripts/smoke-native-helper.mjs', process.platform === 'win32' ? 'src-tauri/target/release/native' : 'src-tauri/target/release/bundle/macos/OfflineMask.app/Contents/Resources/native']);

// Explicit public-distribution build. This submits the application to Apple via Tauri.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
run(process.execPath, ['scripts/check-macos-release.mjs']);
run('pnpm', ['run', 'desktop:build:native']);
const bundle = join(root, 'src-tauri/target/release/bundle/macos/OfflineMask.app');
run('/usr/bin/xcrun', ['stapler', 'validate', bundle]);
run('/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose=2', bundle]);
console.log('Signed app passed stapled-ticket and Gatekeeper checks. Hardware qualification remains a separate release gate.');

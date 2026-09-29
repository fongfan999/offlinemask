// Choose only a platform/provider combination that has packaged-app evidence.
import { spawnSync } from 'node:child_process';
const native = process.platform === 'darwin' && process.arch === 'arm64';
if (native && process.argv.length > 2) throw Error('Use desktop:build:native for the standard macOS arm64 package; custom QA builds use tauri build with an explicit prepared config.');
const result = spawnSync('pnpm', native ? ['run', 'desktop:build:native'] : ['exec', 'tauri', 'build', ...process.argv.slice(2)], { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);

// Choose only a platform/provider combination that has packaged-app evidence.
// Native recognition is the default on macOS arm64 (decision 0049). Windows x64 can be
// built with `desktop:build:native` (decision 0077) and joins this list only after a
// Windows release candidate passes the same UI, offline and tamper checks.
import { spawnSync } from 'node:child_process';
const native = ['darwin-arm64'].includes(`${process.platform}-${process.arch}`);
if (native && process.argv.length > 2) throw Error('Use desktop:build:native for the standard native package; custom QA builds use tauri build with an explicit prepared config.');
const result = spawnSync('pnpm', native ? ['run', 'desktop:build:native'] : ['exec', 'tauri', 'build', ...process.argv.slice(2)], { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);

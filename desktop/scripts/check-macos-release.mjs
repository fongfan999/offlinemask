// Read-only distribution preflight. Never prints credentials or submits to Apple.
import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
const failures = [];
if (process.platform !== 'darwin' || process.arch !== 'arm64') failures.push('This release path requires macOS arm64.');
const identity = process.env.APPLE_SIGNING_IDENTITY?.trim();
const identities = spawnSync('/usr/bin/security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' });
const available = [...(identities.stdout ?? '').matchAll(/\b([A-F0-9]{40})\s+"(Developer ID Application: [^"]+)"/g)];
if (!identity || identity === '-' || !available.some(match => match[1] === identity || match[2] === identity)) {
  failures.push('Set APPLE_SIGNING_IDENTITY to an installed, valid Developer ID Application identity (name or SHA-1). Ad hoc signing is not a public release.');
}
const present = name => Boolean(process.env[name]?.trim());
const appleId = ['APPLE_ID', 'APPLE_PASSWORD', 'APPLE_TEAM_ID'].every(present);
const api = ['APPLE_API_ISSUER', 'APPLE_API_KEY', 'APPLE_API_KEY_PATH'].every(present);
if (!appleId && !api) failures.push('Configure one complete notarization credential set locally: APPLE_ID / APPLE_PASSWORD / APPLE_TEAM_ID, or APPLE_API_ISSUER / APPLE_API_KEY / APPLE_API_KEY_PATH.');
if (api) {
  try { await access(process.env.APPLE_API_KEY_PATH, constants.R_OK); }
  catch { failures.push('The configured notarization key file is not readable.'); }
}
for (const tool of ['notarytool', 'stapler']) {
  if (spawnSync('/usr/bin/xcrun', ['--find', tool], { stdio: 'ignore' }).status !== 0) failures.push(`Install Apple command-line tools providing ${tool}.`);
}
if (failures.length) {
  console.error('Public release prerequisites are incomplete:\n' + failures.map(message => '- ' + message).join('\n'));
  process.exitCode = 1;
} else console.log('Local signing prerequisites found. Apple authentication and notarization still require the actual release build.');

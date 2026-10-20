// Package the Windows release build as an MSIX for the Microsoft Store (decision 0117).
// Run after `pnpm desktop:build:native` on Windows. Tauri makes no MSIX, so this stages
// the built executable and its resources, fills store/AppxManifest.xml and packs it with
// the Windows SDK's makeappx. The Store re-signs the unsigned package it is given.
//
//   node scripts/build-msix.mjs              unsigned package for Partner Center
//   node scripts/build-msix.mjs --test-sign  also a self-signed copy and its .cer, to
//                                            install on a test PC before submitting
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") throw Error("MSIX packages are built on Windows");
const root = fileURLToPath(new URL("..", import.meta.url));
const release = join(root, "src-tauri/target/release");
const out = join(root, "artifacts/msix");
const stage = join(out, "stage");
const testSign = process.argv.includes("--test-sign");

const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const store = JSON.parse(await readFile(join(root, "store/microsoft-store.json"), "utf8"));
// Without the Partner Center identity the package installs for testing but cannot be
// uploaded; its name says so.
const test = !store.identityName;
const identity = test
  ? { identityName: "OfflineMask.Test", publisher: "CN=OfflineMask Test", publisherDisplayName: "OfflineMask (test)" }
  : store;
if (!test && (!store.publisher.startsWith("CN=") || !store.publisherDisplayName))
  throw Error("store/microsoft-store.json needs publisher (CN=…) and publisherDisplayName from Partner Center");
// MSIX versions have four parts and the Store requires the fourth to be 0.
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error(`Version ${version} is not X.Y.Z`);
const values = { ...identity, version: `${version}.0` };

await rm(out, { recursive: true, force: true });
await mkdir(join(stage, "Assets"), { recursive: true });
// What the NSIS and MSI installers put in the install folder: the executable and the
// bundled resources (native recognition helper and runtime, third-party licences).
const executable = join(release, "OfflineMask.exe");
if (!existsSync(executable)) throw Error("Build the app first: src-tauri/target/release/OfflineMask.exe is missing");
await cp(executable, join(stage, "OfflineMask.exe"));
for (const folder of ["native", "licenses"]) {
  if (!existsSync(join(release, folder))) throw Error(`Missing ${folder}/ next to the executable; run desktop:build:native`);
  await cp(join(release, folder), join(stage, folder), { recursive: true });
}
for (const icon of ["StoreLogo.png", "Square44x44Logo.png", "Square150x150Logo.png"])
  await cp(join(root, "src-tauri/icons", icon), join(stage, "Assets", icon));

const template = await readFile(join(root, "store/AppxManifest.xml"), "utf8");
const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const manifest = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
  if (!(key in values)) throw Error(`AppxManifest.xml uses unknown {{${key}}}`);
  return escape(values[key]);
});
await writeFile(join(stage, "AppxManifest.xml"), manifest);

// The newest Windows SDK on the machine provides makeappx and signtool.
const kits = "C:\\Program Files (x86)\\Windows Kits\\10\\bin";
const sdk = (await readdir(kits))
  .filter((name) => /^10\./.test(name) && existsSync(join(kits, name, "x64", "makeappx.exe")))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .at(-1);
if (!sdk) throw Error("No Windows SDK with makeappx.exe found");
const tool = (name) => join(kits, sdk, "x64", name);

const name = `OfflineMask_${version}_x64${test ? "_test-identity" : ""}`;
const unsigned = join(out, `${name}.msix`);
execFileSync(tool("makeappx.exe"), ["pack", "/d", stage, "/p", unsigned, "/o"], { stdio: "inherit" });
console.log(`Packed ${unsigned} (${test ? "test identity, not for upload" : identity.identityName})`);

if (testSign) {
  // A throwaway certificate whose subject equals the manifest Publisher, as Windows
  // requires. Installing it means trusting it on the test PC only.
  const signed = join(out, `${name}_test-signed.msix`);
  const pfx = join(out, "test-signing.pfx");
  const cer = join(out, `${name}_test-signed.cer`);
  const password = randomBytes(16).toString("hex");
  const script = [
    `$cert = New-SelfSignedCertificate -Type Custom -Subject '${identity.publisher.replace(/'/g, "''")}'`,
    `-KeyUsage DigitalSignature -FriendlyName 'OfflineMask MSIX test' -CertStoreLocation 'Cert:\\CurrentUser\\My'`,
    `-TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}') -NotAfter (Get-Date).AddDays(30);`,
    `Export-PfxCertificate -Cert $cert -FilePath '${pfx}' -Password (ConvertTo-SecureString -String $env:MSIX_TEST_PASSWORD -Force -AsPlainText) | Out-Null;`,
    `Export-Certificate -Cert $cert -FilePath '${cer}' | Out-Null;`,
    `Remove-Item -Path ('Cert:\\CurrentUser\\My\\' + $cert.Thumbprint)`,
  ].join(" ");
  execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
    stdio: "inherit",
    env: { ...process.env, MSIX_TEST_PASSWORD: password },
  });
  await cp(unsigned, signed);
  execFileSync(tool("signtool.exe"), ["sign", "/fd", "SHA256", "/f", pfx, "/p", password, signed], { stdio: "inherit" });
  await rm(pfx);
  console.log(`Test-signed ${signed}; trust ${cer} on the test PC to install it`);
}

// offlinemask.com's downloads (decision 0140): the Worker reads the newest published release and
// redirects /download/<platform> to its file, so the page never sends anyone to a GitHub page
// and never goes stale after a release.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker, { latestRelease, platforms } from "../../landing/worker.js";

const sums = [
  "OfflineMask-2.3.0-1.x86_64.rpm",
  "OfflineMask_2.3.0_aarch64.dmg",
  "OfflineMask_2.3.0_amd64.deb",
  "OfflineMask_2.3.0_x64-setup.exe",
  "OfflineMask_2.3.0_x64.dmg",
  "OfflineMask_2.3.0_x64_en-US.msi",
  "provenance-macos-arm64.json",
  "SHA256SUMS.txt",
]
  .map((file) => `${"0".repeat(64)}  ${file}`)
  .join("\n");
const github = (url) => {
  if (url.endsWith("/releases/latest/download/SHA256SUMS.txt")) return new Response(sums);
  if (url.endsWith("/v2.3.0/CHANGELOG.md")) return new Response("## [2.3.0] — 2026-11-02\n");
  return new Response("", { status: 404 });
};
const release = "https://github.com/fongfan999/offlinemask/releases/download/v2.3.0";

test("the newest release names every platform's file and its day", async () => {
  assert.deepEqual(await latestRelease(async (url) => github(url)), {
    version: "2.3.0",
    date: "2026-11-02",
    downloads: {
      "mac-arm": `${release}/OfflineMask_2.3.0_aarch64.dmg`,
      "mac-intel": `${release}/OfflineMask_2.3.0_x64.dmg`,
      windows: `${release}/OfflineMask_2.3.0_x64-setup.exe`,
      deb: `${release}/OfflineMask_2.3.0_amd64.deb`,
      rpm: `${release}/OfflineMask-2.3.0-1.x86_64.rpm`,
    },
  });
});

test("a release without a changelog day still has its version", async () => {
  const noChangelog = async (url) => (url.endsWith("CHANGELOG.md") ? github("") : github(url));
  assert.equal((await latestRelease(noChangelog)).date, undefined);
});

test("the Worker redirects downloads, answers the version and serves the rest as assets", async (t) => {
  t.mock.method(globalThis, "fetch", async (input) => github(String(input)));
  const env = { ASSETS: { fetch: async () => new Response("asset") } };
  const get = (path) => worker.fetch(new Request(`https://offlinemask.com${path}`), env);

  const download = await get("/download/mac-arm");
  assert.equal(download.status, 302);
  assert.equal(download.headers.get("location"), `${release}/OfflineMask_2.3.0_aarch64.dmg`);

  const latest = await (await get("/latest.json")).json();
  assert.equal(latest.version, "2.3.0");
  assert.equal(latest.downloads.deb, "/download/deb");
  assert.ok(!JSON.stringify(latest).includes("github"), "the page only learns its own paths");

  assert.equal(await (await get("/download/unknown")).text(), "asset");
  assert.equal(await (await get("/")).text(), "asset");
});

test("a download adds one to its day and platform, and nothing else", async (t) => {
  t.mock.method(globalThis, "fetch", async (input) => github(String(input)));
  const store = new Map();
  const env = {
    DOWNLOADS: {
      get: async (key) => store.get(key)?.[0] ?? null,
      put: async (k, v, { metadata }) => store.set(k, [v, metadata]),
    },
  };
  const pending = [];
  const context = { waitUntil: (promise) => pending.push(promise) };
  const get = (path) => worker.fetch(new Request(`https://offlinemask.com${path}`), env, context);
  assert.equal((await get("/download/deb")).status, 302);
  await Promise.all(pending);
  assert.equal((await get("/download/deb")).status, 302);
  await get("/latest.json");
  await Promise.all(pending);
  const day = new Date().toISOString().slice(0, 10);
  assert.deepEqual(Object.fromEntries(store), { [`${day} deb`]: ["2", { downloads: 2 }] });
});

test("a broken counter never stops a download", async (t) => {
  t.mock.method(globalThis, "fetch", async (input) => github(String(input)));
  const env = { DOWNLOADS: { get: async () => Promise.reject(new Error("KV down")) } };
  const pending = [];
  const context = { waitUntil: (promise) => pending.push(promise) };
  const reply = await worker.fetch(
    new Request("https://offlinemask.com/download/deb"),
    env,
    context,
  );
  assert.equal(reply.status, 302);
  await Promise.all(pending);
});

test("GitHub being down gives a short retry message, not a GitHub page", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("", { status: 502 }));
  const reply = await worker.fetch(new Request("https://offlinemask.com/download/deb"), {});
  assert.equal(reply.status, 503);
  assert.match(await reply.text(), /thử lại/);
});

test("every download link on the site is a platform the Worker serves", () => {
  for (const page of ["product.html", "install.html"]) {
    const html = readFileSync(new URL(`../../landing/${page}`, import.meta.url), "utf8");
    const links = [...html.matchAll(/href="\/download\/([^"]+)"/g)].map((match) => match[1]);
    assert.ok(links.length > 0, page);
    for (const link of links) assert.ok(Object.hasOwn(platforms, link), `${page}: ${link}`);
    // Footer links to the source and release notes stay; downloads never go through GitHub.
    const github = /github\.com\/[^"]*\/releases\/(latest|download)/.test(html);
    assert.ok(!github, `${page} sends a download through GitHub`);
  }
});

// Tells Bing and the other IndexNow engines which pages a push to main changed (decision 0199),
// so new posts and guides are found within the day rather than whenever the crawler comes back. Cloudflare
// deploys the site on its own, so this first waits until the live sitemap shows the changed posts'
// and privacy page's dates; for a change it cannot see there, it waits a few minutes instead.
//
// Usage: node scripts/indexnow.mjs <changed repository paths...>   (run from landing/)
import { readFileSync } from "node:fs";
import { allGuides, posts } from "../posts.js";
import { changedUrls, indexNowKey, privacyUpdated, site } from "../search.js";

const urls = changedUrls(process.argv.slice(2));
if (!urls.length) {
  console.log("No page's words changed; nothing to tell.");
  process.exit(0);
}

// What the live sitemap says once this push is deployed, for the URLs whose date it shows.
const dates = Object.fromEntries([
  ...[...posts(), ...allGuides()].map(({ path, updated }) => [`${site}${path}`, updated]),
  [
    `${site}/privacy`,
    privacyUpdated(readFileSync(new URL("../privacy.html", import.meta.url), "utf8")),
  ],
]);
const proofs = urls
  .filter((url) => dates[url])
  .map((url) => `<loc>${url}</loc><lastmod>${dates[url]}</lastmod>`);

const pause = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));
if (proofs.length) {
  for (let tries = 0; ; tries += 1) {
    const live = await fetch(`${site}/sitemap.xml`, { cache: "no-store" })
      .then((reply) => (reply.ok ? reply.text() : ""))
      .catch(() => "");
    if (proofs.every((proof) => live.includes(proof))) break;
    if (tries === 60) throw new Error("The live sitemap never showed this push; nothing was sent.");
    await pause(15);
  }
} else {
  await pause(180);
}

const reply = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(site).host, key: indexNowKey, urlList: urls }),
});
console.log(`IndexNow answered ${reply.status} for:\n${urls.join("\n")}`);
// 200 is received, 202 received with the key still being checked; anything else is a fault.
if (![200, 202].includes(reply.status)) process.exit(1);

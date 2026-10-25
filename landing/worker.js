// The site's only code on Cloudflare (decision 0140). Everything else is static assets; this
// answers two paths so downloads always reach the newest published release without a redeploy:
//   /latest.json         the newest version, its release day and its download paths
//   /download/<platform> a redirect straight to that release's file
// It asks GitHub, never the visitor's browser, so the page still loads nothing from third
// parties. It reads no cookies and keeps no logs (observability is off in wrangler.jsonc); each
// download adds one row of platform and country to a count (decision 0144), nothing else.

const repository = "https://github.com/fongfan999/offlinemask";
const raw = "https://raw.githubusercontent.com/fongfan999/offlinemask";
/** Each download the page offers, by the end of its file name in a release. */
export const platforms = {
  "mac-arm": /_aarch64\.dmg$/,
  "mac-intel": /_x64\.dmg$/,
  windows: /_x64-setup\.exe$/,
  deb: /_amd64\.deb$/,
  rpm: /\.x86_64\.rpm$/,
};
const fresh = 300; // seconds a release lookup is reused

/** The newest published release: GitHub resolves releases/latest and skips drafts. */
export async function latestRelease(fetcher = fetch) {
  const sums = await fetcher(`${repository}/releases/latest/download/SHA256SUMS.txt`);
  if (!sums.ok) throw new Error(`SHA256SUMS.txt: HTTP ${sums.status}`);
  const files = (await sums.text()).match(/\S+$/gm) ?? [];
  const version = files
    .map((file) => /^OfflineMask_(\d+\.\d+\.\d+)_/.exec(file)?.[1])
    .find(Boolean);
  if (!version) throw new Error("no OfflineMask file in SHA256SUMS.txt");
  const downloads = {};
  for (const [platform, ending] of Object.entries(platforms)) {
    const file = files.find((name) => ending.test(name));
    if (file) downloads[platform] = `${repository}/releases/download/v${version}/${file}`;
  }
  // "## [2.1.1] — 2026-10-24" in that tag's changelog; the page simply omits a missing date.
  let date;
  const changelog = await fetcher(`${raw}/v${version}/CHANGELOG.md`).catch(() => undefined);
  if (changelog?.ok) {
    const heading = new RegExp(
      `^## \\[${version.replaceAll(".", "\\.")}\\] — (\\d{4}-\\d{2}-\\d{2})`,
      "m",
    );
    date = heading.exec(await changelog.text())?.[1];
  }
  return { version, date, downloads };
}

/** The release, reused for a few minutes per Cloudflare location. */
async function cachedRelease(request, context) {
  const cache = globalThis.caches?.default;
  const key = new Request(new URL("/latest.json", request.url));
  const hit = await cache?.match(key);
  if (hit) return hit.json();
  const release = await latestRelease();
  const response = Response.json(release, {
    headers: { "cache-control": `public, max-age=${fresh}` },
  });
  context?.waitUntil(cache?.put(key, response) ?? Promise.resolve());
  return release;
}

const unavailable = () =>
  new Response("Chưa lấy được bản tải về. Bạn thử lại sau ít phút nhé.", {
    status: 503,
    headers: { "content-type": "text/plain; charset=utf-8", "retry-after": "60" },
  });

export default {
  async fetch(request, env, context) {
    const { pathname } = new URL(request.url);
    if (pathname === "/latest.json") {
      try {
        const { version, date } = await cachedRelease(request, context);
        const downloads = Object.fromEntries(
          Object.keys(platforms).map((platform) => [platform, `/download/${platform}`]),
        );
        return Response.json(
          { version, date, downloads },
          { headers: { "cache-control": `public, max-age=${fresh}` } },
        );
      } catch {
        return unavailable();
      }
    }
    const platform = /^\/download\/([\w-]+)$/.exec(pathname)?.[1];
    if (platform && Object.hasOwn(platforms, platform)) {
      try {
        const target = (await cachedRelease(request, context)).downloads[platform];
        if (target) {
          env.DOWNLOADS?.writeDataPoint({
            blobs: [platform, request.cf?.country ?? ""],
            indexes: [platform],
          });
          return Response.redirect(target, 302);
        }
      } catch {
        return unavailable();
      }
    }
    return env.ASSETS.fetch(request);
  },
};

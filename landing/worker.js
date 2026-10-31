// The site's only code on Cloudflare (decision 0140). Everything else is static assets; this
// answers three paths:
//   /latest.json         the newest version, its release day and its download paths
//   /download/<platform> a redirect straight to that release's file
//   /report              a bug report the visitor sends from /bao-loi (decision 0147)
// and the byte ranges of videos, which static assets always send whole, so a player could not seek.
// It asks GitHub, never the visitor's browser, so the page still loads nothing from third
// parties. It reads no cookies and keeps no logs (observability is off in wrangler.jsonc); each
// download adds one to that day's count for its platform (decision 0144), nothing else.

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

/**
 * Adds one to "2026-10-25 deb" in KV. The count is also the key's metadata, so one key listing
 * returns every day's numbers. Two downloads in the same moment may count once.
 */
async function count(store, platform) {
  const key = `${new Date().toISOString().slice(0, 10)} ${platform}`;
  try {
    const downloads = (Number(await store?.get(key)) || 0) + 1;
    await store?.put(key, String(downloads), { metadata: { downloads } });
  } catch {
    // A missed count never stops a download.
  }
}

/** What a report may say; the app fills these in, the visitor reads them and presses Gửi. */
export const reportKinds = ["missed", "wrong", "crash", "other"];
const reportLimits = { message: 2000, version: 20, os: 20, screen: 20 };

/** The report as stored, or undefined when it is not one the page could have sent. */
export function readReport(body) {
  if (!body || typeof body !== "object" || !reportKinds.includes(body.kind)) return undefined;
  const report = { kind: body.kind };
  for (const [field, limit] of Object.entries(reportLimits)) {
    const value = typeof body[field] === "string" ? body[field].trim() : "";
    if (value.length > limit) return undefined;
    report[field] = value;
  }
  return report.message ? report : undefined;
}

/**
 * Keeps one report in KV under "<time> <random>", with its kind and version as metadata so a
 * key listing shows what came in. Nothing about the sender: no IP address, country or browser.
 */
async function receiveReport(request, store) {
  const text = request.method === "POST" ? await request.text() : "";
  let body;
  try {
    body = text.length <= 8192 ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  const report = readReport(body);
  if (!report) return new Response("Báo lỗi chưa hợp lệ.", { status: 400 });
  const at = new Date().toISOString();
  const key = `${at} ${crypto.randomUUID().slice(0, 8)}`;
  await store.put(key, JSON.stringify({ at, ...report }), {
    metadata: { kind: report.kind, version: report.version },
  });
  return new Response(null, { status: 204 });
}

/**
 * The asset, or the bytes a Range header asks for. Cloudflare's static assets ignore Range and
 * answer 200 with the whole file; a video player needs 206 to jump to a point it has not loaded.
 */
export async function assetRange(request, assets) {
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  const asset = await assets.fetch(request);
  if (asset.status !== 200 || !range || (!range[1] && !range[2])) return withRanges(asset);
  const body = await asset.arrayBuffer();
  const size = body.byteLength;
  // "bytes=500-" is from 500 to the end; "bytes=-500" is the last 500 bytes.
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  const headers = new Headers(asset.headers);
  headers.set("accept-ranges", "bytes");
  if (start >= size || start > end) {
    headers.set("content-range", `bytes */${size}`);
    headers.delete("content-length");
    return new Response(null, { status: 416, headers });
  }
  headers.set("content-range", `bytes ${start}-${end}/${size}`);
  headers.set("content-length", String(end - start + 1));
  return new Response(body.slice(start, end + 1), { status: 206, headers });
}

const withRanges = (response) => {
  const headers = new Headers(response.headers);
  headers.set("accept-ranges", "bytes");
  return new Response(response.body, { status: response.status, headers });
};

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
    if (pathname === "/report") {
      try {
        return await receiveReport(request, env.REPORTS);
      } catch {
        return new Response("Chưa gửi được. Bạn thử lại sau ít phút nhé.", { status: 503 });
      }
    }
    const platform = /^\/download\/([\w-]+)$/.exec(pathname)?.[1];
    if (platform && Object.hasOwn(platforms, platform)) {
      try {
        const target = (await cachedRelease(request, context)).downloads[platform];
        if (target) {
          context?.waitUntil(count(env.DOWNLOADS, platform));
          return Response.redirect(target, 302);
        }
      } catch {
        return unavailable();
      }
    }
    if (pathname.endsWith(".mp4")) return assetRange(request, env.ASSETS);
    return env.ASSETS.fetch(request);
  },
};

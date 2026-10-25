import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const fragment = new URL("./product.html", import.meta.url);
const repository = "https://github.com/fongfan999/offlinemask";
const { storeId } = JSON.parse(
  readFileSync(new URL("../desktop/store/microsoft-store.json", import.meta.url), "utf8"),
);
// The Mac and Linux links download files straight from the newest published GitHub release
// (decision 0139). Its SHA256SUMS.txt lists every file, so the build names that release's
// version and refuses a link to a file it does not have. A version bump that is tagged but
// not yet published therefore keeps the page on the previous, downloadable release.
async function latestRelease() {
  try {
    const response = await fetch(`${repository}/releases/latest/download/SHA256SUMS.txt`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const files = (await response.text()).match(/\S+$/gm) ?? [];
    const version = files
      .map((file) => /^OfflineMask_(\d+\.\d+\.\d+)_/.exec(file)?.[1])
      .find(Boolean);
    if (!version) throw new Error("no OfflineMask file in SHA256SUMS.txt");
    return { version, files: new Set(files) };
  } catch (error) {
    // A deploy must not guess; offline local work falls back to the version being developed.
    if (process.env.CI || process.env.WORKERS_CI) {
      throw new Error(`Cannot read the latest release: ${error.message}`, { cause: error });
    }
    const { version } = JSON.parse(
      readFileSync(new URL("../desktop/package.json", import.meta.url), "utf8"),
    );
    console.warn(`Latest release unavailable (${error.message}); links use ${version} unchecked.`);
    return { version };
  }
}
const release = await latestRelease();
// "## [2.1.1] — 2026-10-24" in the changelog gives the release day, shown beside the version.
const releaseDate = (() => {
  const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
  const day = new RegExp(
    `^## \\[${release.version.replaceAll(".", "\\.")}\\] — (\\d{4})-(\\d{2})-(\\d{2})`,
    "m",
  ).exec(changelog);
  if (!day) throw new Error(`CHANGELOG.md has no dated section for ${release.version}`);
  return `${Number(day[3])}/${Number(day[2])}/${day[1]}`;
})();
const withRelease = (html) =>
  html
    .replaceAll("__OM_VERSION__", release.version)
    .replaceAll("__OM_RELEASE_DATE__", releaseDate)
    .replaceAll("__OM_STORE_ID__", storeId)
    .replace(/__OM_DOWNLOAD__\/([^"\s]+)/g, (_, file) => {
      if (release.files && !release.files.has(file)) {
        throw new Error(`Release ${release.version} has no ${file}`);
      }
      return `${repository}/releases/download/v${release.version}/${file}`;
    });
const productPage = () => readFileSync(fragment, "utf8");
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  publicDir: false,
  plugins: [
    {
      name: "offlinemask-product-page",
      transformIndexHtml: {
        order: "pre",
        handler: (html) => withRelease(html.replace("<!-- product-page -->", productPage())),
      },
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "font-licenses.txt",
          source: readFileSync(new URL("./font-licenses.txt", import.meta.url), "utf8"),
        });
        this.emitFile({
          type: "asset",
          fileName: "og.png",
          source: readFileSync(new URL("./og/og.png", import.meta.url)),
        });
      },
      configureServer(server) {
        server.watcher.add(fileURLToPath(fragment));
        server.watcher.on("change", (path) => {
          if (path === fileURLToPath(fragment)) server.ws.send({ type: "full-reload" });
        });
      },
    },
    {
      // Each page's stylesheet goes inline, so the first paint waits on the HTML alone rather than
      // a second request; every page has its own small stylesheet, so nothing is lost to caching.
      // The scripts only animate and enhance pages that already read without them, so they are
      // fetched at low priority and the fonts and images they would compete with come first
      // (the home page's main script also waits for the load event; see main.js).
      name: "offlinemask-first-paint",
      apply: "build",
      enforce: "post",
      transformIndexHtml: {
        order: "post",
        handler(html, { filename, bundle }) {
          // The home page's hero uses all four font files; asking for them up front means they
          // usually arrive before the first paint rather than swapping in after it.
          const fonts = filename.endsWith("index.html")
            ? Object.keys(bundle)
                .filter((file) => file.endsWith(".woff2"))
                .map(
                  (file) =>
                    `<link rel="preload" href="./${file}" as="font" type="font/woff2" crossorigin>`,
                )
                .join("")
            : "";
          return html
            .replace("</title>", `</title>${fonts}`)
            .replace(
              /<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g,
              (_, file) =>
                // The stylesheet's URLs are relative to assets/; the page sits one level up.
                `<style>${bundle[file].source.replace(/url\(\.\//g, "url(./assets/")}</style>`,
            )
            .replace(
              /<(script type="module"|link rel="modulepreload") /g,
              '<$1 fetchpriority="low" ',
            );
        },
      },
      generateBundle(_, bundle) {
        for (const file of Object.keys(bundle)) if (file.endsWith(".css")) delete bundle[file];
      },
    },
  ],
  server: { port: 4322, strictPort: true },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        privacy: fileURLToPath(new URL("./privacy.html", import.meta.url)),
        install: fileURLToPath(new URL("./install.html", import.meta.url)),
      },
    },
  },
});

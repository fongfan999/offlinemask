import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { releaseDay } from "./latest.js";
import { robots, sitemap, structuredData } from "./search.js";
import worker, { latestRelease } from "./worker.js";

const fragment = new URL("./product.html", import.meta.url);
const { storeId } = JSON.parse(
  readFileSync(new URL("../desktop/store/microsoft-store.json", import.meta.url), "utf8"),
);
// Downloads go through the Worker's /download/<platform>, which always redirects to the newest
// published release; the page asks /latest.json for its version (decision 0140). The build only
// writes the version that is newest now, so the page reads right before its script runs.
const release = await latestRelease().catch((error) => {
  const { version } = JSON.parse(
    readFileSync(new URL("../desktop/package.json", import.meta.url), "utf8"),
  );
  const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
  const date = new RegExp(`^## \\[${version.replaceAll(".", "\\.")}\\] — (\\S+)`, "m").exec(
    changelog,
  )?.[1];
  console.warn(`Latest release unavailable (${error.message}); the page names ${version}.`);
  return { version, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined };
});
const withRelease = (html) =>
  html
    .replaceAll("__OM_VERSION__", release.version)
    .replaceAll("__OM_RELEASE_DATE__", release.date ? releaseDay(release.date) : "")
    .replaceAll("__OM_STORE_ID__", storeId);
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
        handler: (html) =>
          withRelease(
            html
              .replace("<!-- product-page -->", productPage())
              .replace("<!-- structured-data -->", () =>
                structuredData({
                  fragment: productPage(),
                  description: /<meta\s+name="description"\s+content="([^"]+)"/.exec(html)[1],
                  version: release.version,
                }),
              ),
          ),
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
        // Crawlers' files (decision 0145); the site's other paths are its three pages.
        this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap() });
        this.emitFile({ type: "asset", fileName: "robots.txt", source: robots() });
      },
      configureServer(server) {
        // The dev server answers the Worker's paths with the Worker itself.
        server.middlewares.use(async (request, response, next) => {
          if (!/^\/(latest\.json|download\/)/.test(request.url)) return next();
          const reply = await worker.fetch(new Request(`http://localhost${request.url}`), {
            ASSETS: { fetch: () => new Response("Not found", { status: 404 }) },
          });
          response.statusCode = reply.status;
          reply.headers.forEach((value, name) => response.setHeader(name, value));
          response.end(Buffer.from(await reply.arrayBuffer()));
        });
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

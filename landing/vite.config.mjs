import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { releaseDay } from "./latest.js";
import {
  blogDescription,
  blogTitle,
  fill,
  images,
  indexPage,
  postPage,
  posts,
  rss,
} from "./posts.js";
import { card } from "./cards.js";
import { llms, pages, robots, sitemap, structuredData } from "./search.js";
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
const home = fileURLToPath(new URL("./index.html", import.meta.url));
const blogTemplate = new URL("./blog/index.html", import.meta.url);
// Each page's own title and description, for llms.txt.
const pageFiles = { "/": "index.html", "/privacy": "privacy.html", "/install": "install.html" };
const describe = (path) => {
  if (!pageFiles[path]) return { path, title: blogTitle, description: blogDescription };
  const html = readFileSync(new URL(pageFiles[path], import.meta.url), "utf8");
  return {
    path,
    title: /<title>([^<]+)<\/title>/.exec(html)[1].replace(/ — OfflineMask$/, ""),
    description: /<meta\s+name="description"\s+content="([^"]+)"/.exec(html)[1],
  };
};
const postPath = (url) => /^\/blog\/([a-z0-9-]+)$/.exec(url.split("?")[0])?.[1];
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
        this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap(posts()) });
        this.emitFile({ type: "asset", fileName: "robots.txt", source: robots() });
        // Cloudflare serves .txt as "text/plain" with no charset, and browsers then read UTF-8
        // Vietnamese as Latin-1; _headers (read by Cloudflare, not served) names the charset.
        // Everything in assets/ has its content hash in its name, so browsers keep it for a year
        // instead of asking again on every visit (Cloudflare's default is max-age=0).
        this.emitFile({
          type: "asset",
          fileName: "_headers",
          source:
            ["/llms.txt", "/font-licenses.txt", "/robots.txt"]
              .map((path) => `${path}\n  Content-Type: text/plain; charset=utf-8\n`)
              .join("") + "/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n",
        });
        this.emitFile({
          type: "asset",
          fileName: "llms.txt",
          source: llms({ pages: pages.map(describe), posts: posts() }),
        });
      },
      configureServer(server) {
        // The dev server answers the Worker's paths with the Worker itself; reports it is sent
        // are only printed.
        server.middlewares.use(async (request, response, next) => {
          if (!/^\/(latest\.json|download\/|report$)/.test(request.url)) return next();
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          const body = ["GET", "HEAD"].includes(request.method) ? undefined : Buffer.concat(chunks);
          const reply = await worker.fetch(
            new Request(`http://localhost${request.url}`, { method: request.method, body }),
            {
              ASSETS: { fetch: () => new Response("Not found", { status: 404 }) },
              REPORTS: { put: async (key, value) => console.log(`Report ${key}: ${value}`) },
            },
          );
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
          const fonts =
            filename === home
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
              /<link rel="stylesheet"[^>]*href="(\.\/|(?:\.\.\/)+)(assets\/[^"]+\.css)"[^>]*>/g,
              (_, up, file) =>
                // The stylesheet's URLs are relative to assets/; the page reaches it through `up`.
                `<style>${bundle[file].source.replace(/url\(\.\//g, `url(${up}assets/`)}</style>`,
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
    {
      // The blog (decision 0146): blog/index.html is the template for the list and for every
      // post. The dev server fills it per request; the build fills it once the page is final
      // (its stylesheet inlined), so each post is the same page with other head and main.
      name: "offlinemask-blog",
      enforce: "post",
      transformIndexHtml: {
        order: "pre",
        handler(html, { path, server }) {
          if (!server || !html.includes("<!-- blog-main -->")) return html;
          const entries = posts();
          const post = entries.find(({ slug }) => slug === postPath(path));
          return fill(html, post ? postPage(post, entries) : indexPage(entries));
        },
      },
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const image = /^\/blog\/([a-z0-9-]+)\.png$/.exec(request.url.split("?")[0])?.[1];
          const post = image && posts().find(({ slug }) => slug === image);
          if (!post) return next();
          response.setHeader("content-type", "image/png");
          response.end(await card(post));
        });
        server.middlewares.use(async (request, response, next) => {
          if (!postPath(request.url)) return next();
          try {
            const html = await server.transformIndexHtml(
              request.url,
              readFileSync(blogTemplate, "utf8"),
            );
            response.setHeader("content-type", "text/html; charset=utf-8");
            response.end(html);
          } catch (error) {
            next(error);
          }
        });
        server.watcher.add(fileURLToPath(new URL("./blog/posts/", import.meta.url)));
        server.watcher.on("change", (path) => {
          if (path.endsWith(".md")) server.ws.send({ type: "full-reload" });
        });
      },
      async generateBundle(_, bundle) {
        const page = bundle["blog/index.html"];
        if (!page) return;
        const entries = posts();
        for (const post of entries)
          this.emitFile({
            type: "asset",
            fileName: `blog/${post.slug}.html`,
            source: fill(page.source, postPage(post, entries)),
          });
        for (const post of entries)
          this.emitFile({
            type: "asset",
            fileName: `blog/${post.slug}.png`,
            source: await card(post),
          });
        page.source = fill(page.source, indexPage(entries));
        this.emitFile({ type: "asset", fileName: "blog/rss.xml", source: rss(entries) });
        for (const picture of new Set(entries.flatMap(({ pictures }) => pictures)))
          this.emitFile({
            type: "asset",
            fileName: `blog/images/${picture}`,
            source: readFileSync(new URL(picture, images)),
          });
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
        report: fileURLToPath(new URL("./bao-loi.html", import.meta.url)),
        blog: fileURLToPath(blogTemplate),
      },
    },
  },
});

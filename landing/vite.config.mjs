import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const fragment = new URL("./product.html", import.meta.url);
// Download links name the desktop release this page ships beside; the four manifests share it.
const { version } = JSON.parse(
  readFileSync(new URL("../desktop/package.json", import.meta.url), "utf8"),
);
// Once the Microsoft Store listing is live, its ID switches the Windows download from the
// GitHub installers to the Store (decision 0117). Each variant sits between
// <!-- windows-direct --> or <!-- windows-store --> markers in product.html.
const { storeId } = JSON.parse(
  readFileSync(new URL("../desktop/store/microsoft-store.json", import.meta.url), "utf8"),
);
const dropped = storeId ? "windows-direct" : "windows-store";
const productPage = () =>
  readFileSync(fragment, "utf8")
    .replace(new RegExp(`\\s*<!-- ${dropped} -->[\\s\\S]*?<!-- /${dropped} -->`, "g"), "")
    .replace(/\s*<!-- \/?windows-(direct|store) -->/g, "")
    .replaceAll("__OM_VERSION__", version)
    .replaceAll("__OM_STORE_ID__", storeId);
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  publicDir: false,
  plugins: [
    {
      name: "offlinemask-product-page",
      transformIndexHtml: {
        order: "pre",
        handler: (html) => html.replace("<!-- product-page -->", productPage()),
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

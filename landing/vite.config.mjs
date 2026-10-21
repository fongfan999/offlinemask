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

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const fragment = new URL("./product.html", import.meta.url);
// Download links name the desktop release this page ships beside; the four manifests share it.
const { version } = JSON.parse(
  readFileSync(new URL("../desktop/package.json", import.meta.url), "utf8"),
);
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
          html.replace(
            "<!-- product-page -->",
            readFileSync(fragment, "utf8").replaceAll("__OM_VERSION__", version),
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
  build: { outDir: "dist", emptyOutDir: true },
});

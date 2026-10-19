import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const fragment = new URL("./product.html", import.meta.url);
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  publicDir: false,
  plugins: [
    {
      name: "offlinemask-product-page",
      transformIndexHtml: {
        order: "pre",
        handler: (html) => html.replace("<!-- product-page -->", readFileSync(fragment, "utf8")),
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
  build: { outDir: "../dist-landing", emptyOutDir: true },
});

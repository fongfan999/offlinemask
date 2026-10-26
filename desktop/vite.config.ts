import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import process from "node:process";
import { fileURLToPath } from "node:url";
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
// onnxruntime-web references its WASM binary relative to the detection worker.
// Emit that single copy at the stable `/runtime/` path the detector already
// loads, instead of shipping a second hashed copy next to the worker chunk.
const assetFileNames = (asset: { names?: string[]; name?: string }) =>
  (asset.names?.[0] ?? asset.name ?? "").endsWith(".wasm")
    ? "runtime/[name][extname]"
    : "assets/[name]-[hash][extname]";

export default defineConfig(() => ({
  plugins: [vue()],
  build: {
    copyPublicDir: false,
    rollupOptions: {
      // The floating quick-action panel is its own small page (decision 0090).
      input: {
        main: fileURLToPath(new URL("index.html", import.meta.url)),
        pill: fileURLToPath(new URL("pill.html", import.meta.url)),
      },
      output: { assetFileNames },
    },
  },
  worker: {
    // Workers are started as modules, so they can load code on demand: pdf.js stays
    // out of the files worker until a PDF opens (decision 0149).
    format: "es" as const,
    rollupOptions: { output: { assetFileNames } },
    // Shared code goes into a chunk of its own, never exported from the worker's
    // entry: WebKit evaluates a module worker's entry a second time when a chunk
    // imports it back, and the fresh copy swallows the replies the first one waits
    // for (masking stalled at 0 % in the 2.3.0 build). Vite sets
    // preserveEntrySignatures to false for worker bundles after merging the options
    // above, so a plugin sets it back in the options hook.
    plugins: () => [
      {
        name: "offlinemask:worker-entry-signatures",
        options: (options) => ({ ...options, preserveEntrySignatures: "strict" as const }),
      },
    ],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));

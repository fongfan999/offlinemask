/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

/** pdf.js's worker, imported for its side effect of registering itself (decision 0149). */
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs";

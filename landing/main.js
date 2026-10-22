import "./product.css";

// The page reads and animates in without its script (the hero intro is CSS), so the script waits
// until the page has loaded and painted its content instead of competing with the fonts and images
// for that first paint. A browser that reports no paint starts it a moment after loading.
let dispose = () => {};
const start = () =>
  import("./product.js").then(({ initOfflineMask }) => {
    dispose = initOfflineMask(document.querySelector("[data-om-page]"));
  });
const loaded = new Promise((resolve) =>
  document.readyState === "complete"
    ? resolve()
    : addEventListener("load", resolve, { once: true }),
);
const painted = new Promise((resolve) => {
  if (!PerformanceObserver.supportedEntryTypes?.includes("paint")) return resolve();
  const observer = new PerformanceObserver((list) => {
    if (!list.getEntriesByName("first-contentful-paint").length) return;
    observer.disconnect();
    resolve();
  });
  observer.observe({ type: "paint", buffered: true });
  loaded.then(() => setTimeout(resolve, 3000));
});
Promise.all([loaded, painted]).then(() => requestAnimationFrame(() => setTimeout(start)));
if (import.meta.hot) import.meta.hot.dispose(() => dispose());

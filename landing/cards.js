// Each blog post's share image, /blog/<slug>.png (decision 0148): the home page's share card in
// spirit (cobalt, the wordmark), with the post's title. Drawn at build time with Satori (layout
// and text to SVG paths) and resvg (SVG to PNG), both pure JavaScript and WebAssembly, so the
// Cloudflare build needs no browser and no system fonts.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import satori from "satori";
import { day } from "./posts.js";

const require = createRequire(import.meta.url);
// Satori reads WOFF but not WOFF2, so the cards use the static Noto Sans cuts rather than the
// page's variable ones. Each weight comes as a Latin and a Vietnamese subset, named as two
// families: Satori falls back from family to family for a missing glyph, not within one.
const fonts = [500, 700].flatMap((weight) =>
  ["latin", "vietnamese"].map((subset) => ({
    name: `Noto Sans ${subset}`,
    weight,
    style: "normal",
    data: readFileSync(
      require.resolve(`@fontsource/noto-sans/files/noto-sans-${subset}-${weight}-normal.woff`),
    ),
  })),
);

let ready;
const wasm = () =>
  (ready ??= initWasm(readFileSync(require.resolve("@resvg/resvg-wasm/index_bg.wasm"))));

const element = (type, style, children) => ({ type, props: { style, children } });

// The logotype's swipe (decision 0193), light cobalt as on every cobalt ground, stretched
// behind "Mask" the way the site's CSS does it.
const swipe = `data:image/svg+xml;base64,${Buffer.from(
  readFileSync(new URL("../brand/wordmark-swipe.svg", import.meta.url), "utf8").replace(
    "<path ",
    '<path fill="#b3c3ff" ',
  ),
).toString("base64")}`;

/** The 1200×630 PNG for a post. */
export async function card({ title, date }) {
  const svg = await satori(
    element(
      "div",
      {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        color: "#f7f5ee",
        fontFamily: "Noto Sans latin, Noto Sans vietnamese",
        backgroundColor: "#3453b6",
        backgroundImage:
          "radial-gradient(circle at 12% 18%, #6f8de8 0%, transparent 45%), radial-gradient(circle at 90% 100%, #1d3184 0%, transparent 55%)",
      },
      [
        element(
          "div",
          { display: "flex", fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: -1.6 },
          [
            element("span", {}, "Offline"),
            element(
              "span",
              {
                position: "relative",
                display: "flex",
                marginLeft: 4,
                padding: "0 5px",
                lineHeight: 1,
                letterSpacing: -0.8,
                color: "#3453b6",
              },
              [
                {
                  type: "img",
                  props: {
                    src: swipe,
                    style: { position: "absolute", left: -1, top: 0, width: "103%", height: 44 },
                  },
                },
                "Mask",
              ],
            ),
          ],
        ),
        element(
          "div",
          {
            display: "flex",
            fontSize: title.length > 48 ? 60 : 68,
            fontWeight: 700,
            lineHeight: 1.18,
            letterSpacing: -1.8,
          },
          title,
        ),
        element(
          "div",
          {
            display: "flex",
            justifyContent: "space-between",
            color: "#b3c3ff",
            fontSize: 28,
            fontWeight: 500,
          },
          [element("span", {}, `Blog - ${day(date)}`), element("span", {}, "offlinemask.com")],
        ),
      ],
    ),
    { width: 1200, height: 630, fonts },
  );
  await wasm();
  return Buffer.from(new Resvg(svg).render().asPng());
}

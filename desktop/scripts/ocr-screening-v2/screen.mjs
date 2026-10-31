// Screens OfflineMask's own line recogniser (decision 0181) the way ocr-screening-v1 screened
// VietOCR and decision 0180 Vision and Tesseract: every page of one seed's text PDFs drawn
// at 200 dpi and passed through JPEG quality 80 (as the rasterised scans are), the engine's
// text, whitespace squeezed, searched for every value of the expectation lists.
//
//   mise exec -- node scripts/ocr-screening-v2/screen.mjs <seed folder> <models folder>
//        --recogniser <run folder> [--out <file.json>] [--limit <documents>]
//
// The models folder holds `ppocrv4-det/ch_PP-OCRv4_det_infer.onnx` (RapidOCR's ONNX export of
// PaddleOCR's PP-OCRv4 mobile detector, Apache-2.0); the run folder `recogniser.onnx` and
// `charset.json` from scripts/ocr-train/train.py --export. ONNX Runtime is the
// onnxruntime-node 1.24.3 already installed under @huggingface/transformers. Nothing is
// written but the optional report.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const [seedFolder, modelsFolder] = args.filter(
  (value, index) => !value.startsWith("--") && !args[index - 1]?.startsWith("--"),
);
if (!seedFolder || !modelsFolder) {
  console.error(
    "Usage: node screen.mjs <seed folder> <models folder> [--max-width 0] [--out f] [--limit n]",
  );
  process.exit(2);
}
const maxWidth = Number(option("--max-width", 0));
const limit = Number(option("--limit", Infinity));
// --dump <file.png>: the first boxes as the recogniser sees them, stacked, to look at.
const dump = option("--dump");
const dumped = [];

const require = createRequire(import.meta.url);
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const transformers = require.resolve("@huggingface/transformers");
const ort = createRequire(transformers)("onnxruntime-node");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
await import("pdfjs-dist/legacy/build/pdf.worker.mjs");

const detector = await ort.InferenceSession.create(
  join(modelsFolder, "ppocrv4-det/ch_PP-OCRv4_det_infer.onnx"),
);
const run = option("--recogniser");
if (!run) throw new Error("--recogniser <run folder> is required");
const recogniser = await ort.InferenceSession.create(join(run, "recogniser.onnx"));
const alphabet = JSON.parse(readFileSync(join(run, "charset.json"), "utf8"));

/** Every page of a PDF as a canvas, at 200 dpi through JPEG quality 80. */
async function pages(bytes) {
  const task = pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    useWasm: false,
    verbosity: 0,
  });
  const document = await task.promise;
  const out = [];
  try {
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const viewport = page.getViewport({ scale: 200 / 72 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvas, viewport, background: "#ffffff" }).promise;
      const image = await loadImage(canvas.toBuffer("image/jpeg", 80));
      const scan = createCanvas(image.width, image.height);
      scan.getContext("2d").drawImage(image, 0, 0);
      out.push(scan);
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return out;
}

/** PP-OCRv4 detection with PaddleOCR's DB post-processing (thresh 0.3, box 0.6, unclip
 * 1.5), boxes axis-aligned in the page's pixels. */
async function detect(page) {
  const width = Math.ceil(page.width / 32) * 32;
  const height = Math.ceil(page.height / 32) * 32;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(page, 0, 0);
  const rgba = context.getImageData(0, 0, width, height).data;
  const plane = width * height;
  const input = new Float32Array(3 * plane);
  // PaddleOCR reads BGR and normalises channel by channel with ImageNet's mean and spread.
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  for (let at = 0; at < plane; at++) {
    for (let channel = 0; channel < 3; channel++) {
      const value = rgba[at * 4 + (2 - channel)] / 255;
      input[channel * plane + at] = (value - mean[channel]) / std[channel];
    }
  }
  const result = await detector.run({ x: new ort.Tensor("float32", input, [1, 3, height, width]) });
  const map = Object.values(result)[0].data;
  const seen = new Uint8Array(plane);
  const boxes = [];
  const stack = new Int32Array(plane);
  for (let start = 0; start < plane; start++) {
    if (seen[start] || map[start] <= 0.3) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let x0 = width,
      y0 = height,
      x1 = 0,
      y1 = 0,
      count = 0,
      sum = 0;
    while (top) {
      const at = stack[--top];
      const x = at % width,
        y = (at - x) / width;
      count++;
      sum += map[at];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const next of [at - 1, at + 1, at - width, at + width]) {
        if (next < 0 || next >= plane || seen[next] || map[next] <= 0.3) continue;
        if ((next === at - 1 && x === 0) || (next === at + 1 && x === width - 1)) continue;
        seen[next] = 1;
        stack[top++] = next;
      }
    }
    const w = x1 - x0 + 1,
      h = y1 - y0 + 1;
    if (Math.min(w, h) < 3 || sum / count < 0.6) continue;
    const distance = (w * h * 1.5) / (2 * (w + h));
    boxes.push({
      x: Math.max(0, x0 - distance),
      y: Math.max(0, y0 - distance),
      width: Math.min(page.width, x1 + 1 + distance) - Math.max(0, x0 - distance),
      height: Math.min(page.height, y1 + 1 + distance) - Math.max(0, y0 - distance),
    });
  }
  return boxes;
}

/** The recogniser was trained on lines up to 1 024 wide at height 32; a wider box is cut
 * at word gaps (the widest run of blank columns near every `piece` of width) and each
 * piece read alone, joined by a space. */
const piece = Number(option("--piece", 896));
async function read(page, box) {
  const width = Math.max(32, Math.ceil((32 * box.width) / box.height));
  if (!piece || width <= piece + piece / 6) return readOne(page, box);
  const canvas = createCanvas(width, 32);
  const context = canvas.getContext("2d");
  context.drawImage(page, box.x, box.y, box.width, box.height, 0, 0, width, 32);
  const rgba = context.getImageData(0, 0, width, 32).data;
  const ink = new Float32Array(width);
  for (let x = 0; x < width; x++)
    for (let y = 0; y < 32; y++) {
      const at = (y * width + x) * 4;
      const dark = 255 - (rgba[at] + rgba[at + 1] + rgba[at + 2]) / 3;
      if (dark > 96) ink[x]++;
    }
  // Runs of blank columns, as [start, end).
  const gaps = [];
  for (let x = 0; x < width;) {
    if (ink[x] > 0) {
      x++;
      continue;
    }
    const start = x;
    while (x < width && ink[x] === 0) x++;
    if (x - start >= 2 && start > 0 && x < width) gaps.push([start, x]);
  }
  const cuts = [0];
  while (width - cuts.at(-1) > piece + piece / 6) {
    const from = cuts.at(-1);
    const candidates = gaps.filter(
      ([start, end]) =>
        (start + end) / 2 > from + piece / 2 && (start + end) / 2 < from + piece * 1.15,
    );
    const best = candidates.reduce(
      (best, gap) => (!best || gap[1] - gap[0] > best[1] - best[0] ? gap : best),
      undefined,
    );
    cuts.push(best ? Math.round((best[0] + best[1]) / 2) : from + piece);
  }
  cuts.push(width);
  const texts = [];
  for (let index = 0; index + 1 < cuts.length; index++) {
    const scale = box.width / width;
    texts.push(
      await readOne(page, {
        x: box.x + cuts[index] * scale,
        y: box.y,
        width: (cuts[index + 1] - cuts[index]) * scale,
        height: box.height,
      }),
    );
  }
  return texts.join(" ");
}

/** The recogniser on one box: height 32 at the box's aspect, grey as Pillow's "L"
 * (0.299 R + 0.587 G + 0.114 B), scaled to -1..1; CTC read greedily (best class per
 * step, repeats merged, blanks dropped). */
async function readOne(page, box) {
  let width = Math.max(32, Math.round((32 * box.width) / box.height));
  if (maxWidth) width = Math.min(width, maxWidth);
  const canvas = createCanvas(width, 32);
  const context = canvas.getContext("2d");
  context.drawImage(page, box.x, box.y, box.width, box.height, 0, 0, width, 32);
  if (dump && dumped.length < 48) dumped.push(canvas);
  const rgba = context.getImageData(0, 0, width, 32).data;
  const input = new Float32Array(width * 32);
  for (let at = 0; at < input.length; at++) {
    const grey = (299 * rgba[at * 4] + 587 * rgba[at * 4 + 1] + 114 * rgba[at * 4 + 2]) / 1000;
    input[at] = (grey / 255 - 0.5) / 0.5;
  }
  const { probabilities } = await recogniser.run({
    image: new ort.Tensor("float32", input, [1, 1, 32, width]),
  });
  const [steps, , classes] = probabilities.dims;
  let text = "";
  let previous = 0;
  for (let step = 0; step < steps; step++) {
    const row = probabilities.data.subarray(step * classes, (step + 1) * classes);
    let best = 0;
    for (let index = 1; index < classes; index++) if (row[index] > row[best]) best = index;
    if (best !== previous && best !== 0) text += alphabet[best];
    previous = best;
  }
  return text;
}

/** --grow g: each box widened by g of its height on every side (the detector hugs the ink;
 * the recogniser was trained with a margin), within the page. */
const grow = Number(option("--grow", 0));
function grown(page, box) {
  const by = grow * box.height;
  const x = Math.max(0, box.x - by),
    y = Math.max(0, box.y - by);
  return {
    x,
    y,
    width: Math.min(page.width, box.x + box.width + by) - x,
    height: Math.min(page.height, box.y + box.height + by) - y,
  };
}

/** The boxes in reading order: rows by overlapping middles, left to right in each. */
function order(boxes) {
  const sorted = boxes.toSorted((a, b) => a.y + a.height / 2 - (b.y + b.height / 2));
  const rows = [];
  for (const box of sorted) {
    const middle = box.y + box.height / 2;
    const row = rows.at(-1);
    if (row && Math.abs(middle - row.middle) < Math.min(box.height, row.height) / 2)
      row.boxes.push(box);
    else rows.push({ middle, height: box.height, boxes: [box] });
  }
  return rows.flatMap((row) => row.boxes.toSorted((a, b) => a.x - b.x));
}

/** A picture as it is, on a canvas. */
async function picture(bytes) {
  const image = await loadImage(bytes);
  const canvas = createCanvas(image.width, image.height);
  canvas.getContext("2d").drawImage(image, 0, 0);
  return canvas;
}

const squeeze = (text) => text.normalize("NFC").replace(/\s+/g, " ").trim();
const list = (folder) =>
  readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return list(path);
    return /\.(pdf|png)$/i.test(path) && statSync(`${path}.expect.json`, { throwIfNoEntry: false })
      ? [path]
      : [];
  });

const totals = {
  hide: 0,
  hideRead: 0,
  hideFolded: 0,
  keep: 0,
  keepRead: 0,
  keepFolded: 0,
  pages: 0,
  seconds: 0,
};
const documents = [];
for (const path of list(seedFolder).slice(0, limit)) {
  const expect = JSON.parse(readFileSync(`${path}.expect.json`, "utf8"));
  const started = performance.now();
  const texts = [];
  const bytes = readFileSync(path);
  for (const page of /\.png$/i.test(path)
    ? [await picture(bytes)]
    : await pages(new Uint8Array(bytes))) {
    for (const box of order(await detect(page))) texts.push(await read(page, grown(page, box)));
    totals.pages++;
  }
  const seconds = (performance.now() - started) / 1000;
  const text = squeeze(texts.join(" "));
  const missed = { hide: [], keep: [] };
  for (const kind of ["hide", "keep"]) {
    // A hide entry is a value or { value, in }: the value as it stands in its context.
    for (const entry of expect[kind] ?? []) {
      const value = typeof entry === "string" ? entry : entry.value;
      totals[kind]++;
      if (text.includes(squeeze(value))) totals[`${kind}Read`]++;
      else missed[kind].push(value);
      if (text.toLowerCase().includes(squeeze(value).toLowerCase())) totals[`${kind}Folded`]++;
    }
  }
  totals.seconds += seconds;
  documents.push({ document: relative(seedFolder, path), seconds, missed, text });
  console.log(
    `${relative(seedFolder, path)}: ${seconds.toFixed(1)} s, hide missed ${missed.hide.length}, keep missed ${missed.keep.length}`,
  );
}
console.log(
  `${documents.length} documents, ${totals.pages} pages in ${totals.seconds.toFixed(0)} s: hide ${totals.hideRead} (${totals.hideFolded} ignoring case) / ${totals.hide}, keep ${totals.keepRead} (${totals.keepFolded} ignoring case) / ${totals.keep}`,
);
const out = option("--out");
if (out) writeFileSync(out, JSON.stringify({ totals, documents }, null, 2));
if (dump) {
  const montage = createCanvas(
    Math.max(...dumped.map((canvas) => canvas.width)),
    dumped.length * 34,
  );
  const context = montage.getContext("2d");
  context.fillStyle = "#ff00ff";
  context.fillRect(0, 0, montage.width, montage.height);
  dumped.forEach((canvas, index) => context.drawImage(canvas, 0, index * 34));
  writeFileSync(dump, montage.toBuffer("image/png"));
}

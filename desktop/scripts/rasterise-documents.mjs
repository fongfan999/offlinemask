// Turns a folder of PDFs into scans (decision 0171): every page is drawn with pdf.js and
// put back into a PDF as a picture alone, the way a copier's PDF holds it, so that the
// same expectation lists judge what text recognition reads. A one-page document is
// also written as a PNG picture, which measures the image route. Nothing of the text
// layer survives: the output has no text to read without recognition.
//
//   mise exec -- node scripts/rasterise-documents.mjs <source folder> <target folder>
//                 [--dpi 200] [--jpeg 80] [--grey] [--tilt <degrees>] [--photo]
//
// --jpeg writes the pictures as JPEG at that quality (a copier's choice; the default)
// and --grey in greyscale; --dpi sets the scan resolution (200 by default, what office
// copiers use). The `<document>.expect.json` beside each PDF is copied along.
//
// --tilt turns every page by that many degrees, one document clockwise and the next
// counter-clockwise, as a page fed or laid crooked (decision 0172). --photo makes the
// page look photographed rather than scanned: off-white paper, light falling off towards
// one corner, a slight blur and grain. Both are deterministic: the same folder gives the
// same pictures.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, relative, resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import { listDocuments } from "./document-evaluation.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? Number(args[index + 1]) : fallback;
};
const positional = args.filter(
  (value, index) =>
    !value.startsWith("--") && !["--dpi", "--jpeg", "--tilt"].includes(args[index - 1]),
);
if (positional.length !== 2) {
  console.error(
    "Usage: node scripts/rasterise-documents.mjs <source folder> <target folder> [--dpi 200] [--jpeg 80] [--grey] [--tilt <degrees>] [--photo]",
  );
  process.exit(2);
}
const [source, target] = positional.map((folder) => resolve(folder));
const dpi = option("--dpi", 200);
const quality = option("--jpeg", 80);
const grey = args.includes("--grey");
const tilt = option("--tilt", 0);
const photo = args.includes("--photo");

const require = createRequire(import.meta.url);
const { createCanvas } = require("@napi-rs/canvas");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
await import("pdfjs-dist/legacy/build/pdf.worker.mjs");

/** A page as a crooked or photographed one: turned by `degrees` about its centre onto
 * paper of the same size, then, for a photograph, shaded, softened and grained. */
function damage(canvas, degrees, seed) {
  if (!degrees && !photo) return canvas;
  const out = createCanvas(canvas.width, canvas.height);
  const context = out.getContext("2d");
  context.fillStyle = photo ? "#ebe6dc" : "#ffffff";
  context.fillRect(0, 0, out.width, out.height);
  context.save();
  context.translate(out.width / 2, out.height / 2);
  context.rotate((degrees * Math.PI) / 180);
  if (photo) context.globalCompositeOperation = "multiply";
  if (photo) context.filter = "blur(0.8px)";
  context.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  context.restore();
  if (!photo) return out;
  // Light falls off towards one corner, a different one for each document.
  const corner = seed % 4;
  const gradient = context.createLinearGradient(
    corner & 1 ? out.width : 0,
    corner & 2 ? out.height : 0,
    corner & 1 ? 0 : out.width,
    corner & 2 ? 0 : out.height,
  );
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(1, "#a9a49b");
  context.globalCompositeOperation = "multiply";
  context.fillStyle = gradient;
  context.fillRect(0, 0, out.width, out.height);
  context.globalCompositeOperation = "source-over";
  const image = context.getImageData(0, 0, out.width, out.height);
  let state = seed * 2654435761 + 1;
  for (let at = 0; at < image.data.length; at += 4) {
    state = (state * 1103515245 + 12345) >>> 0;
    const grain = ((state >>> 16) % 25) - 12;
    for (let channel = 0; channel < 3; channel++)
      image.data[at + channel] = Math.max(0, Math.min(255, image.data[at + channel] + grain));
  }
  context.putImageData(image, 0, 0);
  return out;
}

/** Each page of a PDF as a JPEG picture with its size in points. */
async function drawPages(bytes, degrees = 0, seed = 0) {
  const task = pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    useWasm: false,
    verbosity: 0,
  });
  const document = await task.promise;
  const pages = [];
  try {
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const points = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: dpi / 72 });
      const drawn = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvas: drawn, viewport, background: "#ffffff" }).promise;
      const canvas = damage(drawn, degrees, seed + number);
      const context = canvas.getContext("2d");
      if (grey) {
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const data = image.data;
        for (let at = 0; at < data.length; at += 4) {
          const value = Math.round(0.299 * data[at] + 0.587 * data[at + 1] + 0.114 * data[at + 2]);
          data[at] = data[at + 1] = data[at + 2] = value;
        }
        context.putImageData(image, 0, 0);
      }
      pages.push({
        jpeg: canvas.toBuffer("image/jpeg", quality),
        png: document.numPages === 1 ? canvas.toBuffer("image/png") : undefined,
        width: points.width,
        height: points.height,
      });
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return pages;
}

/** The pictures as a PDF with one page each and nothing else: no text, no metadata. */
async function picturesPdf(pages) {
  const doc = await PDFDocument.create();
  const fixed = new Date("2026-10-28T00:00:00Z");
  doc.setCreationDate(fixed);
  doc.setModificationDate(fixed);
  doc.setProducer("OfflineMask rasterised documents");
  for (const page of pages) {
    const image = await doc.embedJpg(page.jpeg);
    doc.addPage([page.width, page.height]).drawImage(image, {
      x: 0,
      y: 0,
      width: page.width,
      height: page.height,
    });
  }
  return doc.save({ useObjectStreams: false });
}

rmSync(target, { recursive: true, force: true });
let written = 0;
let pictures = 0;
for (const path of listDocuments(source).filter((file) => file.toLowerCase().endsWith(".pdf"))) {
  const pages = await drawPages(
    new Uint8Array(readFileSync(path)),
    written % 2 ? -tilt : tilt,
    written,
  );
  const out = join(target, relative(source, path));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, await picturesPdf(pages));
  copyFileSync(`${path}.expect.json`, `${out}.expect.json`);
  written++;
  if (pages[0]?.png) {
    const picture = out.replace(/\.pdf$/i, ".png");
    writeFileSync(picture, pages[0].png);
    copyFileSync(`${path}.expect.json`, `${picture}.expect.json`);
    pictures++;
  }
  console.log(`${basename(out)}: ${pages.length} page(s)`);
}
console.log(`${written} scanned PDF(s) and ${pictures} picture(s) in ${target}`);

// Measures PDF reading against the budgets of decision 0149: first page, time per page,
// memory added at the peak, and the image count, on two generated files: 300 pages of
// Vietnamese text with a picture every fifteenth page, and a file near the 20 MB limit made
// mostly of pictures. Each is drawn twice: with the test fonts, whose Latin and
// Vietnamese letters are separate subsets, so every line breaks into many small pieces
// (a worst case), and with one system font that has every letter, as a PDF exported
// from Word is (macOS's Arial; skipped where it is missing).
// Run with `node --expose-gc scripts/measure-pdf.mjs`.
import { existsSync, readFileSync } from "node:fs";
import { newDocument, noisePng } from "../tests/pdf-fixtures.mjs";
import { countLargeImages, openPdf } from "../src/core/doc/pdf.ts";

const A4 = [595, 842];
const sentence =
  "Bên thuê là ông Nguyễn Văn An, sinh năm 1985, số điện thoại 0912345678, cư trú tại số 12 đường Lê Lợi, phường Bến Nghé, Quận 1. ";

const systemFont = "/System/Library/Fonts/Supplemental/Arial.ttf";
const oneFont = existsSync(systemFont) ? readFileSync(systemFont) : undefined;

async function longFile(font) {
  const { doc, draw } = await newDocument(font);
  for (let number = 1; number <= 300; number++) {
    const page = doc.addPage(A4);
    draw(page, `Trang ${number} — Hợp đồng thuê nhà`, 50, 800, 13);
    const lines = number % 15 === 0 ? 14 : 40;
    for (let line = 0; line < lines; line++)
      draw(page, sentence.slice((line * 7) % 40, ((line * 7) % 40) + 80), 50, 770 - line * 18);
    if (number % 15 === 0)
      page.drawImage(await doc.embedPng(noisePng(500, 400)), { x: 50, y: 60, width: 495, height: 400 });
  }
  return doc.save();
}

async function heavyFile(font) {
  const { doc, draw } = await newDocument(font);
  for (let number = 1; number <= 25; number++) {
    const page = doc.addPage(A4);
    for (let line = 0; line < 10; line++) draw(page, sentence.slice(0, 80), 50, 800 - line * 18);
    page.drawImage(await doc.embedPng(noisePng(620, 400)), { x: 0, y: 0, width: 595, height: 560 });
  }
  return doc.save();
}

async function measure(name, bytes) {
  globalThis.gc?.();
  const before = process.memoryUsage();
  let peakRss = before.rss;
  let peakHeap = before.heapUsed + before.arrayBuffers;
  const sample = setInterval(() => {
    const now = process.memoryUsage();
    peakRss = Math.max(peakRss, now.rss);
    peakHeap = Math.max(peakHeap, now.heapUsed + now.arrayBuffers);
  }, 2);
  const imagesStart = performance.now();
  const images = countLargeImages(bytes);
  const imagesTime = performance.now() - imagesStart;
  const start = performance.now();
  let firstPage = 0;
  const opened = await openPdf(bytes.slice(), {
    onPage: (read) => {
      if (read === 1) firstPage = performance.now() - start;
    },
  });
  const total = performance.now() - start;
  clearInterval(sample);
  globalThis.gc?.();
  const after = process.memoryUsage();
  const pages = opened.source.pages.length;
  const mb = (value) => `${(value / 1e6).toFixed(0)} MB`;
  console.log(
    [
      `${name}: ${(bytes.length / 1e6).toFixed(1)} MB, ${pages} pages, ${opened.paragraphs.length} paragraphs, ${images} large images`,
      `  first page in ${firstPage.toFixed(0)} ms (includes loading pdf.js the first time)`,
      `  ${(total / pages).toFixed(1)} ms per page, ${total.toFixed(0)} ms in all`,
      `  image count ${imagesTime.toFixed(0)} ms`,
      `  kept after reading: ${mb(after.heapUsed + after.arrayBuffers - before.heapUsed - before.arrayBuffers)} (paragraphs and the copy of the file)`,
      `  peak added: RSS ${mb(peakRss - before.rss)}, JS heap and buffers ${mb(peakHeap - before.heapUsed - before.arrayBuffers)} (garbage included)`,
    ].join("\n"),
  );
}

const files = [
  ["300 pages, split fonts", await longFile()],
  ["near 20 MB, split fonts", await heavyFile()],
];
if (oneFont)
  files.push(
    ["300 pages, one font", await longFile(oneFont)],
    ["near 20 MB, one font", await heavyFile(oneFont)],
  );
for (const [name, bytes] of files) await measure(name, bytes);
// Again, now that pdf.js is loaded and the JIT is warm.
for (const [name, bytes] of files) await measure(`${name} (second run)`, bytes);

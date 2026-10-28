import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { openDocument, writeDocument } from "../src/core/doc/document.ts";
import { maskParagraphs } from "../src/core/doc/mask.ts";
import { imageSize, ocrNote, ocrTextItems, openImage } from "../src/core/doc/ocr.ts";
import { openPdf, readByPlace } from "../src/core/doc/pdf.ts";
import { fileKind } from "../src/core/file-kind.ts";
import { fixtures, noisePng } from "./pdf-fixtures.mjs";

// Text in pictures (decision 0171). The engine is the system's; these tests stand a
// fake one in its place that answers with lines placed like Vision's: boxes in
// fractions of the picture, origin top left.
const line = (text, x, y, width, height = 0.02) => ({ text, confidence: 0.9, x, y, width, height });
const failure = (code) => (error) => error?.code === code;
const texts = (opened) => opened.paragraphs.map((paragraph) => paragraph.text);

/** A one-page JPEG picture. */
async function jpeg(width = 600, height = 800) {
  // pdf-lib cannot write JPEG; a minimal baseline JPEG header with the size is enough
  // for the size reader, and the fake engine never decodes it.
  const sof = [
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x03,
  ];
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, ...sof, 0xff, 0xd9]);
}

test("PNG and JPEG sizes are read from their headers", async () => {
  assert.deepEqual(imageSize(noisePng(400, 560)), { width: 400, height: 560 });
  assert.deepEqual(imageSize(await jpeg(1240, 1754)), { width: 1240, height: 1754 });
  assert.equal(imageSize(new TextEncoder().encode("%PDF-1.4")), undefined);
});

test("recognised words become text items placed like pdf.js's, with y upwards", () => {
  const items = ocrTextItems(
    {
      lines: [
        line("Họ ", 0.1, 0.2, 0.05, 0.065),
        line("tên:", 0.16, 0.2, 0.1, 0.065),
        line("|", 0.3, 0.2, 0.01, 0.065),
      ],
    },
    1000,
    2000,
  );
  // 150 pixels for a capital, four small letters and a colon (3.381 font sizes of room):
  // a 44-pixel font, whatever the 130-pixel box; the table rule read as "|" is dropped.
  const size = 150 / (0.731 + 4 * 0.571 + 0.366);
  assert.deepEqual(items, [
    { str: "Họ ", transform: [size, 0, 0, size, 100, 1470], width: 50 },
    { str: "tên:", transform: [size, 0, 0, size, 160, 1470], width: 100 },
  ]);
});

test("a picture reads by place: a form row, a table and a wrapped paragraph", async () => {
  const engine = async () => ({
    lines: [
      line("PHIẾU KHÁM BỆNH", 0.35, 0.05, 0.3, 0.03),
      line("Họ tên: Trần Thị Mai", 0.1, 0.12, 0.3),
      line("Điện thoại: 0912345678", 0.6, 0.12, 0.3),
      line("Khoản mục", 0.1, 0.2, 0.15),
      line("Số lượng", 0.45, 0.2, 0.12),
      line("Thành tiền", 0.75, 0.2, 0.15),
      line("Khám tổng quát", 0.1, 0.24, 0.2),
      line("1", 0.45, 0.24, 0.02),
      line("300.000", 0.75, 0.24, 0.1),
      line("Xét nghiệm máu", 0.1, 0.28, 0.2),
      line("2", 0.45, 0.28, 0.02),
      line("450.000", 0.75, 0.28, 0.1),
      line("Kết luận: các chỉ số trong giới hạn bình thường, đề nghị tái", 0.1, 0.4, 0.8),
      line("khám sau 6 tháng.", 0.1, 0.43, 0.25),
    ],
  });
  const opened = await openImage(noisePng(1000, 1400), engine, readByPlace);
  assert.deepEqual(texts(opened), [
    "PHIẾU KHÁM BỆNH",
    "Họ tên: Trần Thị Mai · Điện thoại: 0912345678",
    "Khoản mục\tSố lượng\tThành tiền",
    "Khám tổng quát\t1\t300.000",
    "Xét nghiệm máu\t2\t450.000",
    "Kết luận: các chỉ số trong giới hạn bình thường, đề nghị tái khám sau 6 tháng.",
  ]);
  assert.deepEqual(opened.notes, [ocrNote]);
  assert.equal(opened.source.format, "image");
  const table = opened.paragraphs.filter((paragraph) => paragraph.table !== undefined);
  assert.equal(table.length, 3);
});

test("a picture's masked copy is Markdown built from the text alone", async () => {
  const engine = async () => ({
    lines: [line("Họ tên: Trần Thị Mai", 0.1, 0.12, 0.3), line("SĐT 0912345678", 0.1, 0.16, 0.2)],
  });
  const opened = await openDocument(noisePng(800, 600), "giấy.png", { ocr: engine });
  const detections = new Map([
    [0, [{ start: 8, end: 20, type: "TEN", label: "TEN", source: "t", reason: "t", priority: 1 }]],
  ]);
  const { edits } = maskParagraphs(opened.paragraphs, detections, "4aae");
  const written = new TextDecoder().decode(await writeDocument(opened.source, edits));
  assert.match(written, /^Họ tên: \[TEN_1_4aae\]\n\nSĐT 0912345678\n$/u);
  assert.doesNotMatch(written, /PNG|IHDR/);
});

test("a picture is refused without recognition, when empty, and when too large", async () => {
  await assert.rejects(openDocument(noisePng(10, 10), "a.png"), failure("no-ocr"));
  await assert.rejects(
    openImage(noisePng(10, 10), async () => ({ lines: [] }), readByPlace),
    failure("empty"),
  );
  await assert.rejects(
    openImage(await jpeg(6000, 5000), async () => ({ lines: [] }), readByPlace),
    failure("too-large"),
  );
  await assert.rejects(
    openImage(
      noisePng(10, 10),
      async () => {
        throw new Error("engine");
      },
      readByPlace,
    ),
    failure("unreadable"),
  );
});

test("a scanned page among text pages is drawn and read; the picture never reaches the output", async () => {
  const pictures = [];
  const engine = async (image) => {
    pictures.push(image);
    return { lines: [line("Trang hai: khách hàng Lê Văn Hùng, 0987654321.", 0.1, 0.1, 0.6)] };
  };
  const opened = await openPdf(await fixtures.mixedScan(), { ocr: engine });
  assert.deepEqual(
    opened.source.pages.map((page) => page.kind),
    ["text", "scanned", "text"],
  );
  assert.deepEqual(texts(opened), [
    "Trang một: hợp đồng của Trịnh Văn Long.",
    "Trang hai: khách hàng Lê Văn Hùng, 0987654321.",
    "Trang ba: chữ ký các bên.",
  ]);
  assert.equal(pictures.length, 1);
  // Drawn at 200 dpi: the fixture's 595 × 842 pt page is 1 653 × 2 339.
  assert.deepEqual(imageSize(pictures[0]), { width: 1653, height: 2339 });
  assert.deepEqual(opened.notes, [
    "Trang 2 là ảnh scan: chữ được đọc bằng nhận dạng ký tự nên có thể sai sót. Hãy xem lại bản đã ẩn trước khi gửi.",
  ]);
  const written = new TextDecoder().decode(
    await writeDocument(opened.source, { paragraphs: new Map() }),
  );
  assert.match(
    written,
    /## Trang 2\n\nTrang hai: khách hàng Lê Văn Hùng, 0987654321\.\n\n## Trang 3/,
  );
  assert.doesNotMatch(written, /ảnh scan/);
});

test("an all-scanned PDF opens with recognition and is refused without it", async () => {
  const engine = async () => ({ lines: [line("Chữ trên trang scan.", 0.1, 0.1, 0.5)] });
  const opened = await openPdf(await fixtures.allScanned(), { ocr: engine });
  assert.deepEqual(texts(opened), ["Chữ trên trang scan.", "Chữ trên trang scan."]);
  assert.deepEqual(opened.notes, [
    "Chữ được đọc từ ảnh scan bằng nhận dạng ký tự nên có thể sai sót. Hãy xem lại bản đã ẩn trước khi gửi.",
  ]);
  await assert.rejects(openPdf(await fixtures.allScanned()), failure("scanned"));
});

test("a page where recognition finds nothing is blank, and a failing engine leaves the page unread", async () => {
  const blank = await openPdf(await fixtures.mixedScan(), { ocr: async () => ({ lines: [] }) });
  assert.deepEqual(
    blank.source.pages.map((page) => page.kind),
    ["text", "blank", "text"],
  );
  assert.match(blank.notes[0], /^Trang 2 không có chữ đọc được \(trang trống hoặc ảnh quá mờ\)/);
  const written = new TextDecoder().decode(
    await writeDocument(blank.source, { paragraphs: new Map() }),
  );
  assert.match(written, /## Trang 2\n\n\(Trang không có chữ đọc được, trang trống hoặc ảnh quá mờ/);
  const failing = await openPdf(await fixtures.mixedScan(), {
    ocr: async () => {
      throw new Error("engine");
    },
  });
  assert.deepEqual(
    failing.source.pages.map((page) => page.kind),
    ["text", "no-text", "text"],
  );
});

test("a scanned page of a real picture is drawn from the file's image", async () => {
  // The fixture's "scan" is noise; a picture of a known colour proves the page is drawn.
  const doc = await PDFDocument.create();
  const png = await doc.embedPng(noisePng(400, 560));
  doc.addPage([595, 842]).drawImage(png, { x: 0, y: 0, width: 595, height: 842 });
  const bytes = await doc.save();
  let drawn;
  await openPdf(bytes, {
    ocr: async (image) => {
      drawn = image;
      return { lines: [line("x", 0, 0, 0.1)] };
    },
  });
  assert.ok(drawn && drawn.length > 1000);
  assert.deepEqual(imageSize(drawn), { width: 1653, height: 2339 });
});

test("pictures open on Tài liệu only where the machine reads them", () => {
  assert.equal(fileKind("ảnh.png"), "upcoming");
  assert.equal(fileKind("ảnh.png", { images: true }), "word");
  assert.equal(fileKind("ảnh.JPG", { images: true }), "word");
  assert.equal(fileKind("ảnh.heic", { images: true }), "upcoming");
  assert.equal(fileKind("hồ sơ.pdf", { images: true }), "word");
});

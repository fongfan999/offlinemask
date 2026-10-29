import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { openDocument, writeDocument } from "../src/core/doc/document.ts";
import { maskParagraphs } from "../src/core/doc/mask.ts";
import { imageSize, ocrNote, ocrTextItems, openImage } from "../src/core/doc/ocr.ts";
import { OffscreenCanvasFactory, openPdf, readByPlace } from "../src/core/doc/pdf.ts";
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

test("an engine that measures its print gets the mean of that and the widths, snapped to the body size", () => {
  // Decision 0172. Two boxes at the same height are two lines when the engine numbers them;
  // each word is a 0.1-wide "aaaaa" (2.855 font sizes of room, 35 pixels by width).
  const word = (x, y, number, measured) => ({
    ...line("aaaaa", x, y, 0.1, 0.03),
    line: number,
    size: measured / 2000,
  });
  const items = ocrTextItems(
    {
      lines: [
        word(0.1, 0.2, 1, 37),
        word(0.6, 0.2, 2, 29),
        word(0.1, 0.3, 3, 35),
        word(0.1, 0.4, 4, 50),
      ],
    },
    1000,
    2000,
  );
  const widths = 100 / (5 * 0.571);
  const sizes = items.map((item) => Math.round(item.transform[0] * 10) / 10);
  const body = Math.round(((widths + 37) / 2) * 10) / 10;
  // Means of 36, 32, 35 and 42.5: the first three are within 15 % of the median (36) and
  // take it; 42.5 is a heading.
  assert.deepEqual(sizes, [body, body, body, Math.round(((widths + 50) / 2) * 10) / 10]);
  // Without measured sizes (Vision) the widths alone count and nothing is snapped.
  const plain = ocrTextItems(
    { lines: [line("aaaaa", 0.1, 0.2, 0.1, 0.03), line("aaaaa", 0.1, 0.3, 0.12, 0.03)] },
    1000,
    2000,
  );
  assert.deepEqual(
    plain.map((item) => Math.round(item.transform[0] * 10) / 10),
    [Math.round(widths * 10) / 10, Math.round((120 / 100) * widths * 10) / 10],
  );
});

test("a bar inside a word parts two glued cells; bars at the edges are dropped", () => {
  const items = ocrTextItems(
    {
      lines: [
        line("21/10/2026|FT26203861639", 0.1, 0.2, 0.24, 0.03),
        line("|Nap", 0.5, 0.2, 0.04, 0.03),
      ],
    },
    1000,
    2000,
  );
  assert.deepEqual(
    items.map((item) => [item.str, Math.round(item.transform[4]), Math.round(item.width)]),
    // 240 pixels for 23 letters and a rule worth a letter and a half.
    [
      ["21/10/2026 ", 100, 98],
      ["FT26203861639", 213, 127],
      ["Nap", 500, 40],
    ],
  );
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

test("a value hidden once is hidden wherever else it appears whole, with the same alias", async () => {
  const { maskParagraphs, repeatedValues } = await import("../src/core/doc/mask.ts");
  const paragraphs = [
    { id: 0, part: "p", text: "VU HUU VIET chuyen tien den TK 766227950 NGUYEN MINH HUNG" },
    { id: 1, part: "p", text: "41786 FT NGUYEN MINH HUNG(" },
    {
      id: 2,
      part: "p",
      text: "Số CCCD: 048077893214 · HUNG không phải tên; 766227950x cũng không",
    },
    { id: 3, part: "p", text: "Nam" },
    { id: 4, part: "p", text: "Địa chỉ: 12 Lê Lợi, Thành phố Hồ Chí Minh" },
    { id: 5, part: "p", text: "Ủy ban nhân dân Thành phố Hồ Chí Minh" },
  ];
  const detection = (start, end, type) => ({
    start,
    end,
    type,
    label: type,
    source: "test",
    reason: "test",
    priority: 100,
  });
  const detections = new Map([
    [0, [detection(31, 40, "STK"), detection(41, 57, "TEN")]],
    [2, [detection(9, 21, "CCCD")]],
    [3, [detection(0, 3, "TEN")]],
    [4, [detection(9, 41, "DIA_CHI"), detection(20, 41, "DIA_CHI")]],
  ]);
  const repeats = repeatedValues(paragraphs, detections);
  assert.deepEqual([...repeats.keys()], [1]);
  assert.deepEqual(
    repeats.get(1).map((d) => [d.type, paragraphs[1].text.slice(d.start, d.end), d.priority]),
    [["TEN", "NGUYEN MINH HUNG", 1]],
  );
  const { edits } = maskParagraphs(paragraphs, detections, "4aae");
  const alias = (id) => edits.paragraphs.get(id).map((r) => r.text);
  assert.deepEqual(alias(1), alias(0).slice(1));
  // A one-word name and a number glued to a letter are not repeated, nor a place
  // (its words recur inside names of state bodies that stay readable).
  assert.equal(edits.paragraphs.get(2).length, 1);
  assert.equal(edits.paragraphs.get(5), undefined);
});

test("the worker's canvas factory is a class pdf.js can construct, making OffscreenCanvases", () => {
  // pdf.js does `new CanvasFactory({ ownerDocument, enableHWA })`; a plain object threw
  // before any page was read in the desktop app (decision 0171).
  const made = [];
  globalThis.OffscreenCanvas = class {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      made.push(this);
    }
    getContext(kind) {
      return { kind };
    }
  };
  try {
    const factory = new OffscreenCanvasFactory({ ownerDocument: undefined, enableHWA: false });
    const target = factory.create(4, 3);
    assert.deepEqual(
      [target.canvas.width, target.canvas.height, target.context],
      [4, 3, { kind: "2d" }],
    );
    factory.reset(target, 8, 6);
    assert.deepEqual([made[0].width, made[0].height], [8, 6]);
    factory.destroy(target);
    assert.deepEqual([made[0].width, target.canvas, target.context], [0, null, null]);
  } finally {
    delete globalThis.OffscreenCanvas;
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { openDocument, writeDocument } from "../src/core/doc/document.ts";
import { maskParagraphs, restoreParagraphs } from "../src/core/doc/mask.ts";
import {
  countLargeImages,
  looksLikeOldFont,
  openPdf,
  pageList,
  writePdfText,
} from "../src/core/doc/pdf.ts";
import { fixtures } from "./pdf-fixtures.mjs";

const scope = "4aae";
const texts = (opened) => opened.paragraphs.map((paragraph) => paragraph.text);
const kinds = (opened) => opened.source.pages.map((page) => page.kind);
const failure = (code) => (error) => error?.code === code;

/** Detections at every occurrence of each value, then the masked Markdown. */
function maskValues(opened, values) {
  const detections = new Map();
  for (const paragraph of opened.paragraphs) {
    const found = [];
    for (const [value, type] of values) {
      const start = paragraph.text.indexOf(value);
      if (start >= 0)
        found.push({
          start,
          end: start + value.length,
          type,
          label: type,
          source: "test",
          reason: "test",
          priority: 1,
        });
    }
    if (found.length) detections.set(paragraph.id, found);
  }
  const { edits } = maskParagraphs(opened.paragraphs, detections, scope);
  return new TextDecoder().decode(writePdfText(opened.source, edits));
}

test("words drawn without space characters are read with spaces", async () => {
  const opened = await openPdf(await fixtures.noSpaces());
  assert.deepEqual(texts(opened), ["Người thuê là Trần Thị Mai, điện thoại 0912345678."]);
});

test("columns written one after the other stay apart", async () => {
  const opened = await openPdf(await fixtures.twoColumns());
  assert.deepEqual(texts(opened), [
    "Bên A: Công ty Bình Minh Mã số thuế 0101234567",
    "Bên B: Lê Văn Hùng Email hung.le@example.com",
  ]);
});

test("table rows become their own paragraphs with tabs between cells", async () => {
  const opened = await openPdf(await fixtures.table());
  assert.deepEqual(texts(opened), [
    "Họ tên\tSố điện thoại\tSố tiền",
    "Phạm Quốc Bảo\t0987654321\t5.000.000",
    "Đỗ Thu Hà\t0901122334\t7.500.000",
  ]);
});

test("decomposed Vietnamese is normalised to NFC", async () => {
  const opened = await openPdf(await fixtures.decomposed());
  assert.deepEqual(texts(opened), ["Ông Nguyễn Văn Tiến"]);
  assert.equal(texts(opened)[0], texts(opened)[0].normalize("NFC"));
});

test("a name wrapped onto the next line is read whole and masked", async () => {
  const opened = await openPdf(await fixtures.wrappedName());
  assert.equal(texts(opened)[0], "Hợp đồng này được ký giữa ông Nguyễn Văn An và công ty.");
  assert.equal(texts(opened)[1], "Điều 2. Thời hạn thuê là 12 tháng.");
  const output = maskValues(opened, [["Nguyễn Văn An", "TEN"]]);
  assert.doesNotMatch(output, /Nguyễn|Văn An/);
  assert.match(output, new RegExp(`ông \\[TEN_1_${scope}\\] và công ty`));
});

test("an invisible OCR text layer is read and masked", async () => {
  const opened = await openPdf(await fixtures.invisibleLayer());
  assert.deepEqual(kinds(opened), ["text"]);
  const output = maskValues(opened, [
    ["001203004567", "CCCD"],
    ["Vũ Thị Lan", "TEN"],
  ]);
  assert.doesNotMatch(output, /001203004567|Vũ Thị Lan/);
});

test("text under a black box is read, so it is masked rather than kept", async () => {
  const opened = await openPdf(await fixtures.coveredText());
  const output = maskValues(opened, [["Đặng Thị Hồng", "TEN"]]);
  assert.doesNotMatch(output, /Đặng Thị Hồng/);
  assert.match(output, /Người nhận: \[TEN_1_/);
});

test("form field values are read; checkboxes are not", async () => {
  const opened = await openPdf(await fixtures.formFields());
  assert.deepEqual(texts(opened), [
    "Tờ khai thông tin khách hàng",
    "ho_ten: Hoang Minh Tuan",
    "dien_thoai: 0934567890",
  ]);
  const output = maskValues(opened, [
    ["Hoang Minh Tuan", "TEN"],
    ["0934567890", "SDT"],
  ]);
  assert.doesNotMatch(output, /Hoang Minh Tuan|0934567890/);
});

test("comments are read with their author", async () => {
  const opened = await openPdf(await fixtures.comment());
  assert.deepEqual(texts(opened), [
    "Báo cáo quý 3",
    "Ghi chú (Ngo Thanh Son): Gọi lại cho chị Mai số 0977001122",
  ]);
});

test("the output never carries the document's metadata", async () => {
  const output = maskValues(await openPdf(await fixtures.metadata()), []);
  assert.equal(output, "## Trang 1\n\nBiên bản họp.\n");
});

test("large images are counted without decoding; a small logo is not", async () => {
  const bytes = await fixtures.images();
  assert.equal(countLargeImages(bytes), 1);
  const opened = await openPdf(bytes);
  assert.deepEqual(kinds(opened), ["text", "text"]);
  assert.deepEqual(opened.notes, [
    "Tệp có 1 hình ảnh. Hình ảnh không có trong bản đã ẩn; nếu trong ảnh có chữ cần gửi, hãy gõ lại.",
  ]);
});

test("a scanned page among text pages is named and left out of the output", async () => {
  const opened = await openPdf(await fixtures.mixedScan());
  assert.deepEqual(kinds(opened), ["text", "no-text", "text"]);
  assert.equal(
    opened.notes[0],
    "Trang 2 không có chữ đọc được (thường là ảnh scan). Bản đã ẩn sẽ không có nội dung trang này.",
  );
  const output = maskValues(opened, [["Trịnh Văn Long", "TEN"]]);
  assert.equal(
    output,
    `## Trang 1\n\nTrang một: hợp đồng của [TEN_1_${scope}].\n\n## Trang 2\n\n(Trang không có chữ đọc được, thường là ảnh scan — không có trong bản đã ẩn)\n\n## Trang 3\n\nTrang ba: chữ ký các bên.\n`,
  );
});

test("a PDF that is all scans is refused", async () => {
  await assert.rejects(openPdf(await fixtures.allScanned()), failure("scanned"));
});

test("pages in an old Vietnamese font are named, not masked badly", async () => {
  const opened = await openPdf(await fixtures.oldFont());
  assert.deepEqual(kinds(opened), ["text", "old-font"]);
  assert.match(opened.notes[0], /^Trang 2 dùng phông chữ cũ/);
  assert.doesNotMatch(maskValues(opened, []), /TrÇn|ViÖt/);
  await assert.rejects(openPdf(await fixtures.onlyOldFont()), failure("old-font"));
});

test("a PDF that needs a password is refused; one that only restricts printing opens", async () => {
  await assert.rejects(openPdf(await fixtures.password()), failure("password"));
  const opened = await openPdf(await fixtures.restricted());
  assert.deepEqual(texts(opened), ["Hop dong thue nha cua Tran Thi Mai, so dien thoai 0912345678"]);
});

test("files that are not PDFs, too large or too long are refused", async () => {
  await assert.rejects(openPdf(new TextEncoder().encode("not a pdf")), failure("unreadable"));
  await assert.rejects(openPdf(new Uint8Array(20 * 1024 * 1024 + 1)), failure("too-large"));
  const long = await PDFDocument.create();
  for (let index = 0; index < 301; index++) long.addPage();
  await assert.rejects(openPdf(await long.save()), failure("too-many-pages"));
});

test("reading a PDF fetches nothing", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (...args) => {
    calls++;
    return original(...args);
  };
  try {
    for (const make of Object.values(fixtures)) await openPdf(await make()).catch(() => {});
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(calls, 0);
});

test("old-font text is told apart from Vietnamese and other languages", () => {
  assert.equal(
    looksLikeOldFont("Cộng hòa xã hội chủ nghĩa Việt Nam, độc lập tự do hạnh phúc"),
    false,
  );
  assert.equal(looksLikeOldFont("Céng hßa x· héi chñ nghÜa ViÖt Nam §éc lËp - Tù do"), true);
  assert.equal(looksLikeOldFont("Coäng hoøa xaõ hoäi chuû nghóa Vieät Nam ñoäc laäp"), true);
  assert.equal(
    looksLikeOldFont(
      "Der Vertrag wurde zwischen beiden Parteien in München unterzeichnet und gilt für zwei Jahre.",
    ),
    false,
  );
  assert.equal(looksLikeOldFont("中华人民共和国合同法第一条规定双方当事人应当遵循公平原则"), false);
  assert.equal(looksLikeOldFont("\u0003\u0011$\u0003\u0011$\u0003\u0011$abcdefghijklmnopq"), true);
});

test("page lists collapse runs", () => {
  assert.equal(pageList([2]), "2");
  assert.equal(pageList([3, 5, 6, 7, 9]), "3, 5–7, 9");
});

test("documents route a PDF by its header and write it as Markdown", async () => {
  const opened = await openDocument(await fixtures.wrappedName(), "Hợp đồng.pdf");
  assert.equal(opened.source.format, "pdf");
  assert.deepEqual(opened.mailto, []);
  const { edits } = maskParagraphs(opened.paragraphs, new Map(), scope);
  const written = new TextDecoder().decode(await writeDocument(opened.source, edits));
  assert.match(written, /^## Trang 1\n\nHợp đồng này/);
});

test("reading stops at the next page once cancelled, and reports pages as it goes", async () => {
  const pages = [];
  const opened = await openPdf(await fixtures.mixedScan(), {
    onPage: (done, total) => pages.push([done, total]),
  });
  assert.equal(opened.source.pages.length, 3);
  assert.deepEqual(pages, [
    [1, 3],
    [2, 3],
    [3, 3],
  ]);
  let read = 0;
  await assert.rejects(
    openPdf(await fixtures.mixedScan(), { onPage: () => read++, stopped: () => read >= 1 }),
    failure("cancelled"),
  );
  assert.equal(read, 1);
});

test("a PDF's Markdown returned by the AI is restored line by line, endings kept", async () => {
  const opened = await openPdf(await fixtures.wrappedName());
  const detections = new Map([
    [
      0,
      [
        {
          start: 30,
          end: 43,
          type: "TEN",
          label: "TEN",
          source: "test",
          reason: "test",
          priority: 1,
        },
      ],
    ],
  ]);
  const { edits, findings } = maskParagraphs(opened.paragraphs, detections, scope);
  const markdown = new TextDecoder().decode(writePdfText(opened.source, edits));
  const reply = `Tóm tắt:\r\n\r\n${markdown.split("\n\n")[1]}\r\nHết.`;
  const returned = await openDocument(new TextEncoder().encode(reply), "trả lời.md");
  assert.equal(returned.source.format, "plain");
  const restored = restoreParagraphs(returned.paragraphs, findings);
  assert.equal(restored.restored, 1);
  const written = new TextDecoder().decode(await writeDocument(returned.source, restored.edits));
  assert.equal(
    written,
    "Tóm tắt:\r\n\r\nHợp đồng này được ký giữa ông Nguyễn Văn An và công ty.\r\nHết.",
  );
});

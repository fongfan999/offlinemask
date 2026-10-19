import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { openSheetFile, writeSheetFile } from "../src/core/sheet/files.ts";
import { withAttribute } from "../src/core/sheet/ods.ts";

const NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:calcext="urn:org:documentfoundation:names:experimental:calc:xmlns:calcext:1.0"';
const s = (text, extra = "") =>
  `<table:table-cell office:value-type="string" calcext:value-type="string"${extra}><text:p>${text}</text:p></table:table-cell>`;
const n = (value, shown = value, extra = "") =>
  `<table:table-cell office:value-type="float" office:value="${value}" calcext:value-type="float"${extra}><text:p>${shown}</text:p></table:table-cell>`;
const empty = (repeat) =>
  repeat > 1
    ? `<table:table-cell table:number-columns-repeated="${repeat}"/>`
    : "<table:table-cell/>";
const row = (cells, extra = "") =>
  `<table:table-row table:style-name="ro1"${extra}>${cells}</table:table-row>`;

async function ods(rows) {
  const zip = new JSZip();
  zip.file("mimetype", "application/vnd.oasis.opendocument.spreadsheet", { compression: "STORE" });
  zip.file(
    "content.xml",
    `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NS}><office:body><office:spreadsheet><table:table table:name="Khách hàng"><table:table-column table:number-columns-repeated="4"/>${rows}<table:table-row table:number-rows-repeated="1048570"><table:table-cell table:number-columns-repeated="1024"/></table:table-row></table:table></office:spreadsheet></office:body></office:document-content>`,
  );
  zip.file(
    "meta.xml",
    `<office:document-meta ${NS}><office:meta><dc:creator>Nguyễn Minh Anh</dc:creator></office:meta></office:document-meta>`,
  );
  zip.file("Thumbnails/thumbnail.png", new Uint8Array([137, 80]));
  zip.file(
    "META-INF/manifest.xml",
    '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:full-path="Thumbnails/thumbnail.png" manifest:media-type="image/png"/></manifest:manifest>',
  );
  return zip.generateAsync({ type: "uint8array" });
}

const sample = () =>
  ods(
    row(
      `<table:table-cell table:number-columns-spanned="3" office:value-type="string"><text:p>Danh sách khách</text:p></table:table-cell><table:covered-table-cell table:number-columns-repeated="2"/>${empty(1)}`,
    ) +
      row(s("Họ tên") + s("Điện thoại") + s("Ghi chú") + s("Số tiền")) +
      row(
        s("Nguyễn Minh Anh") +
          n("901234567", "0901234567") +
          `<table:table-cell office:value-type="string"><office:annotation><dc:creator>Trần Bình</dc:creator><text:p>gọi lại</text:p></office:annotation><text:p>Khách <text:span>VIP</text:span><text:s text:c="2"/>quen</text:p></table:table-cell>` +
          n("2500000", "2.500.000"),
      ) +
      row(
        s("Lê Ngọc Hà") +
          n("912345678", "0912345678") +
          empty(1) +
          n("100", "100", ' table:formula="of:=[.D3]/25000"'),
        ' table:number-rows-repeated="2"',
      ),
  );

test("ods sheets read display text, repeats, merged cells and skip comments and empty tails", async () => {
  const file = await openSheetFile(await sample(), "khach.ods");
  assert.equal(file.source.format, "ods");
  const [table] = file.tables;
  assert.equal(table.name, "Khách hàng");
  assert.deepEqual(table.preamble, [["Danh sách khách", "", "", ""]]);
  assert.deepEqual(table.header, ["Họ tên", "Điện thoại", "Ghi chú", "Số tiền"]);
  assert.deepEqual(table.rows, [
    ["Nguyễn Minh Anh", "0901234567", "Khách VIP  quen", "2.500.000"],
    ["Lê Ngọc Hà", "0912345678", "", "100"],
    ["Lê Ngọc Hà", "0912345678", "", "100"],
  ]);
});

test("masking an ods rewrites only hidden cells, splits repeats, clears authors and the thumbnail", async () => {
  const file = await openSheetFile(await sample(), "khach.ods");
  // Rows are keyed by their index in the sheet: preamble 0, header 1, data from 2.
  const edits = [
    new Map([
      [
        2,
        new Map([
          [0, "[TEN_1_4aae]"],
          [1, "[SDT_1_4aae]"],
        ]),
      ],
      [4, new Map([[0, "[TEN_2_4aae]"]])],
    ]),
  ];
  const written = await writeSheetFile(file.source, edits);
  assert.equal(new TextDecoder().decode(written.subarray(30, 38)), "mimetype");
  const zip = await JSZip.loadAsync(written);
  assert.equal(zip.file("Thumbnails/thumbnail.png"), null);
  assert.doesNotMatch(await zip.file("META-INF/manifest.xml").async("string"), /Thumbnails/);
  assert.doesNotMatch(await zip.file("meta.xml").async("string"), /Nguyễn/);
  const content = await zip.file("content.xml").async("string");
  assert.doesNotMatch(content, /Nguyễn|901234567|Trần Bình/);
  assert.match(content, /office:value="2500000"/, "untouched numbers keep their value");
  assert.match(content, /table:formula="of:=\[\.D3\]\/25000"/, "untouched formulas stay");

  const reopened = await openSheetFile(written, "khach (đã ẩn).ods");
  assert.deepEqual(reopened.tables[0].rows, [
    ["[TEN_1_4aae]", "[SDT_1_4aae]", "Khách VIP  quen", "2.500.000"],
    ["Lê Ngọc Hà", "0912345678", "", "100"],
    ["[TEN_2_4aae]", "0912345678", "", "100"],
  ]);
  // The hidden phone is now a text cell with no numeric value left behind.
  assert.match(
    content,
    /<table:table-cell office:value-type="string"[^>]*><text:p>\[SDT_1_4aae\]<\/text:p>/,
  );
  // The opened source is unchanged, so the same file can be masked again.
  assert.match(file.source.xml, /Nguyễn Minh Anh/);
});

test("a repeated cell is split around the edited copy", async () => {
  const file = await openSheetFile(
    await ods(row(s("Tên") + s("Mã")) + row(s("Lan", ' table:number-columns-repeated="3"'))),
    "x.ods",
  );
  assert.deepEqual(file.tables[0].rows, [["Lan", "Lan", "Lan"]]);
  const written = await writeSheetFile(file.source, [
    new Map([[1, new Map([[1, "[TEN_1_4aae]"]])]]),
  ]);
  const reopened = await openSheetFile(written, "x.ods");
  assert.deepEqual(reopened.tables[0].rows, [["Lan", "[TEN_1_4aae]", "Lan"]]);
});

test("attributes are set and removed in an opening tag", () => {
  assert.equal(withAttribute('<a b="1" c="2">', "b", null), '<a c="2">');
  assert.equal(withAttribute('<a c="2"/>', "b", "3"), '<a b="3" c="2"/>');
});

test("a spreadsheet that is not ods, or is locked, is unreadable", async () => {
  const zip = new JSZip();
  zip.file("mimetype", "application/vnd.oasis.opendocument.text", { compression: "STORE" });
  zip.file("content.xml", "<x/>");
  await assert.rejects(openSheetFile(await zip.generateAsync({ type: "uint8array" }), "a.ods"), {
    code: "unreadable",
  });
});

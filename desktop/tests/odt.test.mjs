import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { openDocument, writeDocument } from "../src/core/doc/document.ts";
import { parseOdtPart } from "../src/core/doc/odt.ts";
import { maskParagraphs } from "../src/core/doc/mask.ts";

const scope = "4aae";
const NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:xlink="http://www.w3.org/1999/xlink"';
const detection = (start, end, type) => ({
  start,
  end,
  type,
  label: type,
  source: "test",
  reason: "test",
  priority: 1,
});

async function odt(body, { header = "", thumbnail = true } = {}) {
  const zip = new JSZip();
  zip.file("mimetype", "application/vnd.oasis.opendocument.text", { compression: "STORE" });
  zip.file(
    "content.xml",
    `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NS}><office:body><office:text>${body}</office:text></office:body></office:document-content>`,
  );
  zip.file(
    "styles.xml",
    `<?xml version="1.0"?><office:document-styles ${NS}><office:master-styles>${header}</office:master-styles></office:document-styles>`,
  );
  zip.file(
    "meta.xml",
    `<?xml version="1.0"?><office:document-meta ${NS}><office:meta><meta:initial-creator>Nguyễn Minh Anh</meta:initial-creator><dc:creator>Nguyễn Minh Anh</dc:creator></office:meta></office:document-meta>`,
  );
  if (thumbnail) zip.file("Thumbnails/thumbnail.png", new Uint8Array([137, 80, 78, 71]));
  zip.file(
    "META-INF/manifest.xml",
    `<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>${thumbnail ? '<manifest:file-entry manifest:full-path="Thumbnails/thumbnail.png" manifest:media-type="image/png"/>' : ""}</manifest:manifest>`,
  );
  return zip.generateAsync({ type: "uint8array" });
}

test("odt paragraphs read text across spans, encoded spaces, tabs and breaks", () => {
  const part = parseOdtPart(
    "content.xml",
    `<text:p>Gọi <text:span>chị</text:span><text:s text:c="2"/>Lan<text:tab/>A<text:line-break/>B &amp; C</text:p><text:h>Tiêu
    đề</text:h>`,
  );
  const texts = part.paragraphs.map((pieces) =>
    pieces.map((p) => ("segment" in p ? part.segments[p.segment].text : p.literal)).join(""),
  );
  assert.deepEqual(texts, ["Gọi chị  Lan\tA\nB & C", "Tiêu đề"]);
});

test("a comment's author is not paragraph text; its body is its own paragraph", () => {
  const part = parseOdtPart(
    "content.xml",
    "<text:p>Hợp đồng<office:annotation><dc:creator>Trần Bình</dc:creator><dc:date>2026-10-14</dc:date><text:p>Xem lại</text:p></office:annotation> số 12</text:p>",
  );
  const texts = part.paragraphs.map((pieces) =>
    pieces.map((p) => ("segment" in p ? part.segments[p.segment].text : p.literal)).join(""),
  );
  assert.deepEqual(texts.sort(), ["Hợp đồng số 12", "Xem lại"].sort());
});

test("masking an odt rewrites spans, links and headers, clears authors and drops the thumbnail", async () => {
  const bytes = await odt(
    '<text:p>Bên A: <text:span>Nguyễn</text:span> Minh Anh, email <text:a xlink:href="mailto:anh@example.com">anh@example.com</text:a>.</text:p><text:p>Ghi chú<office:annotation><dc:creator>Trần Bình</dc:creator><text:p>ok</text:p></office:annotation></text:p>',
    {
      header:
        '<style:master-page xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"><style:header><text:p>Nguyễn Minh Anh</text:p></style:header></style:master-page>',
    },
  );
  const opened = await openDocument(bytes);
  assert.equal(opened.source.format, "odt");
  assert.deepEqual(opened.mailto, ["anh@example.com"]);
  const body = opened.paragraphs.find((p) => p.text.startsWith("Bên A"));
  assert.equal(body.text, "Bên A: Nguyễn Minh Anh, email anh@example.com.");
  const header = opened.paragraphs.find((p) => p.part === "styles.xml");
  assert.equal(header.text, "Nguyễn Minh Anh");
  const detections = new Map([
    [body.id, [detection(7, 22, "TEN"), detection(30, 45, "EMAIL")]],
    [header.id, [detection(0, 15, "TEN")]],
  ]);
  const result = maskParagraphs(opened.paragraphs, detections, scope, opened.mailto);
  const written = await writeDocument(opened.source, result.edits);

  const zip = await JSZip.loadAsync(written);
  assert.equal(Object.keys(zip.files)[0], "mimetype", "mimetype stays the first entry");
  assert.equal(new TextDecoder().decode(written.subarray(30, 38)), "mimetype");
  assert.equal(written[8], 0, "mimetype is stored uncompressed");
  assert.equal(zip.file("Thumbnails/thumbnail.png"), null);
  assert.doesNotMatch(await zip.file("META-INF/manifest.xml").async("string"), /Thumbnails/);
  const content = await zip.file("content.xml").async("string");
  assert.doesNotMatch(content, /Nguyễn|Minh Anh|anh@example\.com|Trần Bình/);
  assert.match(content, new RegExp(`xlink:href="mailto:\\[EMAIL_1_${scope}\\]"`));
  assert.match(content, /<dc:creator><\/dc:creator>/);
  assert.doesNotMatch(await zip.file("styles.xml").async("string"), /Nguyễn/);
  assert.doesNotMatch(await zip.file("meta.xml").async("string"), /Nguyễn/);

  const reopened = await openDocument(written);
  assert.equal(
    reopened.paragraphs.find((p) => p.text.startsWith("Bên A")).text,
    `Bên A: [TEN_1_${scope}], email [EMAIL_1_${scope}].`,
  );
  // The source stays unchanged, so the same file can be masked again.
  assert.equal(opened.source.parts[0].xml.includes("Nguyễn"), true);
});

test("a password-protected or foreign package is unreadable", async () => {
  const zip = new JSZip();
  zip.file("mimetype", "application/vnd.oasis.opendocument.spreadsheet", { compression: "STORE" });
  zip.file("content.xml", "<x/>");
  await assert.rejects(openDocument(await zip.generateAsync({ type: "uint8array" })), {
    code: "unreadable",
  });
  const locked = new JSZip();
  locked.file("mimetype", "application/vnd.oasis.opendocument.text", { compression: "STORE" });
  locked.file("content.xml", "binary");
  locked.file("META-INF/manifest.xml", "<manifest:encryption-data/>");
  await assert.rejects(openDocument(await locked.generateAsync({ type: "uint8array" })), {
    code: "unreadable",
  });
});

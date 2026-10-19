import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import {
  applyReplacements,
  escapeXml,
  mailtoTargets,
  openDocx,
  unescapeXml,
  writeDocx,
} from "../src/core/doc/docx.ts";
import { maskParagraphs, previewParagraphs, restoreParagraphs } from "../src/core/doc/mask.ts";

const scope = "4aae";
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const detection = (start, end, type) => ({
  start,
  end,
  type,
  label: type,
  source: "test",
  reason: "test",
  priority: 1,
});

async function docx({ body, header, rels = "", creator = "Nguyễn Minh Anh" }) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file(
    "word/document.xml",
    `<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`,
  );
  if (header) zip.file("word/header1.xml", `<w:hdr ${W}>${header}</w:hdr>`);
  zip.file("word/_rels/document.xml.rels", `<Relationships>${rels}</Relationships>`);
  zip.file(
    "docProps/core.xml",
    `<cp:coreProperties><dc:creator>${creator}</dc:creator><cp:lastModifiedBy>${creator}</cp:lastModifiedBy></cp:coreProperties>`,
  );
  return zip.generateAsync({ type: "uint8array" });
}
async function readPart(bytes, name) {
  return (await JSZip.loadAsync(bytes)).file(name).async("string");
}

test("XML text escapes round-trip", () => {
  assert.equal(unescapeXml("a &amp; b &lt;c&gt; &#7871; &#x1EBF; &quot;"), 'a & b <c> ế ế "');
  assert.equal(escapeXml("a & <b>"), "a &amp; &lt;b&gt;");
});

test("paragraphs join their runs; tabs, breaks, deleted text and headers are read", async () => {
  const bytes = await docx({
    body:
      '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Bên A: Nguyễn </w:t></w:r><w:r><w:t xml:space="preserve">Minh Anh</w:t></w:r><w:r><w:tab/><w:t>SĐT 0901234567</w:t></w:r></w:p>' +
      "<w:p/><w:p><w:r><w:t></w:t></w:r></w:p>" +
      "<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Ô bảng &amp; ghi chú</w:t></w:r></w:p></w:tc></w:tr></w:tbl>" +
      "<w:p><w:del><w:r><w:delText>Trần Bình</w:delText></w:r></w:del></w:p>",
    header: "<w:p><w:r><w:t>Hợp đồng số 12</w:t></w:r><w:r><w:br/><w:t>Mật</w:t></w:r></w:p>",
  });
  const file = await openDocx(bytes);
  assert.deepEqual(
    file.paragraphs.map((p) => [p.part, p.text]),
    [
      ["word/document.xml", "Bên A: Nguyễn Minh Anh\tSĐT 0901234567"],
      ["word/document.xml", "Ô bảng & ghi chú"],
      ["word/document.xml", "Trần Bình"],
      ["word/header1.xml", "Hợp đồng số 12\nMật"],
    ],
  );
  assert.equal(file.notes.length, 1);
});

test("masking writes each alias into the first run it covers, keeps formatting, links and nothing else", async () => {
  const bytes = await docx({
    body:
      "<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Bên A: Nguyễn </w:t></w:r><w:r><w:t>Minh Anh</w:t></w:r><w:r><w:tab/><w:t>gọi 0901234567</w:t></w:r></w:p>" +
      '<w:p><w:hyperlink r:id="rId9"><w:r><w:t>an@example.com</w:t></w:r></w:hyperlink></w:p>' +
      "<w:p><w:del><w:r><w:delText>Nguyễn Minh Anh</w:delText></w:r></w:del></w:p>",
    rels: '<Relationship Id="rId9" Target="mailto:an@example.com" TargetMode="External"/>',
  });
  const file = await openDocx(bytes);
  const [first, link, deleted] = file.paragraphs;
  const name = "Nguyễn Minh Anh";
  const detections = new Map([
    [
      first.id,
      [
        detection(7, 7 + name.length, "TEN"),
        detection(first.text.indexOf("0901"), first.text.indexOf("0901") + 10, "SDT"),
      ],
    ],
    [link.id, [detection(0, 14, "EMAIL")]],
    [deleted.id, [detection(0, name.length, "TEN")]],
  ]);
  const mailto = mailtoTargets(file.source);
  assert.deepEqual(mailto, ["an@example.com"]);
  const result = maskParagraphs(file.paragraphs, detections, scope, mailto);
  assert.equal(result.masked, 4);
  assert.deepEqual(
    previewParagraphs(file.paragraphs, result.edits.paragraphs, 2).map((p) => p.text),
    [`Bên A: [TEN_1_${scope}]\tgọi [SDT_1_${scope}]`, `[EMAIL_1_${scope}]`],
  );
  const out = await writeDocx(file.source, result.edits);
  const xml = await readPart(out, "word/document.xml");
  // The bold run takes the whole alias; the next run keeps nothing of the name.
  assert.ok(xml.includes(`<w:rPr><w:b/></w:rPr><w:t>Bên A: [TEN_1_${scope}]</w:t>`));
  assert.ok(xml.includes("<w:r><w:t></w:t></w:r>"));
  assert.ok(xml.includes(`<w:delText>[TEN_1_${scope}]</w:delText>`));
  assert.ok(
    !xml.includes("Minh Anh") && !xml.includes("0901234567") && !xml.includes("an@example.com"),
  );
  assert.ok(
    (await readPart(out, "word/_rels/document.xml.rels")).includes(`mailto:[EMAIL_1_${scope}]`),
  );
  const core = await readPart(out, "docProps/core.xml");
  assert.ok(!core.includes("Nguyễn"));
  // The opened source is unchanged, so the same file can be masked again.
  assert.ok(
    (
      await openDocx(await writeDocx(file.source, { paragraphs: new Map(), links: new Map() }))
    ).paragraphs[0].text.includes(name),
  );

  const back = await openDocx(out);
  const restored = restoreParagraphs(
    [...back.paragraphs, { id: 99, part: "x", text: "[TEN_7_dead]" }],
    result.findings,
    mailtoTargets(back.source),
  );
  assert.deepEqual(restored.unknown, ["[TEN_7_dead]"]);
  const again = await openDocx(await writeDocx(back.source, restored.edits));
  assert.equal(again.paragraphs[0].text, "Bên A: Nguyễn Minh Anh\tgọi 0901234567");
  assert.equal(again.paragraphs[1].text, "an@example.com");
});

test("replacements report where they land; files that are not .docx are refused", async () => {
  assert.deepEqual(applyReplacements("Gọi An nhé", [{ start: 4, end: 6, text: "[TEN_1_x]" }]), {
    text: "Gọi [TEN_1_x] nhé",
    marks: [{ start: 4, end: 13 }],
  });
  await assert.rejects(openDocx(new Uint8Array([1, 2, 3])), { code: "unreadable" });
  const empty = new JSZip();
  empty.file("word/document.xml", `<w:document ${W}><w:body><w:p/></w:body></w:document>`);
  await assert.rejects(openDocx(await empty.generateAsync({ type: "uint8array" })), {
    code: "empty",
  });
});

import {
  decodePrivateSessions,
  encodePrivateSessions,
  encodeSessions,
  sessionTitle,
} from "../src/core/sessions.ts";
import { sessionPreview } from "../src/core/session-preview.ts";

function docSession() {
  return {
    id: "4aae0000-0000-4000-8000-000000000002",
    number: 4,
    format: "word",
    fixture: "private-doc-v1",
    createdAt: "2026-10-14T05:00:00.000Z",
    fileName: "Hợp đồng.docx",
    paragraphs: 9,
    preview: [{ text: `Bên A: [TEN_1_${scope}]`, marks: [{ start: 7, end: 19 }] }],
    findings: [
      {
        id: "TEN_1",
        alias: `[TEN_1_${scope}]`,
        value: "An",
        label: "Họ và tên",
        reason: "r",
        source: "s",
      },
    ],
    masked: 1,
  };
}

test("Word sessions round-trip through the vault, never reach sample storage, and reject damage", () => {
  const session = docSession();
  assert.equal(sessionTitle(session), "Tài liệu #4");
  assert.equal(sessionPreview(session), "Hợp đồng.docx");
  assert.deepEqual(decodePrivateSessions(encodePrivateSessions([session])), [session]);
  assert.ok(!encodeSessions([session]).includes("Hợp đồng"));
  for (const damage of [
    (s) => (s.preview[0].marks[0].end = 999),
    (s) => (s.findings[0].alias = "TEN_1"),
    (s) => (s.paragraphs = -1),
    (s) => (s.format = "excel"),
  ]) {
    const damaged = docSession();
    damage(damaged);
    assert.throws(() => decodePrivateSessions(encodePrivateSessions([damaged])));
  }
});

test("field instructions keep their Word syntax: only contact values are replaced in them", async () => {
  const bytes = await docx({
    body:
      "<w:p><w:r><w:t>Trang</w:t></w:r></w:p>" +
      '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE \\* MERGEFORMAT </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>' +
      '<w:p><w:r><w:instrText xml:space="preserve"> HYPERLINK "mailto:an@example.com" </w:instrText></w:r></w:p>',
  });
  const file = await openDocx(bytes);
  const [prose, page, link] = file.paragraphs;
  assert.equal(prose.field, undefined);
  assert.equal(page.field, true);
  assert.equal(link.field, true);
  const detections = new Map([
    [prose.id, [detection(0, 5, "TEN")]],
    [page.id, [detection(1, 5, "TEN"), detection(9, 20, "TO_CHUC")]],
    [link.id, [detection(link.text.indexOf("an@"), link.text.indexOf("an@") + 14, "EMAIL")]],
  ]);
  const result = maskParagraphs(file.paragraphs, detections, scope);
  assert.equal(result.masked, 2);
  assert.deepEqual(
    previewParagraphs(file.paragraphs, result.edits.paragraphs, 3).map((p) => p.text),
    [`[TEN_1_${scope}]`, " PAGE \\* MERGEFORMAT ", ` HYPERLINK "mailto:[EMAIL_1_${scope}]" `],
  );
});

test("the masked copy drops Word's first-page thumbnail and its relationship", async () => {
  const zip = await JSZip.loadAsync(
    await docx({ body: "<w:p><w:r><w:t>Nguyễn Minh Anh</w:t></w:r></w:p>" }),
  );
  zip.file("docProps/thumbnail.jpeg", new Uint8Array([255, 216]));
  zip.file(
    "_rels/.rels",
    '<Relationships><Relationship Id="rId1" Type="officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail" Target="docProps/thumbnail.jpeg"/></Relationships>',
  );
  const file = await openDocx(await zip.generateAsync({ type: "uint8array" }));
  const written = await JSZip.loadAsync(
    await writeDocx(file.source, { paragraphs: new Map(), links: new Map() }),
  );
  assert.equal(written.file("docProps/thumbnail.jpeg"), null);
  const rels = await written.file("_rels/.rels").async("string");
  assert.doesNotMatch(rels, /thumbnail/);
  assert.match(rels, /word\/document\.xml/);
});

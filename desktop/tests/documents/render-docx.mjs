import JSZip from "jszip";

/** A document model (kinds.mjs) as a minimal Word file: real paragraphs, bold runs,
 * centred and right-aligned lines, two fields on a line separated by a tab, tables with
 * borders and a merged total row, signatures in a borderless table, and the font named
 * as Word documents name it (Times New Roman or Arial). */
const escape = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const run = (text, { bold = false, size } = {}) =>
  `<w:r><w:rPr>${bold ? "<w:b/>" : ""}${size ? `<w:sz w:val="${Math.round(size * 2)}"/>` : ""}</w:rPr><w:t xml:space="preserve">${escape(text)}</w:t></w:r>`;
const tab = "<w:r><w:tab/></w:r>";
const paragraph = (runs, align) =>
  `<w:p>${align && align !== "left" ? `<w:pPr><w:jc w:val="${align === "right" ? "right" : "center"}"/></w:pPr>` : ""}${runs}</w:p>`;
const borders = (value) =>
  `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((side) => `<w:${side} w:val="${value}" w:sz="4" w:space="0" w:color="888888"/>`).join("")}</w:tblBorders>`;
const twips = 9000;

function table({ columns, rows, blank = 0, total }) {
  const widths = columns.map((column) => Math.round(column.width * twips));
  const cell = (text, index, { bold = false, align, span } = {}) =>
    `<w:tc><w:tcPr><w:tcW w:w="${span ? widths.slice(0, span).reduce((a, b) => a + b, 0) : widths[index]}" w:type="dxa"/>${span ? `<w:gridSpan w:val="${span}"/>` : ""}<w:vAlign w:val="center"/></w:tcPr>${paragraph(text ? run(text, { bold }) : "", align)}</w:tc>`;
  const header = `<w:tr>${columns.map((column, index) => cell(column.title, index, { bold: true, align: "center" })).join("")}</w:tr>`;
  const body = [...rows, ...Array.from({ length: blank }, () => columns.map(() => ""))]
    .map(
      (cells) =>
        `<w:tr>${cells.map((text, index) => cell(text, index, { align: columns[index].align })).join("")}</w:tr>`,
    )
    .join("");
  const totalRow = total
    ? `<w:tr>${cell(total.label, 0, { bold: true, align: "center", span: columns.length - 1 })}${cell(total.value, columns.length - 1, { bold: true, align: "right" })}</w:tr>`
    : "";
  return `<w:tbl><w:tblPr><w:tblW w:w="${twips}" w:type="dxa"/>${borders("single")}</w:tblPr><w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${header}${body}${totalRow}</w:tbl><w:p/>`;
}

function signatures(parties) {
  const width = Math.round(twips / parties.length);
  const cells = parties
    .map(
      (party) =>
        `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr>${paragraph(party.role ? run(party.role, { bold: true }) : "", "center")}${paragraph(party.note ? run(party.note) : "", "center")}<w:p/><w:p/><w:p/>${paragraph(party.name ? run(party.name, { bold: true }) : "", "center")}</w:tc>`,
    )
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="${twips}" w:type="dxa"/>${borders("nil")}</w:tblPr><w:tblGrid>${parties.map(() => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid><w:tr>${cells}</w:tr></w:tbl>`;
}

export async function renderDocx(model) {
  const size = model.size + 1;
  const body = model.blocks
    .map((block) => {
      if (block.pageBreak) return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      if (block.space !== undefined) return "<w:p/>";
      if (block.title !== undefined)
        return paragraph(
          run(block.title, { bold: true, size: size + (block.size ?? 2) }),
          "center",
        );
      if (block.text !== undefined)
        return paragraph(run(block.text, { bold: block.bold }), block.align);
      if (block.fields)
        return paragraph(
          block.fields
            .map(([label, value]) => run(`${label}: `, { bold: true }) + (value ? run(value) : ""))
            .join(tab),
        );
      if (block.table) return table(block.table);
      if (block.signatures) return signatures(block.signatures);
      return "";
    })
    .join("");
  const font = model.font === "serif" ? "Times New Roman" : "Arial";
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    "word/_rels/document.xml.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  );
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${Math.round(size * 2)}"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  );
  // A fixed date on every entry: the same seed always writes the same bytes.
  for (const file of Object.values(zip.files)) file.date = new Date("2026-10-26T00:00:00Z");
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
